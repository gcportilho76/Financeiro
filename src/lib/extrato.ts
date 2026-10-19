import { supabase } from "@/integrations/supabase/client";

export interface TransacaoExtrato {
  data: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  categoria?: string;
}

/**
 * Função para enviar o texto ou ficheiro do extrato ao Gemini e obter os dados classificados
 */
export async function processarExtratoComGemini(
  conteudoExtrato: string,
  geminiApiKey: string
): Promise<TransacaoExtrato[]> {
  if (!geminiApiKey) {
    throw new Error("Chave de API do Gemini não fornecida.");
  }

  const prompt = `
    Você é um assistente financeiro especializado em análise de extratos bancários.
    Analise o texto do extrato bancário a seguir e extraia todas as transações financeiras.
    
    Para cada transação, identifique:
    - data: Data no formato YYYY-MM-DD
    - descricao: Descrição limpa do lançamento
    - valor: Valor numérico positivo
    - tipo: "receita" para entradas/créditos e "despesa" para saídas/débitos
    - categoria: Sugira uma categoria apropriada (ex: Alimentação, Transporte, Moradia, Lazer, Salário, Investimentos, Outros)

    Responda EXCLUSIVAMENTE em formato JSON com o seguinte esquema:
    [
      {
        "data": "2026-10-15",
        "descricao": "Supermercado X",
        "valor": 150.50,
        "tipo": "despesa",
        "categoria": "Alimentação"
      }
    ]

    Texto do Extrato:
    ${conteudoExtrato}
  `;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || "Falha ao comunicar com a API do Gemini");
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("A resposta da API do Gemini veio vazia.");
    }

    const transacoes: TransacaoExtrato[] = JSON.parse(rawText);
    return transacoes;
  } catch (error: any) {
    console.error("Erro ao processar extrato com o Gemini:", error);
    throw error;
  }
}

/**
 * Função para guardar as transações categorizadas no Supabase
 */
export async function salvarTransacoesNoSupabase(
  transacoes: TransacaoExtrato[],
  userId: string
) {
  const payload = transacoes.map((t) => ({
    user_id: userId,
    date: t.data,
    description: t.descricao,
    amount: t.valor,
    type: t.tipo,
    category: t.categoria || "Outros",
  }));

  const { data, error } = await supabase.from("transactions").insert(payload);

  if (error) {
    throw new Error(`Erro ao salvar no banco de dados: ${error.message}`);
  }

  return data;
}
