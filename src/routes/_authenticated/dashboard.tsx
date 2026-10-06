import React, { useState, useMemo } from 'react';
import { 
  Building2, CreditCard, DollarSign, Calendar, Plus, Trash2, Edit2, CheckCircle, 
  AlertCircle, ChevronRight, FileText, Upload, PieChart, TrendingUp, HelpCircle, 
  ArrowUpRight, ArrowDownRight, RefreshCw, Layers
} from 'lucide-react';

interface Consignado {
  id: string;
  nome: string;
  banco: string;
  valorParcela: number;
  totalParcelas: number;
  parcelaAtual: number;
  saldoDevedor: number;
  dataInicio: string;
}

interface CartaoCredito {
  id: string;
  nome: string;
  limiteTotal: number;
  diaFechamento: number;
  diaVencimento: number;
}

interface LancamentoCartao {
  id: string;
  cartaoId: string;
  descricao: string;
  valor: number;
  dataCompra: string;
  parcelasTotal: number;
  parcelaAtual: number;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'visaglob' | 'cartoes' | 'consignados' | 'comprometido'>('visaglob');

  // --- ESTADOS DE CONSIGNADOS ---
  const [consignados, setConsignados] = useState<Consignado[]>([
    {
      id: '1',
      nome: 'Empréstimo Banco do Brasil',
      banco: 'Banco do Brasil',
      valorParcela: 450.00,
      totalParcelas: 60,
      parcelaAtual: 14,
      saldoDevedor: 20700.00,
      dataInicio: '2023-08-10'
    },
    {
      id: '2',
      nome: 'Consignado Caixa Econômica',
      banco: 'Caixa',
      valorParcela: 320.50,
      totalParcelas: 48,
      parcelaAtual: 22,
      saldoDevedor: 8333.00,
      dataInicio: '2022-11-15'
    }
  ]);

  const [isConsignadoModalOpen, setIsConsignadoModalOpen] = useState(false);
  const [editingConsignado, setEditingConsignado] = useState<Consignado | null>(null);
  const [formConsignado, setFormConsignado] = useState({
    nome: '',
    banco: '',
    valorParcela: '',
    totalParcelas: '',
    parcelaAtual: '',
    saldoDevedor: '',
    dataInicio: ''
  });

  // --- ESTADOS DE CARTÕES E LANÇAMENTOS ---
  const [cartoes] = useState<CartaoCredito[]>([
    { id: 'c1', nome: 'Cartão Principal', limiteTotal: 10000, diaFechamento: 25, diaVencimento: 5 },
    { id: 'c2', nome: 'Cartão Secundário', limiteTotal: 5000, diaFechamento: 10, diaVencimento: 20 }
  ]);

  const [lancamentosCartao, setLancamentosCartao] = useState<LancamentoCartao[]>([
    { id: 'l1', cartaoId: 'c1', descricao: 'Supermercado', valor: 350.00, dataCompra: '2026-10-02', parcelasTotal: 1, parcelaAtual: 1 },
    { id: 'l2', cartaoId: 'c1', descricao: 'Notebook em 10x', valor: 450.00, dataCompra: '2026-05-15', parcelasTotal: 10, parcelaAtual: 5 }
  ]);

  // --- HANDLERS CONSIGNADOS ---
  const handleOpenConsignadoModal = (consignado?: Consignado) => {
    if (consignado) {
      setEditingConsignado(consignado);
      setFormConsignado({
        nome: consignado.nome,
        banco: consignado.banco,
        valorParcela: consignado.valorParcela.toString(),
        totalParcelas: consignado.totalParcelas.toString(),
        parcelaAtual: consignado.parcelaAtual.toString(),
        saldoDevedor: consignado.saldoDevedor.toString(),
        dataInicio: consignado.dataInicio
      });
    } else {
      setEditingConsignado(null);
      setFormConsignado({
        nome: '',
        banco: '',
        valorParcela: '',
        totalParcelas: '',
        parcelaAtual: '1',
        saldoDevedor: '',
        dataInicio: new Date().toISOString().split('T')[0]
      });
    }
    setIsConsignadoModalOpen(true);
  };

  const handleSaveConsignado = (e: React.FormEvent) => {
    e.preventDefault();
    const vParcela = parseFloat(formConsignado.valorParcela) || 0;
    const tParcelas = parseInt(formConsignado.totalParcelas) || 1;
    const pAtual = parseInt(formConsignado.parcelaAtual) || 1;
    const sDevedor = parseFloat(formConsignado.saldoDevedor) || (vParcela * (tParcelas - pAtual + 1));

    if (editingConsignado) {
      setConsignados(prev => prev.map(item => item.id === editingConsignado.id ? {
        ...item,
        nome: formConsignado.nome,
        banco: formConsignado.banco,
        valorParcela: vParcela,
        totalParcelas: tParcelas,
        parcelaAtual: pAtual,
        saldoDevedor: sDevedor,
        dataInicio: formConsignado.dataInicio
      } : item));
    } else {
      const newConsignado: Consignado = {
        id: Date.now().toString(),
        nome: formConsignado.nome,
        banco: formConsignado.banco,
        valorParcela: vParcela,
        totalParcelas: tParcelas,
        parcelaAtual: pAtual,
        saldoDevedor: sDevedor,
        dataInicio: formConsignado.dataInicio
      };
      setConsignados(prev => [...prev, newConsignado]);
    }

    setIsConsignadoModalOpen(false);
  };

