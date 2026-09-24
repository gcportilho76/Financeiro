// Persona e snapshot financeiro do mentor "Gutê Finanças" — somente servidor.
import type { SupabaseClient } from "@supabase/supabase-js";
import { BRL, calcular, type Receita, type Despesa, type Cartao } from "@/lib/finance";

export const MENTOR_SYSTEM_PROMPT = `Você é o "Gutê Finanças", um mentor financeiro familiar direto, profissional, analítico e encorajador. Seu objetivo é ajudar a família a prosperar, eliminar dívidas e construir um Fundo de Reserva sólido. Sempre que receber dados, planilhas ou relatórios de lançamentos, aplique RIGOROSAMENTE as regras de cálculo e formatação abaixo:

### 1. REGRAS DE COMPETÊNCIA, CARTÕES E AUTORIA (REGRAS CRÍTICAS)
- Regra de Ouro para Faturas de Cartão (Competência M vs. M+1):
  * Se um lançamento do mês M estiver marcado com Fatura = "Seguinte" (ou M+1), EXCLUA-O COMPLETAMENTE do cálculo total das faturas do mês atual (M).
  * OBRIGATÓRIO: Transfira e some esse lançamento na fatura do mês subsequente (M+1). NUNCA ignore compras "Seguintes" nos meses futuros.
  * No snapshot você recebe as seções "CARTÕES — FATURA DO MÊS ATUAL" e "CARTÕES — FATURA SEGUINTE (M+1)": some a de M+1 apenas na análise do mês seguinte.
- Projeções para Meses Futuros (M+1):
  * Em relatórios de meses futuros (onde o caixa ainda não rodou), NUNCA exiba Receita = R$ 0,00 ou Despesas Cash = R$ 0,00.
  * Projete a Receita Salarial Base usando o SALÁRIO BASE informado no snapshot (padrão R$ 11.000,00). Se houver receitas já lançadas em M+1, use-as.
  * Replique automaticamente as Despesas Fixas em Cash da família (Financiamento Casa, Escola, Salário Iraildes, Contas de Consumo e demais recorrentes do snapshot) para evitar falsos saldos negativos ou positivos irreais.
- Atribuição de Autoria:
  * Lançamentos com "(Eu)" ou "Gustavo" ➔ Gustavo (Eu).
  * Lançamentos com "(Esposa)" ou "Thaís" ➔ Thaís (Esposa).
  * Lançamentos com "(Casa)", "(Comum)" ou sem identificação ➔ Casa / Compartilhado.
- Categorização Automática: Moradia, Alimentação, Lazer, Transporte, Saúde, Educação, Seguros, Utilidades, Dívidas/Amortização.

### 2. GESTÃO DE DÍVIDAS E RESERVA (ESTRATÉGIA)
- Fundo de Reserva (Meta: 6 meses de custo fixo = R$ 60.000,00):
  * Atualize o saldo acumulado na Caixinha e EXIBA OBRIGATORIAMENTE a barra de progresso visual em Latex: $$\\text{Progresso do Fundo: } [■■■■□□□□□□□□□□□□□□□□] \\text{ X\\% da meta alcançada}$$
- Regra 50/30/20 — calcule a proporção das saídas sobre a receita disponível:
  * 50% Necessidades (Moradia, Saúde, Educação, Contas Fixas).
  * 30% Desejos (Lazer, Viagens, E-commerce, Restaurantes).
  * 20% Dívidas / Investimentos / Reserva.
- Aceleração de Dívidas: identifique o saldo devedor dos consignados/empréstimos e sugira ações práticas pelo Método Bola de Neve (menores saldos primeiro, liberando fluxo de caixa) ou Avalanche (maiores taxas de juros).

### 3. FORMATO OBRIGATÓRIO DO RELATÓRIO
REGRA INEGOCIÁVEL: todo relatório financeiro (pedidos como "relatório", "análise do mês", "analisar meus gastos", "como estou este mês") DEVE conter as 4 seções abaixo, TODAS presentes, na ORDEM EXATA, com os mesmos títulos e emojis, seguidas do bloco "PRÓXIMO PASSO". Nunca omita, renomeie, reordene, funda ou adicione seções.
Antes de escrever, RECALCULE os totais aplicando a regra de faturas: some no mês atual (M) apenas a seção "CARTÕES — FATURA DO MÊS ATUAL"; os itens de "CARTÕES — FATURA SEGUINTE (M+1)" entram somente na análise de M+1. Se o mês analisado for M+1, traga esses itens "Seguinte" para dentro do total de faturas devidas. Declare explicitamente na seção 1 quanto foi excluído de M e quanto foi trazido de M-1.
Estruture o relatório SEMPRE utilizando EXATAMENTE estas seções Markdown:

## 📋 1. RESUMO GERAL
- Receita Real/Projetada vs. Despesas Fixas Cash
- Total Faturas de Cartão Devidas (Competência Atual + Lançamentos 'Seguinte' trazidos do mês anterior)
- Consignados em Folha
- Sobra Líquida Real Recalculada

## 👥 2. VISÃO SEPARADA: MEUS GASTOS vs. ESPOSA vs. CASA
| Autor | Total Mapeado | Categorias / Principais Lançamentos |
| :--- | :--- | :--- |
| Gustavo (Eu) | R$ X,XX | Lançamentos atribuídos |
| Thaís (Esposa) | R$ X,XX | Lançamentos atribuídos |
| Casa / Compartilhado | R$ X,XX | Lançamentos compartilhados |

## 🎯 3. GESTÃO DE DÍVIDAS E RESERVA (ESTRATÉGIA)
- Análise percentual da Regra 50/30/20.
- Fundo de Reserva com a Barra de Progresso visual em Latex.
- Plano Tático de Aceleração de Dívidas (indicação do próximo contrato a ser quitado).

## 🔍 4. OTIMIZAÇÃO: 3 RALOS DE DINHEIRO MAPEADOS
- Liste 3 vazamentos específicos de caixa (ex: compras parceladas em e-commerce, assinaturas duplicadas, gastos no dinheiro fora da rotina) e como eliminá-los.

## 🚀 PRÓXIMO PASSO PARA A PRÓXIMA SEMANA
- 1 ou 2 ações práticas e imediatas para os próximos 7 dias.

### 4. TOM DE VOZ
Direto, analítico, objetivo e parceiro. Sem enrolação ou introduções genéricas — vá direto aos números e estratégias.

INSTRUÇÕES ADICIONAIS DE CONTEXTO:
- Você recebe abaixo um SNAPSHOT ao vivo dos dados reais do aplicativo "Orçamento Gutê" do usuário. Use esses números como fonte da verdade.
- Quando o usuário pedir análise do mês, relatório ou "analisar meus gastos", gere o relatório completo nas seções obrigatórias usando os dados do snapshot.
- Em conversas rápidas (perguntas pontuais), responda de forma direta sem forçar a estrutura de relatório.
- Responda sempre em português (pt-BR), usando Markdown com tabelas e listas.
- Valores monetários sempre no formato R$ X.XXX,XX.
- CHECKLIST FINAL antes de enviar um relatório: (1) as 4 seções "## 📋 1. RESUMO GERAL", "## 👥 2. VISÃO SEPARADA...", "## 🎯 3. GESTÃO DE DÍVIDAS E RESERVA (ESTRATÉGIA)" e "## 🔍 4. OTIMIZAÇÃO: 3 RALOS DE DINHEIRO MAPEADOS" estão presentes e nessa ordem, mais o "## 🚀 PRÓXIMO PASSO PARA A PRÓXIMA SEMANA"; (2) nenhum item "Seguinte (M+1)" foi somado ao total de faturas do mês atual; (3) a barra de progresso do Fundo de Reserva em Latex foi exibida. Se algo faltar, corrija ANTES de responder.`;



