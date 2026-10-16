import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, TrendingDown, Plus, Pencil, Trash2, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CompraParceladaItem {
  id: string;
  descricao: string;
  cartao?: string;
  valor_parcela: number;
  parcela_atual: number;
  total_parcelas: number;
  mes_inicio?: string;
}

interface CartoesParceladosViewProps {
  data?: any;
  comp?: string;
  onSaved?: () => void;
}

const LOCAL_STORAGE_KEY = "gute_cartoes_parcelados_v6";

export function CartoesParceladosView({ data, comp, onSaved }: CartoesParceladosViewProps) {
  const mesAtualStr = (comp || "2026-10").slice(0, 7);

  const [compras, setCompras] = useState<CompraParceladaItem[]>(() => {
    try {
      const local = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (local) return JSON.parse(local);
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    if (data?.cartoesLancamentos && Array.isArray(data.cartoesLancamentos) && data.cartoesLancamentos.length > 0) {
      const convertidos = data.cartoesLancamentos.map((c: any) => ({
        id: String(c.id),
        descricao: c.descricao || "",
        cartao: c.cartao || "Cartão",
        valor_parcela: Number(c.valor_parcela || c.valor) || 0,
        parcela_atual: Number(c.parcela_atual || c.parcela_num) || 1,
        total_parcelas: Number(c.total_parcelas || c.parcela_total) || 1,
        mes_inicio: (c.mes_inicio || c.competencia || mesAtualStr).slice(0, 7),
      }));
      setCompras(convertidos);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(convertidos));
    }
  }, [data, mesAtualStr]);

  const [formAberto, setFormAberto] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [descricao, setDescricao] = useState("");
  const [cartao, setCartao] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("3");
  const [parcelaAtual, setParcelaAtual] = useState("1");

  const abrirNovo = () => {
    setEditingId(null);
    setDescricao("");
    setCartao("");
    setValorParcela("");
    setTotalParcelas("3");
    setParcelaAtual("1");
    setFormAberto(true);
  };

  const abrirEdicao = (item: CompraParceladaItem) => {
    setEditingId(item.id);
    setDescricao(item.descricao || "");
    setCartao(item.cartao || "");
    setValorParcela(String(item.valor_parcela || ""));
    setTotalParcelas(String(item.total_parcelas || "3"));
    setParcelaAtual(String(item.parcela_atual || "1"));
    setFormAberto(true);
  };

  const executarSalvar = async () => {
    if (!descricao.trim()) {
      toast.error("Informe a descrição da compra");
      return;
    }

    const vParc = parseFloat(String(valorParcela).replace(",", "."));
    if (isNaN(vParc) || vParc <= 0) {
      toast.error("Informe um valor de parcela válido");
      return;
    }

    const pAtual = parseInt(String(parcelaAtual), 10) || 1;
    const pTotal = parseInt(String(totalParcelas), 10) || 1;

    const idItem = editingId || "parcela_" + Date.now();
    const novoItem: CompraParceladaItem = {
      id: idItem,
      descricao: descricao.trim(),
      cartao: cartao.trim() || "Cartão",
      valor_parcela: vParc,
      parcela_atual: pAtual,
      total_parcelas: pTotal,
      mes_inicio: mesAtualStr,
    };

    setCompras((prev) => {
      const existe = prev.some((c) => c.id === idItem);
      const lista = existe
        ? prev.map((c) => (c.id === idItem ? novoItem : c))
        : [...prev, novoItem];
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista));
      return lista;
    });

    setFormAberto(false);
    toast.success("Compra parcelada salva!");

    try {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const payload = {
          user_id: u.user.id,
          descricao: novoItem.descricao,
          cartao: novoItem.cartao,
          valor: novoItem.valor_parcela,
          valor_parcela: novoItem.valor_parcela,
          parcela_num: novoItem.parcela_atual,
          parcela_atual: novoItem.parcela_atual,
          parcela_total: novoItem.total_parcelas,
          total_parcelas: novoItem.total_parcelas,
          competencia: novoItem.mes_inicio,
          mes_inicio: novoItem.mes_inicio,
          status: "PENDENTE",
          ativo: true,
        };

        if (editingId && !editingId.startsWith("parcela_")) {
          await supabase.from("cartoes_lancamentos").update(payload).eq("id", editingId);
        } else {
          await supabase.from("cartoes_lancamentos").insert([payload]);
        }
      }
    } catch (err) {
      console.warn("Sincronização Supabase em background:", err);
    }

    if (onSaved) onSaved();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover esta compra parcelada?")) return;

    setCompras((prev) => {
      const lista = prev.filter((item) => item.id !== id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista));
      return lista;
    });

    if (!id.startsWith("parcela_")) {
      try {
        await supabase.from("cartoes_lancamentos").delete().eq("id", id);
      } catch (e) {
        console.error(e);
      }
    }

    toast.success("Compra removida!");
    if (onSaved) onSaved();
  };

  const compParaMeses = (c: string) => {
    const [ano, mes] = c.split("-").map(Number);
    if (isNaN(ano) || isNaN(mes)) return 0;
    return ano * 12 + mes;
  };

  const mesVisualizadoInt = compParaMeses(mesAtualStr);

  const comprasProcessadas = compras.map((item) => {
    const pInicial = Number(item.parcela_atual) || 1;
    const pTotal = Number(item.total_parcelas) || 1;
    const mesInicioStr = (item.mes_inicio || mesAtualStr).slice(0, 7);

    const mesInicioInt = compParaMeses(mesInicioStr);
    const mesesDecorridos = mesVisualizadoInt - mesInicioInt;
    const pCalculada = pInicial + mesesDecorridos;

    const isAtiva = pCalculada >= 1 && pCalculada <= pTotal;
    const isQuitada = pCalculada > pTotal;

    const valParc = Number(item.valor_parcela) || 0;
    const valorParcela = isAtiva ? valParc : 0;
    const parcelasRestantes = Math.max(0, pTotal - pCalculada);
    const progresso = Math.min(100, Math.round((Math.max(1, Math.min(pCalculada, pTotal)) / pTotal) * 100));

    const [anoBase, mesBase] = mesInicioStr.split("-").map(Number);
    const dataTermino = new Date(anoBase || 2026, (mesBase || 10) - 1 + (pTotal - pInicial), 1);
    const mesExtenso = dataTermino.toLocaleDateString("pt-BR", { month: "long" });
    const mesFormatado = mesExtenso.charAt(0).toUpperCase() + mesExtenso.slice(1);

    return {
      rawItem: item,
      id: item.id,
      descricao: item.descricao,
      cartao: item.cartao || "Cartão",
      parcela: valorParcela,
      valorOriginal: valParc,
      parcelaAtual: pCalculada,
      totalParcelas: pTotal,
      parcelasRestantes,
      progresso,
      isAtiva,
      isQuitada,
      fimEstimado: `${mesFormatado}/${dataTermino.getFullYear()}`,
    };
  });

  const comprasAtivasNoMes = comprasProcessadas.filter((c) => c.isAtiva);
  const comprasQuitadasNoMes = comprasProcessadas.filter((c) => c.isQuitada);

  const totalComprometidoCartao = comprasAtivasNoMes.reduce((acc, c) => acc + c.parcela, 0);
  const proximaAQuitar = [...comprasAtivasNoMes].sort((a, b) => a.parcelasRestantes - b.parcelasRestantes)[0];
  const totalEconomizadoLiberado = comprasQuitadasNoMes.reduce((acc, c) => acc + c.valorOriginal, 0);

  return (
    <div className="space-y-6 mt-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Cronograma de Quitação de Compras Parceladas
        </h2>
        <Button onClick={abrirNovo} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> Nova Compra Parcelada
        </Button>
      </div>

      {formAberto && (
        <Card className="p-5 bg-card border-2 border-emerald-500/50 space-y-4">
          <div className="flex justify-between items-center border-b border-border pb-2">
            <h3 className="font-bold text-lg text-foreground">
              {editingId ? "Editar Compra Parcelada" : "Nova Compra Parcelada"}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setFormAberto(false)}>
              <ChevronUp className="w-4 h-4 mr-1" /> Fechar
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Descrição da Compra</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Notebook, Celular..." />
            </div>
            <div>
              <Label>Cartão Utilizado</Label>
              <Input value={cartao} onChange={(e) => setCartao(e.target.value)} placeholder="Ex: Nubank, Santander..." />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Valor Parcela (R$)</Label>
              <Input value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} placeholder="100" />
            </div>
            <div>
              <Label>Parcela Atual</Label>
              <Input value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} placeholder="1" />
            </div>
            <div>
              <Label>Total Parcelas</Label>
              <Input value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} placeholder="3" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormAberto(false)}>Cancelar</Button>
            <Button onClick={executarSalvar} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
              Salvar Lançamento
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parcelas Ativas neste Mês</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              R$ {totalComprometidoCartao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{comprasAtivasNoMes.length} parcelas ativas no mês selecionado</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próxima Redução na Fatura</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              - R$ {proximaAQuitar ? proximaAQuitar.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {proximaAQuitar ? `${proximaAQuitar.descricao} · Quita em ${proximaAQuitar.fimEstimado}` : "Nenhuma compra a quitar"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Margem Liberada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              - R$ {totalEconomizadoLiberado.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{comprasQuitadasNoMes.length} compras parceladas já 100% quitadas</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-500" /> Parcelas no Mês Visualizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {comprasAtivasNoMes.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="text-base font-medium text-foreground">Fatura 100% livre de parcelas antigas!</p>
              <p className="text-sm text-muted-foreground">Todas as compras parceladas cadastradas já foram quitadas neste mês.</p>
            </div>
          ) : (
            comprasAtivasNoMes.map((c) => (
              <div key={c.id} className="space-y-2 border-b border-border/40 pb-4 last:border-0 last:pb-0">
                <div className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-semibold text-foreground">{c.descricao}</span>
                    <span className="text-xs text-muted-foreground ml-2">({c.cartao}) — R$ {c.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-500 font-medium text-xs sm:text-sm">
                      Quita em: {c.fimEstimado} ({c.parcelaAtual}/{c.totalParcelas} — {c.parcelasRestantes === 0 ? "Última parcela!" : `faltam ${c.parcelasRestantes} parcelas`})
                    </span>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => abrirEdicao(c.rawItem)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive/80" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <Progress value={c.progresso} className="h-2 bg-secondary" />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}