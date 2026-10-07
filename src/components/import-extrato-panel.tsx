import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, RefreshCw, Trash2, Check } from 'lucide-react';

interface Transacao {
  id: string;
  data: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  categoria: string;
  cartao_id?: string;
  conta_id?: string;
  status: 'pendente' | 'realizado';
}

interface ItemOpcao {
  id: string;
  nome: string;
}

export function ExtratoImport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Transacao[]>([]);
  const [compDestino, setCompDestino] = useState(new Date().toISOString().substring(0, 7));
  const [tipoDocumento, setTipoDocumento] = useState<'extrato' | 'fatura'>('extrato');
  
  const [contas, setContas] = useState<ItemOpcao[]>([]);
  const [cartoes, setCartoes] = useState<ItemOpcao[]>([]);
  const [contaPadrao, setContaPadrao] = useState<string>('');
  const [cartaoPadrao, setCartaoPadrao] = useState<string>('');
  
  const [mensagem, setMensagem] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(null);

  useEffect(() => {
    if (user) {
      carregarContasECartoes();
    }
  }, [user]);

  const carregarContasECartoes = async () => {
    try {
      const [resContas, resCartoes] = await Promise.all([
        supabase.from('contas_bancarias').select('id, nome').eq('user_id', user?.id),
        supabase.from('cartoes_credito').select('id, nome').eq('user_id', user?.id)
      ]);

      if (resContas.data && resContas.data.length > 0) {
        setContas(resContas.data as ItemOpcao[]);
        setContaPadrao(resContas.data[0].id);
      }

      if (resCartoes.data && resCartoes.data.length > 0) {
        setCartoes(resCartoes.data as ItemOpcao[]);
        setCartaoPadrao(resCartoes.data[0].id);
      }
    } catch (err) {
      console.error('Erro ao carregar contas e cartões:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const processarArquivo = async () => {
    if (!file) {
      setMensagem({ tipo: 'erro', texto: 'Selecione um arquivo para importar.' });
      return;
    }

    if (tipoDocumento === 'fatura' && !cartaoPadrao) {
      setMensagem({ tipo: 'erro', texto: 'Selecione um cartão de crédito de destino para a fatura.' });
      return;
    }

    setLoading(true);
    setMensagem(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('tipoDocumento', tipoDocumento);
      formData.append('competencia', compDestino);
      if (tipoDocumento === 'fatura') {
        formData.append('cartaoId', cartaoPadrao);
      }

      const response = await fetch('/api/import-extrato', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar o arquivo.');
      }

      const transacoesFormatadas: Transacao[] = data.transacoes.map((item: any, index: number) => ({
        id: `temp-${index}-${Date.now()}`,
        data: item.data || new Date().toISOString().substring(0, 10),
        descricao: item.descricao || 'Sem descrição',
        valor: Math.abs(Number(item.valor) || 0),
        tipo: tipoDocumento === 'fatura' ? 'despesa' : (item.tipo || (item.valor < 0 ? 'despesa' : 'receita')),
        categoria: item.categoria || 'Outros',
        cartao_id: tipoDocumento === 'fatura' ? cartaoPadrao : item.cartao_id,
        conta_id: tipoDocumento === 'extrato' ? contaPadrao : undefined,
        status: 'pendente'
      }));

      setRows(transacoesFormatadas);
      setMensagem({ tipo: 'sucesso', texto: `${transacoesFormatadas.length} transações extraídas com sucesso!` });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao comunicar com o servidor.';
      setMensagem({ tipo: 'erro', texto: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRow = (id: string, field: keyof Transacao, value: any) => {
    setRows(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(row => row.id !== id));
  };

  const salvarTransacoes = async () => {
    if (rows.length === 0) return;
    setSaving(true);

    try {
      if (tipoDocumento === 'fatura') {
        const lancamentosCartao = rows.map(r => ({
          user_id: user?.id,
          cartao_id: r.cartao_id || cartaoPadrao,
          data: r.data,
          descricao: r.descricao,
          valor: r.valor,
          categoria: r.categoria,
          competencia: compDestino,
          status: r.status
        }));

        const { error } = await supabase.from('cartoes_lancamentos').insert(lancamentosCartao);
        if (error) throw error;
      } else {
        const despesas = rows
          .filter(r => r.tipo === 'despesa')
          .map(r => ({
            user_id: user?.id,
            conta_id: r.conta_id || contaPadrao,
            data: r.data,
            descricao: r.descricao,
            valor: r.valor,
            categoria: r.categoria,
            status: r.status
          }));

        const receitas = rows
          .filter(r => r.tipo === 'receita')
          .map(r => ({
            user_id: user?.id,
            conta_id: r.conta_id || contaPadrao,
            data: r.data,
            descricao: r.descricao,
            valor: r.valor,
            categoria: r.categoria,
            status: r.status
          }));

        if (despesas.length > 0) {
          const { error } = await supabase.from('despesas').insert(despesas);
          if (error) throw error;
        }

        if (receitas.length > 0) {
          const { error } = await supabase.from('receitas').insert(receitas);
          if (error) throw error;
        }
      }

      setMensagem({ tipo: 'sucesso', texto: 'Lançamentos salvos com sucesso!' });
      setRows([]);
      setFile(null);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Erro ao salvar lançamentos.';
      setMensagem({ tipo: 'erro', texto: 'Erro ao salvar lançamentos: ' + errorMsg });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold mb-4">Importar Extrato / Fatura</h2>
        
        {mensagem && (
          <div className={`p-4 mb-4 rounded-md ${mensagem.tipo === 'sucesso' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {mensagem.texto}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Documento</label>
            <select 
              value={tipoDocumento} 
              onChange={(e) => setTipoDocumento(e.target.value as 'extrato' | 'fatura')}
              className="w-full border border-gray-300 rounded-md p-2"
            >
              <option value="extrato">Extrato Bancário</option>
              <option value="fatura">Fatura de Cartão de Crédito</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Competência (Mês/Ano)</label>
            <input 
              type="month" 
              value={compDestino} 
              onChange={(e) => setCompDestino(e.target.value)}
              className="w-full border border-gray-300 rounded-md p-2"
            />
          </div>

          {tipoDocumento === 'extrato' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Conta Bancária Destino</label>
              <select 
                value={contaPadrao} 
                onChange={(e) => setContaPadrao(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
              >
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cartão de Crédito Destino</label>
              <select 
                value={cartaoPadrao} 
                onChange={(e) => setCartaoPadrao(e.target.value)}
                className="w-full border border-gray-300 rounded-md p-2"
              >
                <option value="">Selecione o cartão...</option>
                {cartoes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4 mb-4">
          <input 
            type="file" 
            accept="application/pdf,image/*" 
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={processarArquivo}
            disabled={loading || !file}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
          >
            {loading ? <RefreshCw className="animate-spin h-5 w-5" /> : <Upload className="h-5 w-5" />}
            <span>Processar</span>
          </button>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Transações Identificadas ({rows.length})</h3>
            <button
              onClick={salvarTransacoes}
              disabled={saving}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {saving ? <RefreshCw className="animate-spin h-5 w-5" /> : <Check className="h-5 w-5" />}
              <span>Salvar Lançamentos</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="p-2">Data</th>
                  <th className="p-2">Descrição</th>
                  <th className="p-2">Valor (R$)</th>
                  <th className="p-2">Tipo</th>
                  <th className="p-2">Categoria</th>
                  <th className="p-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b hover:bg-gray-50">
                    <td className="p-2">
                      <input 
                        type="date" 
                        value={row.data} 
                        onChange={(e) => handleUpdateRow(row.id, 'data', e.target.value)}
                        className="border rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="text" 
                        value={row.descricao} 
                        onChange={(e) => handleUpdateRow(row.id, 'descricao', e.target.value)}
                        className="border rounded p-1 text-xs w-full"
                      />
                    </td>
                    <td className="p-2">
                      <input 
                        type="number" 
                        step="0.01" 
                        value={row.valor} 
                        onChange={(e) => handleUpdateRow(row.id, 'valor', Number(e.target.value))}
                        className="border rounded p-1 text-xs w-24"
                      />
                    </td>
                    <td className="p-2">
                      <select 
                        value={row.tipo} 
                        onChange={(e) => handleUpdateRow(row.id, 'tipo', e.target.value)}
                        className="border rounded p-1 text-xs"
                        disabled={tipoDocumento === 'fatura'}
                      >
                        <option value="despesa">Despesa</option>
                        <option value="receita">Receita</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <input 
                        type="text" 
                        value={row.categoria} 
                        onChange={(e) => handleUpdateRow(row.id, 'categoria', e.target.value)}
                        className="border rounded p-1 text-xs"
                      />
                    </td>
                    <td className="p-2">
                      <button 
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
