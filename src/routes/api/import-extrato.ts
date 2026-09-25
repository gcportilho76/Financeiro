import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

type ExtractedItem = {
  data: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  categoria: string;
};

export const Route = createFileRoute("/api/import-extrato")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];

        if (!supabaseUrl || !publishableKey || !lovableKey) {
          return jsonResponse({ error: "Servidor mal configurado" }, 500);
        }

        const supabase = createClient(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: authHeader } },
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }

        const formData = await request.formData();
        const file = formData.get("file");
        if (!file || !(file instanceof File)) {
          return jsonResponse({ error: "Arquivo não encontrado no upload" }, 400);
        }

        const maxBytes = 15 * 1024 * 1024;
        if (file.size > maxBytes) {
          return jsonResponse({ error: "Arquivo muito grande (máx 15 MB)" }, 400);
        }

        const allowedTypes = [
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif",
        ];
        if (!allowedTypes.includes(file.type)) {
          return jsonResponse(
            { error: `Tipo de arquivo não suportado: ${file.type}. Use PDF, PNG, JPG ou WEBP.` },
            400,
          );
        }

        const base64 = await fileToBase64(file);
        const dataUrl = `data:${file.type};base64,${base64}`;

        const gateway = createLovableAiGatewayProvider(lovableKey);
        const model = gateway.responses("openai/gpt-4o");

        const systemPrompt = `Você é um especialista em ler extratos bancários e faturas de cartão de crédito brasileiros.
Analise o documento fornecido e extraia TODAS as transações financeiras visíveis.

Para cada transação, retorne:
- data: no formato YYYY-MM-DD (se o documento não tiver o ano, use o ano atual ${new Date().getFullYear()})
- descricao: texto limpo da transação (sem espaços extras)
- valor: número positivo (sem formatação, ex: 1234.56)
- tipo: "receita" para entradas/créditos ou "despesa" para saídas/débitos
- categoria: uma categoria adequada entre: Habitação, Alimentação, Transporte, Educação, Saúde, Lazer, Cartão, Salário, Freelance, Investimentos, Amortização, Outros

REGRAS:
- Ignore cabeçalhos, rodapés e linhas de saldo/totais.
- Para faturas de cartão, todas as transações são "despesa".
- Para extratos bancários, depósitos/transferências recebidas = "receita"; pagamentos/débitos/saques = "despesa".
- Se a data estiver ilegível, use uma string vazia "".
- Se o valor estiver ilegível, use 0.
- Não invente dados. Se não conseguir ler um campo, use valores vazios.

Responda APENAS com um JSON válido no formato:
{"itens": [{"data": "2025-01-15", "descricao": "Supermercado X", "valor": 150.50, "tipo": "despesa", "categoria": "Alimentação"}, ...]}

Se não houver transações, retorne: {"itens": []}`;

        let rawText: string;

        try {
          if (file.type === "application/pdf") {
            rawText = await extractPdfText(file);
          } else {
            rawText = "";
          }
        } catch {
          rawText = "";
        }

        const userContent: any[] = [
          {
            type: "text",
            text: rawText
              ? `Texto extraído do PDF (use como referência, mas confira no documento visual):\n\n${rawText}\n\nAgora extraia todas as transações do documento.`
              : "Extraia todas as transações financeiras deste documento.",
          },
        ];

        if (file.type === "application/pdf" && rawText) {
          // PDF with extracted text — send text only to save tokens
        } else {
          // Image or textless PDF — send as image
          userContent.push({
            type: "file",
            filename: file.name,
            file_data: dataUrl,
          } as any);
        }

        // For PDFs we also send the image so GPT-4o can see tables/layouts
        if (file.type === "application/pdf") {
          userContent.push({
            type: "file",
            filename: file.name,
            file_data: dataUrl,
          } as any);
        }

        let itens: ExtractedItem[] = [];

        try {
          const { generateText } = await import("ai");
          const result = await generateText({
            model,
            system: systemPrompt,
            messages: [{ role: "user", content: userContent }],
          });

          const text = result.text.trim();
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            itens = parsed.itens ?? [];
          }
        } catch (e: any) {
          console.error("AI extraction error:", e);
          return jsonResponse(
            { error: "Não consegui ler o documento com a IA. Tente novamente com uma imagem mais nítida." },
            502,
          );
        }

        const clean = itens
          .filter(
            (i) =>
              i &&
              typeof i.valor === "number" &&
              i.valor > 0 &&
              (i.tipo === "receita" || i.tipo === "despesa"),
          )
          .map((i) => ({
            data: i.data ?? "",
            descricao: String(i.descricao ?? "").trim() || "Sem descrição",
            valor: Math.abs(Number(i.valor)),
            tipo: i.tipo,
            categoria: i.categoria || "Outros",
          }));

        return jsonResponse({ itens: clean }, 200);
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
  // Dynamic import of pdfjs-dist in the server runtime (Deno/V8).
  // If unavailable, we fall back to sending the raw PDF as image to GPT-4o.
  try {
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
  } catch {
    return "";
  }
}
