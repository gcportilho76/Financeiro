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

// Mapeia e sanitiza lançamentos para o tipo Cartao com proteção contra NaN e ativo nulo
function mapCartaoLancamento(item: any): Cartao {
  return {
    ...item,
    valor: Number(item.valor) || 0,
    ativo: item.ativo !== false,
  };
}

export async function fetchAll(competencia: string) {
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) throw new Error("Não autenticado");

  const prev = prevCompetencia(competencia);
  const compCurta = competencia.slice(0, 7); // Ex: "2026-10"

  const [
    profile, receitas, despesas, cartoesLancamentosRes, contratos, eventos, insumos, cartoesCadastrados, reservas,
    saldosRows, receitasHist, despesasHist, cartoesHistRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("receitas").select("*").eq("competencia", competencia).order("data"),
    supabase.from("despesas").select("*").eq("competencia", competencia).order("data_venc"),
    
    // Consulta direta dos lançamentos sem restrição de OR frágil
    supabase.from("cartoes_lancamentos")
      .select("*")
      .order("created_at"),

    supabase.from("consignados_contratos").select("*").eq("ativo", true).order("nome"),
    supabase.from("consignados_eventos").select("*").order("created_at", { ascending: false }),
    (supabase.from as any)("insumos").select("*").eq("competencia", competencia).order("validade", { ascending: true, nullsFirst: false }),
    (supabase.from as any)("cartoes").select("*").order("nome"),
    (supabase.from as any)("reservas").select("*").lte("competencia", competencia).order("created_at", { ascending: false }),
    (supabase.from as any)("saldos_mensais").select("*").lte("competencia", competencia).order("competencia"),
    supabase.from("receitas").select("*").lt("competencia", competencia),
    supabase.from("despesas").select("*").lt("competencia", competencia),
    
    // Consulta histórica dos lançamentos
    supabase.from("cartoes_lancamentos")
      .select("*")
      .lt("competencia", competencia),
  ]);

  // Filtragem local inteligente de competência (suporta 'YYYY-MM-DD' e 'YYYY-MM')
  const todosLancamentos = (cartoesLancamentosRes.data ?? []).map(mapCartaoLancamento);
  const cartoesAtuaisSanitizados = todosLancamentos.filter(
    (c: any) => c.competencia === competencia || c.competencia === compCurta
  );

  const cartoesHistSanitizados = (cartoesHistRes.data ?? []).map(mapCartaoLancamento);

  const salarioBase = Number((profile.data as any)?.salario_base ?? 11000);
  const saldos = (saldosRows.data ?? []) as any[];
  const saldoMesRow = saldos.find((s) => s.competencia === competencia) ?? null;

  const meses = Array.from(
    new Set([
      ...((receitasHist.data ?? []) as any[]).map((r) => r.competencia),
      ...((despesasHist.data ?? []) as any[]).map((d) => d.competencia),
      ...cartoesHistSanitizados.map((c) => c.competencia),
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
      cartoes: cartoesHistSanitizados.filter((c) => c.competencia === cursor),
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

  const contratosAtivos = (contratos.data ?? []) as any[];

  const despesasReais = (despesas.data ?? []) as Despesa[];
  const consignadosSinteticos: Despesa[] = [];
  for (const ct of contratosAtivos) {
    if (!ct.ativo || ct.parcela_atual >= ct.total_parcelas) continue;
    const jaExiste = despesasReais.some(
      (d) => d.tipo === "consignado" && d.descricao === ct.nome && String(d.competencia) === competencia,
    );
    if (!jaExiste) {
      consignadosSinteticos.push({
        id: `sint-${ct.id}`,
        competencia,
        data_venc: competencia,
        descricao: ct.nome,
        categoria: "Consignado",
        valor: Number(ct.valor_parcela) || 0,
        status: "PENDENTE",
        tipo: "consignado",
        recorrente: true,
      } as Despesa);
    }
  }
  const despesasCompletas = [...despesasReais, ...consignadosSinteticos];

  return {
    profile: profile.data,
    receitas: (receitas.data ?? []) as Receita[],
    despesas: despesasCompletas,
    cartoes: cartoesAtuaisSanitizados,
    cartoesLancamentos: cartoesAtuaisSanitizados,
    contratos: contratosAtivos as Contrato[],
    eventos: eventos.data ?? [],
    insumos: (insumos.data ?? []) as any[],
    cartoesRegistry: (cartoesCadastrados.data ?? []) as any[],
    reservas: (reservas.data ?? []) as any[],
    saldoInicialMes,
    hasSaldoRow,
    defaultSaldoFromPrev: defaultSaldo,
    userId,
  };
}