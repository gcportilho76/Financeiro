// Motor de cálculo do fluxo de caixa - puro TS, isomórfico

export type Receita = {
  id: string;
  competencia: string;
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: "PREVISTO" | "RECEBIDO";
};

export type Despesa = {
  id: string;
  competencia: string;
  data_venc: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: "PAGO" | "PENDENTE";
  tipo: "fixa" | "variavel" | "amortizacao" | "consignado";
  recorrente: boolean;
};

export type Cartao = {
  id: string;
  competencia: string;
  cartao: string;
  descricao: string;
  categoria: string;
  valor: number;
  status: "PAGO" | "PENDENTE";
  consolidado: boolean;
  ativo: boolean;
};

export type Contrato = {
  id: string;
  nome: string;
  banco: string | null;
  valor_parcela: number;
  parcela_atual: number;
  total_parcelas: number;
  saldo_devedor: number;
  ativo: boolean;
  ultimo_avanco: string | null;
};

export const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function diasNoMes(competencia: string) {
  // competencia 'YYYY-MM-01'
  const [y, m] = competencia.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function competenciaAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function proxCompetencia(c: string) {
  const [y, m] = c.split("-").map(Number);
  const d = new Date(y, m, 1); // m é 1-based mas Date é 0-based, então m = próximo
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatCompetencia(c: string) {
  const [y, m] = c.split("-").map(Number);
  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${meses[m - 1]}/${y}`;
}

// Soma cartões sem duplicidade: se uma fatura mãe consolidada tem filhos ativos detalhados na MESMA competência/cartão,
// o consolidado é desativado para evitar duplicidade. Aqui simplesmente somamos os ativos — o usuário decide ativar/desativar.
export function somaCartoesAtivos(cartoes: Cartao[]) {
  return cartoes.filter((c) => c.ativo).reduce((s, c) => s + Number(c.valor), 0);
}

export function calcular({
  saldoInicial,
  reservaMinima,
  receitas,
  despesas,
  cartoes,
  competencia,
  hojeStr = hojeISO(),
  reservasGuardadas = 0,
  salarioBase = 0,
}: {
  saldoInicial: number;
  reservaMinima: number;
  receitas: Receita[];
  despesas: Despesa[];
  cartoes: Cartao[];
  competencia: string;
  hojeStr?: string;
  reservasGuardadas?: number;
  salarioBase?: number;
}) {
  // Consignados são impacto neutro - já não contam como despesa cash
  const despesasCash = despesas.filter((d) => d.tipo !== "consignado");

  // Modo planejamento (calculado antes dos totais para aplicar a projeção de salário base)
  const totalDias = diasNoMes(competencia);
  const hojeComp = hojeStr.slice(0, 7) + "-01";
  let diasRestantes: number;
  let modoPlanejamento: boolean;
  if (competencia > hojeComp) {
    modoPlanejamento = true;
    diasRestantes = totalDias;
  } else if (competencia < hojeComp) {
    modoPlanejamento = false;
    diasRestantes = 0;
  } else {
    modoPlanejamento = false;
    const diaHoje = Number(hojeStr.slice(8, 10));
    diasRestantes = totalDias - diaHoje + 1;
  }

  const recebidos = receitas
    .filter((r) => r.status === "RECEBIDO")
    .reduce((s, r) => s + Number(r.valor), 0);
  const previstos = receitas
    .filter((r) => r.status === "PREVISTO")
    .reduce((s, r) => s + Number(r.valor), 0);
  // Mês futuro sem nenhuma receita lançada: projeta o salário base para
  // evitar Resultado do Mês com Receita = R$ 0,00 (saldo negativo irreal)
  const receitaProjetada =
    modoPlanejamento && receitas.length === 0 ? Math.max(0, Number(salarioBase)) : 0;
  const totalReceitas = recebidos + previstos + receitaProjetada;

  const despPagas = despesasCash
    .filter((d) => d.status === "PAGO")
    .reduce((s, d) => s + Number(d.valor), 0);
  const despPendentes = despesasCash
    .filter((d) => d.status === "PENDENTE")
    .reduce((s, d) => s + Number(d.valor), 0);
  const totalDespesasCash = despPagas + despPendentes;

  const cartoesAtivos = cartoes.filter((c) => c.ativo);
  const cartPagos = cartoesAtivos
    .filter((c) => c.status === "PAGO")
    .reduce((s, c) => s + Number(c.valor), 0);
  const cartPendentes = cartoesAtivos
    .filter((c) => c.status === "PENDENTE")
    .reduce((s, c) => s + Number(c.valor), 0);
  const totalCartoes = cartPagos + cartPendentes;

  // Saldo Vivo: apenas RECEBIDO e PAGO, menos o que foi guardado em caixinhas
  const saldoVivo = saldoInicial + recebidos - despPagas - cartPagos - reservasGuardadas;

  const totalPendentesGeral = despPendentes + cartPendentes;
  const margemBruta = saldoVivo - totalPendentesGeral - reservaMinima;
  const margemLivre = Math.max(0, margemBruta);
  const caixaLimite = margemBruta < 0;

  const dispDiaria = diasRestantes > 0 ? margemLivre / diasRestantes : 0;

  // Resultado Projetado = fluxo puro de caixa (reservas continuam sendo dinheiro seu, não são "gasto")
  const resultadoMes =
    saldoInicial + totalReceitas - totalDespesasCash - totalCartoes;

  // Patrimônio Total = saldo projetado (inclui o valor parado nas caixinhas)
  const patrimonioTotal = resultadoMes;

  return {
    saldoVivo,
    margemLivre,
    margemBruta,
    caixaLimite,
    diasRestantes,
    totalDias,
    modoPlanejamento,
    dispDiaria,
    recebidos,
    previstos,
    receitaProjetada,
    totalReceitas,
    despPagas,
    despPendentes,
    totalDespesasCash,
    cartPagos,
    cartPendentes,
    totalCartoes,
    resultadoMes,
    reservasGuardadas,
    patrimonioTotal,
  };
}

export function jurosSalvosTotais(eventos: { tipo: string; juros_salvos: number }[]) {
  return eventos
    .filter((e) => e.tipo === "amortizacao")
    .reduce((s, e) => s + Number(e.juros_salvos), 0);
}