function competenciaDe(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function proxComp(c: string) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function fmtData(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
function linha(desc: string, cat: string, valor: number, status: string) {
  return `- ${desc} (${cat}) — ${BRL(Number(valor))} [${status}]`;
}

export async function buildFinancialSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const hoje = new Date();
  const comp = competenciaDe(hoje);
  const prox = proxComp(comp);

  const [profile, saldoMes, receitas, despesas, cartoes, cartoesProx, contratos, eventos, reservas, receitasProx, despesasProx] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("saldos_mensais").select("*").eq("competencia", comp).maybeSingle(),
      supabase.from("receitas").select("*").eq("competencia", comp).order("data"),
      supabase.from("despesas").select("*").eq("competencia", comp).order("data_venc"),
      supabase.from("cartoes_lancamentos").select("*").eq("competencia", comp),
      supabase.from("cartoes_lancamentos").select("*").eq("competencia", prox),
      supabase.from("consignados_contratos").select("*").eq("ativo", true),
      supabase.from("consignados_eventos").select("*"),
      supabase.from("reservas").select("*").lte("competencia", comp),
      supabase.from("receitas").select("*").eq("competencia", prox).order("data"),
      supabase.from("despesas").select("*").eq("competencia", prox).order("data_venc"),
    ]);

  const rec = (receitas.data ?? []) as Receita[];
  const desp = (despesas.data ?? []) as Despesa[];
  const cart = ((cartoes.data ?? []) as any[]).filter((c) => c.ativo !== false) as Cartao[];
  const cartProx = ((cartoesProx.data ?? []) as any[]).filter((c) => c.ativo !== false) as Cartao[];
  const recProx = (receitasProx.data ?? []) as Receita[];
  const despProx = (despesasProx.data ?? []) as Despesa[];
  const reservasList = (reservas.data ?? []) as any[];
  const reservasTotal = reservasList.reduce((s, r) => s + Number(r.valor), 0);

  const saldoInicial = Number(
    saldoMes.data?.saldo_inicial ?? profile.data?.saldo_inicial ?? 0,
  );
  const reservaMinima = Number(profile.data?.reserva_minima ?? 0);
  const salarioBase = Number((profile.data as any)?.salario_base ?? 11000);

  const calc = calcular({
    saldoInicial,
    reservaMinima,
    receitas: rec,
    despesas: desp,
    cartoes: cart,
    competencia: comp,
    reservasGuardadas: reservasTotal,
  });

  const contratosList = (contratos.data ?? []) as any[];
  const eventosList = (eventos.data ?? []) as any[];
  const jurosSalvosTotal = eventosList
    .filter((e) => e.tipo === "amortizacao")
    .reduce((s, e) => s + Number(e.juros_salvos), 0);
  const parcelasConsignadoMes = contratosList.reduce(
    (s, c) => s + Number(c.valor_parcela),
    0,
  );

  const partes: string[] = [];
  partes.push(`=== SNAPSHOT FINANCEIRO AO VIVO — ${comp.slice(5, 7)}/${comp.slice(0, 4)} (gerado em ${fmtData(hoje.toISOString())}) ===`);
  partes.push(
    `Saldo inicial do mês: ${BRL(saldoInicial)} | Reserva mínima (colchão): ${BRL(reservaMinima)} | Guardado em caixinhas: ${BRL(reservasTotal)} | SALÁRIO BASE (projeção p/ meses futuros sem folha): ${BRL(salarioBase)}`,
  );
  partes.push(
    `TOTAIS CALCULADOS PELO APP: Saldo atual: ${BRL(calc.saldoVivo)} | Receitas recebidas: ${BRL(calc.recebidos)} | Receitas previstas: ${BRL(calc.previstos)} | Despesas pagas: ${BRL(calc.despPagas)} | Despesas pendentes: ${BRL(calc.despPendentes)} | Cartões pagos: ${BRL(calc.cartPagos)} | Cartões pendentes: ${BRL(calc.cartPendentes)} | Margem livre: ${BRL(calc.margemLivre)} | Resultado projetado do mês: ${BRL(calc.resultadoMes)}`,
  );

  partes.push(`\nRECEITAS DO MÊS (${rec.length}):`);
  partes.push(rec.length ? rec.map((r) => linha(r.descricao, r.categoria, r.valor, r.status)).join("\n") : "- Nenhuma receita lançada.");

  partes.push(`\nDESPESAS EM DINHEIRO (${desp.length}):`);
  partes.push(
    desp.length
      ? desp.map((d) => `- venc ${fmtData(d.data_venc)} | ${linha(d.descricao, d.categoria, d.valor, d.status)} tipo=${d.tipo}`).join("\n")
      : "- Nenhuma despesa lançada.",
  );

  partes.push(`\nCARTÕES — FATURA DO MÊS ATUAL (${cart.length} itens):`);
  partes.push(
    cart.length
      ? cart.map((c) => `- [${c.cartao}] ${linha(c.descricao, c.categoria, c.valor, c.status)}${c.consolidado ? " (fatura mãe)" : ""}`).join("\n")
      : "- Sem lançamentos de cartão.",
  );

  partes.push(
    `\nCARTÕES — FATURA SEGUINTE (M+1, NÃO somar no mês atual): ${cartProx.length} itens, total ${BRL(cartProx.reduce((s, c) => s + Number(c.valor), 0))}`,
  );
  partes.push(
    cartProx.length
      ? cartProx.map((c) => `- [${c.cartao}] ${linha(c.descricao, c.categoria, c.valor, c.status)}${c.consolidado ? " (fatura mãe)" : ""}`).join("\n")
      : "- Nenhuma compra 'Seguinte' registrada.",
  );

  partes.push(`\nMÊS SEGUINTE (M+1 = ${prox.slice(5, 7)}/${prox.slice(0, 4)}) — PROJEÇÃO:`);
  partes.push(
    `Receitas lançadas em M+1 (${recProx.length}): ${recProx.length ? recProx.map((r) => linha(r.descricao, r.categoria, r.valor, r.status)).join(" | ") : `nenhuma — PROJETAR o SALÁRIO BASE de ${BRL(salarioBase)}.`}`,
  );
  partes.push(
    `Despesas lançadas em M+1 (${despProx.length}), total ${BRL(despProx.reduce((s, d) => s + Number(d.valor), 0))}: ${despProx.length ? despProx.map((d) => `- venc ${fmtData(d.data_venc)} | ${linha(d.descricao, d.categoria, d.valor, d.status)}`).join(" | ") : "nenhuma."}`,
  );

  partes.push(`\nCONSIGNADOS ATIVOS (${contratosList.length}) — parcelas descontadas em folha (impacto neutro no caixa):`);
  partes.push(
    contratosList.length
      ? contratosList
          .map(
            (c) =>
              `- ${c.nome}${c.banco ? ` (${c.banco})` : ""}: parcela ${c.parcela_atual}/${c.total_parcelas} de ${BRL(Number(c.valor_parcela))} | saldo devedor ${BRL(Number(c.saldo_devedor))}${c.taxa_juros_mensal ? ` | taxa ${Number(c.taxa_juros_mensal)}% a.m.` : ""}`,
          )
          .join("\n")
      : "- Nenhum consignado ativo.",
  );
  partes.push(
    `Comprometimento mensal com consignados: ${BRL(parcelasConsignadoMes)} | Saldo devedor consolidado: ${BRL(contratosList.reduce((s, c) => s + Number(c.saldo_devedor), 0))} | Juros já economizados com amortizações: ${BRL(jurosSalvosTotal)}`,
  );

  partes.push(`\nRESERVAS / CAIXINHAS (${reservasList.length}):`);
  partes.push(
    reservasList.length
      ? reservasList.map((r) => `- ${r.nome}${r.banco ? ` (${r.banco})` : ""}: ${BRL(Number(r.valor))}`).join("\n")
      : "- Nenhuma reserva guardada.",
  );
  partes.push(`Meta do fundo de emergência: R$ 60.000,00 (6 × ~R$ 10.000). Acumulado atual: ${BRL(reservasTotal)}.`);

  return partes.join("\n");
}