  const handleDeleteConsignado = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este contrato de consignado?')) {
      setConsignados(prev => prev.filter(c => c.id !== id));
    }
  };

  // --- CÁLCULOS TOTAIS ---
  const totalComprometidoConsignados = useMemo(() => {
    return consignados.reduce((acc, c) => acc + c.valorParcela, 0);
  }, [consignados]);

  const totalSaldoDevedorConsignados = useMemo(() => {
    return consignados.reduce((acc, c) => acc + c.saldoDevedor, 0);
  }, [consignados]);

  const totalComprometidoCartoes = useMemo(() => {
    return lancamentosCartao.reduce((acc, l) => acc + l.valor, 0);
  }, [lancamentosCartao]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Painel Financeiro Gutê</h1>
            <p className="text-slate-400 text-sm mt-1">Gestão integrada de cartões, consignados e valores comprometidos.</p>
          </div>
          
          {/* NAVEGAÇÃO ENTRE ABAS */}
          <div className="flex bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 overflow-x-auto">
            <button
              onClick={() => setActiveTab('visaglob')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'visaglob' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PieChart className="w-4 h-4" /> Vision Geral
            </button>
            <button
              onClick={() => setActiveTab('cartoes')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'cartoes' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" /> Cartões
            </button>
            <button
              onClick={() => setActiveTab('consignados')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'consignados' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Building2 className="w-4 h-4" /> Consignados
            </button>
            <button
              onClick={() => setActiveTab('comprometido')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeTab === 'comprometido' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" /> Comprometido
            </button>
          </div>
        </div>
        {/* ABA VISÃO GERAL */}
        {activeTab === 'visaglob' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-sm font-medium">Cartões (Mês)</span>
                  <CreditCard className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-white">R$ {totalComprometidoCartoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-400 mt-2">Soma de parcelas no cartão para este mês</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-sm font-medium">Consignados (Mês)</span>
                  <Building2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">R$ {totalComprometidoConsignados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-400 mt-2">Desconto mensal fixo das parcelas</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 p-6 rounded-2xl shadow-sm">
                <div className="flex items-center justify-between text-slate-400 mb-2">
                  <span className="text-sm font-medium">Total Comprometido (Mês)</span>
                  <DollarSign className="w-5 h-5 text-amber-400" />
                </div>
                <div className="text-2xl font-bold text-amber-400">R$ {(totalComprometidoCartoes + totalComprometidoConsignados).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                <p className="text-xs text-slate-400 mt-2">Total de parcelas fixas + cartões</p>
              </div>
            </div>
          </div>
        )}

        {/* ABA CARTÕES */}
        {activeTab === 'cartoes' && (
          <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Lançamentos de Cartões de Crédito</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-800 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Data Compra</th>
                    <th className="p-3">Parcelas</th>
                    <th className="p-3">Valor Parcela</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {lancamentosCartao.map(l => (
                    <tr key={l.id} className="hover:bg-slate-800/30">
                      <td className="p-3 font-medium text-white">{l.descricao}</td>
                      <td className="p-3">{l.dataCompra}</td>
                      <td className="p-3">{l.parcelaAtual}/{l.parcelasTotal}</td>
                      <td className="p-3 text-indigo-300 font-semibold">R$ {l.valor.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ABA CONSIGNADOS - GESTÃO COMPLETA */}
        {activeTab === 'consignados' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Gestão de Consignados e Empréstimos</h2>
                <p className="text-sm text-slate-400">Cadastre, edite e acompanhe a quitação de cada parcela.</p>
              </div>
              <button
                onClick={() => handleOpenConsignadoModal()}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-900/30"
              >
                <Plus className="w-4 h-4" /> Novo Consignado
              </button>
            </div>

            {/* RESUMO RÁPIDO */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-800/40 border border-slate-700/60 p-4 rounded-xl flex justify-between items-center">
                <span className="text-slate-400 text-sm">Comprometimento Mensal em Consignados</span>
                <span className="text-lg font-bold text-emerald-400">R$ {totalComprometidoConsignados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-slate-800/40 border border-slate-700/60 p-4 rounded-xl flex justify-between items-center">
                <span className="text-slate-400 text-sm">Saldo Devedor Total Restante</span>
                <span className="text-lg font-bold text-rose-400">R$ {totalSaldoDevedorConsignados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* TABELA DE CONSIGNADOS */}
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-800/90 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="p-4">Contrato / Empréstimo</th>
                      <th className="p-4">Banco</th>
                      <th className="p-4">Valor Parcela</th>
                      <th className="p-4">Progresso Parcela</th>
                      <th className="p-4">Saldo Devedor</th>
                      <th className="p-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {consignados.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Nenhum consignado cadastrado. Clique no botão "Novo Consignado" para adicionar.
                        </td>
                      </tr>
                    ) : (
                      consignados.map((item) => {
                        const progresso = Math.min(100, Math.round((item.parcelaAtual / item.totalParcelas) * 100));
                        return (
                          <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-4 font-semibold text-white">
                              {item.nome}
                              <div className="text-xs text-slate-500 font-normal">Início: {item.dataInicio}</div>
                            </td>
                            <td className="p-4 text-slate-300">{item.banco}</td>
                            <td className="p-4 font-bold text-emerald-400">R$ {item.valorParcela.toFixed(2)}</td>
                            <td className="p-4">
                              <div className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="font-semibold text-indigo-300">Parcela {item.parcelaAtual} de {item.totalParcelas}</span>
                                  <span className="text-slate-400">{progresso}%</span>
                                </div>
                                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                                  <div className="bg-indigo-500 h-full rounded-full transition-all duration-300" style={{ width: `${progresso}%` }}></div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-semibold text-rose-300">R$ {item.saldoDevedor.toFixed(2)}</td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => handleOpenConsignadoModal(item)}
                                  className="p-2 text-slate-400 hover:text-indigo-400 hover:bg-slate-700/50 rounded-lg transition-all"
                                  title="Editar consignado e parcela atual"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteConsignado(item.id)}
                                  className="p-2 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 rounded-lg transition-all"
                                  title="Excluir consignado"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ABA COMPROMETTIDO (RESUMO AUTOMÁTICO) */}
        {activeTab === 'comprometido' && (
          <div className="space-y-6">
            <div className="bg-slate-800/40 border border-slate-700/60 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-white mb-2">Visão de Valores Comprometidos</h2>
              <p className="text-slate-400 text-sm mb-6">Resumo consolidade de parcelas futuras de cartões e contratos de consignado.</p>

              <div className="space-y-4">
                <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-5 h-5 text-emerald-400" />
                    <div>
                      <div className="font-semibold text-white">Parcelas de Consignados</div>
                      <div className="text-xs text-slate-400">{consignados.length} contrato(s) ativo(s)</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-emerald-400">R$ {totalComprometidoConsignados.toFixed(2)} /mês</div>
                </div>

                <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-5 h-5 text-indigo-400" />
                    <div>
                      <div className="font-semibold text-white">Faturas e Parcelados no Cartão</div>
                      <div className="text-xs text-slate-400">{lancamentosCartao.length} lançamento(s) registrado(s)</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-indigo-400">R$ {totalComprometidoCartoes.toFixed(2)} /mês</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL CADASTRAR / EDITAR CONSIGNADO */}
        {isConsignadoModalOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
              <div className="flex justify-between items-center pb-4 border-b border-slate-700 mb-4">
                <h3 className="text-lg font-bold text-white">
                  {editingConsignado ? 'Editar Consignado' : 'Novo Consignado'}
                </h3>
                <button 
                  onClick={() => setIsConsignadoModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveConsignado} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Nome do Contrato / Descrição</label>
                  <input
                    type="text"
                    required
                    value={formConsignado.nome}
                    onChange={(e) => setFormConsignado({ ...formConsignado, nome: e.target.value })}
                    placeholder="Ex: Empréstimo do Banco do Brasil"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Banco / Instituição</label>
                    <input
                      type="text"
                      required
                      value={formConsignado.banco}
                      onChange={(e) => setFormConsignado({ ...formConsignado, banco: e.target.value })}
                      placeholder="Ex: Santander"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Valor da Parcela (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formConsignado.valorParcela}
                      onChange={(e) => setFormConsignado({ ...formConsignado, valorParcela: e.target.value })}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Total de Parcelas do Contrato</label>
                    <input
                      type="number"
                      required
                      value={formConsignado.totalParcelas}
                      onChange={(e) => setFormConsignado({ ...formConsignado, totalParcelas: e.target.value })}
                      placeholder="Ex: 60"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-indigo-400 mb-1">Parcela Atual (Mês Vigente)</label>
                    <input
                      type="number"
                      required
                      value={formConsignado.parcelaAtual}
                      onChange={(e) => setFormConsignado({ ...formConsignado, parcelaAtual: e.target.value })}
                      placeholder="Ex: 14"
                      className="w-full bg-slate-900 border border-indigo-500/80 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Saldo Devedor Restante (R$)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formConsignado.saldoDevedor}
                      onChange={(e) => setFormConsignado({ ...formConsignado, saldoDevedor: e.target.value })}
                      placeholder="Calculado automaticamente"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Data de Início</label>
                    <input
                      type="date"
                      value={formConsignado.dataInicio}
                      onChange={(e) => setFormConsignado({ ...formConsignado, dataInicio: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                  <button
                    type="button"
                    onClick={() => setIsConsignadoModalOpen(false)}
                    className="px-4 py-2 text-slate-400 hover:text-white text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg"
                  >
                    Salvar Consignado
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
