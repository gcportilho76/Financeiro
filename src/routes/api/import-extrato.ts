import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ExtractedItem = {
  data: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  categoria: string;
};

const SYSTEM_PROMPT = `Você é um especialista em ler extratos bancários e faturas de cartão de crédito brasileiros.
Analise o documento fornecido e extraia TODAS as transações financeiras visíveis.

Para cada transação, retorne:
- data: no formato YYYY-MM-DD (se o documento não tiver o ano, use o ano atual)
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

export const Route = createFileRoute("/api/import-extrato")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          // ─── Auth ───────────────────────────────────────────
          const authHeader = request.headers.get("authorization");
          if (!authHeader) {
            return jsonResponse({ error: "Unauthorized" }, 401);
          }

          // ─── Env validation (early, explicit) ───────────────
          const supabaseUrl =
            import.meta.env.VITE_SUPABASE_URL ||
            process.env.SUPABASE_URL ||
            process.env.VITE_SUPABASE_URL;
          const publishableKey =
            import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            import.meta.env.VITE_SUPABASE_ANON_KEY ||
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.VITE_SUPABASE_ANON_KEY;
          const geminiKey = process.env["GEMINI_API_KEY"];

          if (!geminiKey) {
            return jsonResponse(
              { error: "GEMINI_API_KEY não configurada no servidor" },
              400,
            );
          }

          if (!supabaseUrl || !publishableKey) {
            return jsonResponse(
              { error: "SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) não configurados no servidor" },
              500,
            );
          }

          // ─── Supabase client (user-scoped) ──────────────────
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

          // ─── File validation ────────────────────────────────
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

          // ─── Convert file to base64 ─────────────────────────
          const base64 = await fileToBase64(file);
          const dataUrl = `data:${file.type};base64,${base64}`;

          // ─── Optional PDF text extraction ───────────────────
          let rawText = "";
          if (file.type === "application/pdf") {
            try {
              rawText = await extractPdfText(file);
            } catch {
              rawText = "";
            }
          }

          // ─── Safe SDK init (inside request) ────────────────
          let model: any;
          try {
            const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
            const google = createGoogleGenerativeAI({ apiKey: geminiKey });
            model = google("gemini-1.5-flash");
          } catch (sdkErr: any) {
            console.error("Failed to init Google Gemini SDK:", sdkErr);
            return jsonResponse(
              { error: `Falha ao inicializar o SDK do Gemini: ${sdkErr?.message ?? String(sdkErr)}` },
              500,
            );
          }

          // ─── Build AI request content ───────────────────────
          const year = new Date().getFullYear();
          const prompt = SYSTEM_PROMPT.replace("o ano atual", `o ano atual ${year}`);

          const userContent: any[] = [
            {
              type: "text",
              text: rawText
                ? `Texto extraído do PDF (use como referência, mas confira no documento visual):\n\n${rawText}\n\nAgora extraia todas as transações do documento.`
                : "Extraia todas as transações financeiras deste documento.",
            },
            {
              type: "image",
              image: dataUrl,
            },
          ];

          // ─── Call Gemini ────────────────────────────────────
          let itens: ExtractedItem[] = [];
          try {
            const { generateText } = await import("ai");
            const result = await generateText({
              model,
              system: prompt,
              messages: [{ role: "user", content: userContent }],
            });

            const text = result.text.trim();
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              itens = parsed.itens ?? [];
            }
          } catch (aiErr: any) {
            console.error("AI extraction error:", aiErr);
            return jsonResponse(
              {
                error: `Erro ao processar o documento com Gemini: ${aiErr?.message ?? String(aiErr)}`,
              },
              502,
            );
          }

          // ─── Clean & validate extracted items ──────────────
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
        } catch (err: any) {
          // ─── Global catch-all ────────────────────────────────
          console.error("[import-extrato] Unhandled error:", err);
          return jsonResponse(
            { error: err?.message ?? String(err) ?? "Erro interno do servidor" },
            500,
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
