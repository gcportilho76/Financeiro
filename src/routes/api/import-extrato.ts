import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ExtractedItem = {
  data: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  categoria: string;
};

const SYSTEM_PROMPT = `Você é um especialista em ler extratos bancários, faturas de cartão de crédito e contracheques/holerites brasileiros.
Analise o documento fornecido e extraia TODAS as transações financeiras visíveis.

TIPOS DE DOCUMENTO:

1. EXTRATO BANCÁRIO ou FATURA DE CARTÃO:
   - Cada linha do extrato/fatura é uma transação individual.
   - tipo "receita" para entradas/créditos, "despesa" para saídas/débitos.

2. CONTRACHEQUE / HOLERITE:
   - Extraia cada rubrica como um item separado, agrupando nas seções do documento:
     a) RENDIMENTOS (tipo "receita"):
        - Salário base, vantagens pessoais, complemento, gratificação, etc.
        - categoria: "Salário"
        - Descrição deve incluir o nome da rubrica (ex: "Salário Base", "Vantagens Pessoais").
     b) DESCONTOS (tipo "despesa"):
        - Consignados (empréstimos, financiamentos): categoria "Consignado"
        - GEAP / plano de saúde: categoria "Saúde"
        - IR / Imposto de Renda: categoria "Outros", descrição "Imposto de Renda"
        - INSS / Previdência: categoria "Outros", descrição "INSS"
        - Pensão alimentícia: categoria "Outros"
        - Sindicato / contribuição associativa: categoria "Outros"
        - Outros descontos: categoria "Outros"
   - A data de todos os itens do contracheque é o mês de competência referência (use o último dia do mês se a data exata não estiver visível).
   - Use o valor liquido ou bruto conforme aparece na rubrica (sempre positivo).

Para cada transação, retorne:
- data: no formato YYYY-MM-DD
- descricao: texto limpo e descritivo da transação/rubrica
- valor: número positivo (ex: 150.50)
- tipo: "receita" para entradas/créditos/rendimentos ou "despesa" para saídas/débitos/descontos
- categoria: Habitação, Alimentação, Transporte, Educação, Saúde, Lazer, Cartão, Salário, Freelance, Investimentos, Amortização, Consignado, Outros

Regras:
- Para contracheques, cada rubrica de rendimento OU desconto deve vir como um item SEPARADO no array.
- Não consolide rubricas em um único valor; preserve o detalhamento.
- Se o documento for um contracheque, NÃO use categoria "Salário" para descontos — use a categoria apropriada (Consignado, Saúde, Outros, etc.).

Responda APENAS com um JSON válido no formato:
{"itens": [{"data": "2026-01-15", "descricao": "Salário Base", "valor": 11000.00, "tipo": "receita", "categoria": "Salário"}, {"data": "2026-01-31", "descricao": "Consignado Banco X", "valor": 800.00, "tipo": "despesa", "categoria": "Consignado"}, {"data": "2026-01-31", "descricao": "GEAP", "valor": 320.00, "tipo": "despesa", "categoria": "Saúde"}]}`;

export const Route = createFileRoute("/api/import-extrato")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // ─── Env validation ─────────────────────────────────
          const geminiKey = process.env["GEMINI_API_KEY"] || process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
          if (!geminiKey) {
            return jsonResponse({ error: "GEMINI_API_KEY não configurada no servidor" }, 400);
          }

          // ─── File validation ────────────────────────────────
          const formData = await request.formData();
          const file = formData.get("file");
          if (!file || !(file instanceof File)) {
            return jsonResponse({ error: "Arquivo não encontrado no upload" }, 400);
          }

          // ─── Optional PDF text extraction ───────────────────
          let rawText = "";
          if (file.type === "application/pdf") {
            try {
              rawText = await extractPdfText(file);
            } catch (err) {
              console.warn("Falha na extração direta de texto do PDF:", err);
            }
          }

          const base64 = await fileToBase64(file);
          const dataUrl = `data:${file.type};base64,${base64}`;

          const userContent: any[] = [];
          if (rawText && rawText.trim().length > 10) {
            userContent.push({
              type: "text",
              text: `Texto do documento:\n${rawText}\n\nExtraia todas as transações financeiras.`,
            });
          } else {
            userContent.push({
              type: "text",
              text: "Extraia todas as transações financeiras deste documento.",
            });
            userContent.push({
              type: "image",
              image: dataUrl,
            });
          }

          // ─── Safe SDK Call ──────────────────────────────────
          let responseText = "";
          try {
            const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
            const { generateText } = await import("ai");

            const google = createGoogleGenerativeAI({ apiKey: geminiKey });

            // Tenta cada modelo em sequência caso algum falhe por cota ou indisponibilidade
            const modelsToTry = [
              "gemini-1.5-flash",
              "gemini-1.5-pro",
              "gemini-2.0-flash-exp",
              "gemini-1.5-flash-8b"
            ];

            let lastError: any = null;

            for (const modelName of modelsToTry) {
              try {
                const result = await generateText({
                  model: google(modelName),
                  system: SYSTEM_PROMPT,
                  messages: [{ role: "user", content: userContent }],
                  maxRetries: 1,
                });
                responseText = result.text.trim();
                if (responseText) break; // Sucesso! Sai do loop e segue
              } catch (err: any) {
                lastError = err;
                console.warn(`Modelo ${modelName} indisponível, tentando próximo...`, err?.message);
              }
            }

            if (!responseText && lastError) {
              throw lastError;
            }
          } catch (aiErr: any) {
            console.error("Gemini SDK Call Failed:", aiErr);
            return jsonResponse(
              { error: `Erro na API do Gemini: ${aiErr?.message ?? String(aiErr)}` },
              502
            );
          }
          // ─── Parse JSON Response ────────────────────────────
          let itens: ExtractedItem[] = [];
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[0]);
              itens = parsed.itens ?? [];
            } catch (pErr) {
              console.error("JSON parse error:", pErr);
            }
          }

          const clean = itens
            .filter((i) => i && typeof i.valor === "number" && i.valor > 0)
            .map((i) => ({
              data: i.data ?? "",
              descricao: String(i.descricao ?? "").trim() || "Sem descrição",
              valor: Math.abs(Number(i.valor)),
              tipo: i.tipo === "receita" ? "receita" : "despesa",
              categoria: i.categoria || "Outros",
            }));

          return jsonResponse({ itens: clean }, 200);
        } catch (err: any) {
          console.error("[import-extrato] Fatal Server Error:", err);
          return jsonResponse(
            { error: err?.message ?? "Erro interno do servidor" },
            500
          );
        }
      },
    },
  },
});

function jsonResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs: any = await import(
    /* @vite-ignore */ "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs"
  );
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs";

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;
  let fullText = "";
  const maxPages = Math.min(pdf.numPages, 10);
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    fullText += content.items.map((item: any) => item.str).join(" ") + "\n";
  }
  return fullText;
}
