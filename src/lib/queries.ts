import { supabase } from "@/integrations/supabase/client";
import { calcular, type Receita, type Despesa, type Cartao, type Contrato } from "@/lib/finance";

function prevCompetencia(c: string) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function nextCompetencia(c: string) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}


export async function fetchAll(competencia: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("Não autenticado");

  const prev = prevCompetencia(competencia);

  const [
    profile, receitas, despesas, cartoes, contratos, eventos, insumos, cartoesRegistry, reservas,
    saldosRows, receitasHist, despesasHist, cartoesHist,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("receitas").select("*").eq("competencia", competencia).order("data"),
    supabase.from("despesas").select("*").eq("competencia", competencia).order("data_venc"),
    supabase.from("cartoes_lancamentos").select("*").eq("competencia", competencia).order("created_at"),
    supabase.from("consignados_contratos").select("*").eq("ativo", true).order("nome"),
    supabase.from("consignados_eventos").select("*").order("created_at", { ascending: false }),
    (supabase.from as any)("insumos").select("*").eq("competencia", competencia).order("validade", { ascending: true, nullsFirst: false }),
    (supabase.from as any)("cartoes_registry").select("*").order("nome"),
    (supabase.from as any)("reservas").select("*").lte("competencia", competencia).order("created_at", { ascending: false }),
    (supabase.from as any)("saldos_mensais").select("*").lte("competencia", competencia).order("competencia"),
    supabase.from("receitas").select("*").lt("competencia", competencia),
    supabase.from("despesas").select("*").lt("competencia", competencia),
    supabase.from("cartoes_lancamentos").select("*").lt("competencia", competencia),
  ]);

  const salarioBase = Number((profile.data as any)?.salario_base ?? 11000);
  const saldos = (saldosRows.data ?? []) as any[];
  const saldoMesRow = saldos.find((s) => s.competencia === competencia) ?? null;

  // Encadeia o saldo inicial mês a mês a partir da última âncora salva
  // (ou do saldo inicial do perfil), para não perder o histórico anterior.
  const meses = Array.from(
    new Set([
      ...((receitasHist.data ?? []) as any[]).map((r) => r.competencia),
      ...((despesasHist.data ?? []) as any[]).map((d) => d.competencia),
      ...((cartoesHist.data ?? []) as any[]).map((c) => c.competencia),
      ...saldos.filter((s) => s.competencia < competencia).map((s) => s.competencia),
    ]),
  ).sort();

  let saldoCorrente = Number(profile.data?.saldo_inicial ?? 0);
  let cursor = meses[0] ?? prev;
  while (cursor < competencia) {
    const ancora = saldos.find((s) => s.competencia === cursor);
    if (ancora) saldoCorrente = Number(ancora.saldo_inicial);
    const calc = calcular({
      saldoInicial: saldoCorrente,
      reservaMinima: 0,
      receitas: ((receitasHist.data ?? []) as Receita[]).filter((r) => r.competencia === cursor),
      despesas: ((despesasHist.data ?? []) as Despesa[]).filter((d) => d.competencia === cursor),
      cartoes: ((cartoesHist.data ?? []) as Cartao[]).filter((c) => c.competencia === cursor),
      competencia: cursor,
      salarioBase,
    });
    saldoCorrente = calc.resultadoMes;
    cursor = nextCompetencia(cursor);
  }
  const defaultSaldo = saldoCorrente;

  const hasSaldoRow = !!saldoMesRow;
  const saldoInicialMes = hasSaldoRow
    ? Number(saldoMesRow.saldo_inicial)
    : defaultSaldo;


  return {
    profile: profile.data,
    receitas: (receitas.data ?? []) as Receita[],
    despesas: (despesas.data ?? []) as Despesa[],
    cartoes: (cartoes.data ?? []) as Cartao[],
    contratos: (contratos.data ?? []) as Contrato[],
    eventos: eventos.data ?? [],
    insumos: (insumos.data ?? []) as any[],
    cartoesRegistry: (cartoesRegistry.data ?? []) as any[],
    reservas: (reservas.data ?? []) as any[],
    saldoInicialMes,
    hasSaldoRow,
    defaultSaldoFromPrev: defaultSaldo,
    userId,
  };
}
