// Dados fictícios (mock) para visualizar e editar todas as telas sem
// precisar de login/Supabase. `buildMockData` recebe a competência atual
// selecionada e carimba os lançamentos nela, para que apareçam no mês em foco.

import type { Receita, Despesa, Cartao, Contrato } from "@/lib/finance";

export const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";

function iso(competencia: string, dia: number) {
  const [y, m] = competencia.split("-").map(Number);
  return `${y}-${String(m).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

export function buildMockData(competencia: string) {
  const profile = {
    id: MOCK_USER_ID,
    saldo_inicial: 5000,
    reserva_minima: 2000,
    salario_base: 11000,
    updated_at: new Date().toISOString(),
  };

  const receitas: Receita[] = [
    {
      id: "rec-1",
      competencia,
      data: iso(competencia, 5),
      descricao: "Salário",
      categoria: "Salário",
      valor: 11000,
      status: "RECEBIDO",
    },
    {
      id: "rec-2",
      competencia,
      data: iso(competencia, 15),
      descricao: "Projeto freelance",
      categoria: "Freelance",
      valor: 2500,
      status: "PREVISTO",
    },
  ];

  const despesas: Despesa[] = [
    {
      id: "desp-1",
      competencia,
      data_venc: iso(competencia, 10),
      descricao: "Aluguel",
      categoria: "Habitação",
      valor: 2800,
      status: "PAGO",
      tipo: "fixa",
      recorrente: true,
    },
    {
      id: "desp-2",
      competencia,
      data_venc: iso(competencia, 12),
      descricao: "Supermercado",
      categoria: "Alimentação",
      valor: 1200,
      status: "PENDENTE",
      tipo: "variavel",
      recorrente: false,
    },
    {
      id: "desp-3",
      competencia,
      data_venc: iso(competencia, 8),
      descricao: "Combustível",
      categoria: "Transporte",
      valor: 600,
      status: "PAGO",
      tipo: "variavel",
      recorrente: false,
    },
    {
      id: "desp-4",
      competencia,
      data_venc: iso(competencia, 20),
      descricao: "Parcela consignado",
      categoria: "Consignado",
      valor: 850,
      status: "PENDENTE",
      tipo: "consignado",
      recorrente: true,
    },
  ];

  const cartoes: Cartao[] = [
    {
      id: "cart-1",
      competencia,
      cartao: "Nubank",
      descricao: "Compras diversas",
      categoria: "Lazer",
      valor: 1500,
      status: "PENDENTE",
      consolidado: true,
      ativo: true,
    },
    {
      id: "cart-2",
      competencia,
      cartao: "Itaú",
      descricao: "Assinaturas",
      categoria: "Outros",
      valor: 320,
      status: "PAGO",
      consolidado: true,
      ativo: true,
    },
  ];

  const contratos: Contrato[] = [
    {
      id: "contr-1",
      nome: "Consignado Banco X",
      banco: "Banco X",
      valor_parcela: 850,
      parcela_atual: 12,
      total_parcelas: 48,
      saldo_devedor: 30600,
      ativo: true,
      ultimo_avanco: null,
    },
  ];

  const eventos = [
    {
      id: "ev-1",
      user_id: MOCK_USER_ID,
      contrato_id: "contr-1",
      competencia,
      tipo: "amortizacao",
      juros_salvos: 1200,
      parcelas_abatidas: 3,
      created_at: new Date().toISOString(),
    },
  ];

  const insumos = [
    {
      id: "ins-1",
      competencia,
      nome: "Arroz 5kg",
      quantidade: 2,
      validade: iso(competencia, 28),
      valor: 45,
    },
    {
      id: "ins-2",
      competencia,
      nome: "Detergente",
      quantidade: 3,
      validade: null,
      valor: 9,
    },
  ];

  const cartoesRegistry = [
    { id: "reg-1", nome: "Nubank", limite: 8000 },
    { id: "reg-2", nome: "Itaú", limite: 12000 },
  ];

  const reservas = [
    {
      id: "res-1",
      competencia,
      nome: "Reserva de emergência",
      valor: 3000,
      created_at: new Date().toISOString(),
    },
    {
      id: "res-2",
      competencia,
      nome: "Viagem",
      valor: 1500,
      created_at: new Date().toISOString(),
    },
  ];

  return {
    profile,
    receitas,
    despesas,
    cartoes,
    contratos,
    eventos,
    insumos,
    cartoesRegistry,
    reservas,
    saldoInicialMes: profile.saldo_inicial,
    hasSaldoRow: true,
    defaultSaldoFromPrev: profile.saldo_inicial,
    userId: MOCK_USER_ID,
  };
}
