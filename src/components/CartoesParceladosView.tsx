import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, TrendingDown, Plus, Pencil, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface CompraParceladaItem {
  id: string;
  descricao: string;
  cartao?: string;
  valor_parcela: number | string;
  parcela_atual: number | string;
  total_parcelas: number | string;
  mes_inicio?: string;
}

interface CartoesParceladosViewProps {
  data?: any;
  comp?: string; // Formato YYYY-MM ou YYYY-MM-DD
  onSaved?: () => void;
}

export function CartoesParceladosView({ data, comp, onSaved }: CartoesParceladosViewProps) {
  // Puxa do Supabase se disponível, com fallback para os lançamentos da props
  const comprasIniciais = data?.cartoesLancamentos ?? data?.compras_parceladas ?? [];
  const [compras, setCompras] = useState<CompraParceladaItem[]>(comprasIniciais);

  useEffect(() => {
    if (data?.cartoesLancamentos) {
      setCompras(data.cartoesLancamentos);
    }
  }, [data]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CompraParceladaItem | null>(null);

  const [descricao, setDescricao] = useState("");
  const [cartao, setCartao] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState("");

  const handleOpenModal = (item?: CompraParceladaItem) => {
    if (item) {
      setEditingItem(item);
      setDescricao(item.descricao || "");
      setCartao(item.cartao || "");
      setValorParcela(String(item.valor_parcela || ""));
      setTotalParcelas(String(item.total_parcelas || ""));
      setParcelaAtual(String(item.parcela_atual || ""));
    } else {
      setEditingItem(null);
      setDescricao("");
      setCartao("");
      setValorParcela("");
      setTotalParcelas("12");
      setParcelaAtual("1");
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!descricao || !valorParcela || !totalParcelas || !parcelaAtual) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      toast.error("Usuário não autenticado");
      return;
    }

    const mesAtualRef = (comp || "2026-10").slice(0, 7);

    const payload = {
      user_id: u.user.id,
      descricao,
      cartao: cartao || "Cartão",
      valor: parseFloat(valorParcela.replace(",", ".")),
      valor_parcela: parseFloat(valorParcela.replace(",", ".")),
      parcela_num: parseInt(parcelaAtual, 10),
      parcela_total: parseInt(totalParcelas, 10),
      parcela_atual: parseInt(parcelaAtual, 10),
      total_parcelas: parseInt(totalParcelas, 10),
      competencia: mesAtualRef,
      mes_inicio: mesAtualRef,
      status: "PENDENTE",
      ativo: true,
    };

    let error;
    if (editingItem?.id) {
      const res = await supabase.from("cartoes_lancamentos").update(payload).eq("id", editingItem.id);
      error = res.error;
    } else {
      const res = await supabase.from("cartoes_lancamentos").insert(payload);
      error = res.error;
    }

    if (error) {
      toast.error("Erro ao salvar no banco: " + error.message);
    } else {
      toast.success(editingItem ? "Compra atualizada no Supabase!" : "Compra cadastrada no Supabase!");
      setIsModalOpen(false);
      if (onSaved) onSaved();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover esta compra parcelada?")) return;
    const { error } = await supabase.from("cartoes_lancamentos").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover: " + error.message);
    } else {
      toast.success("Compra removida!");
      if (onSaved) onSaved();
    }
  };

  // Normaliza o mês exibido no cabeçalho (ex: "2027-02")
  const mesAtualStr = (comp || "2026-10").slice(0, 7);

  const compParaMeses = (c: string) => {
    const [ano, mes] = c.split("-").map(Number);
    if (isNaN(ano) || isNaN(mes)) return 0;
    return ano * 12 + mes;
  };

  const mesVisualizadoInt = compParaMeses(mesAtualStr);

  const comprasProcessadas = compras.map((item: any) => {
    const pInicial = Number(item.parcela_atual || item.parcela_num) || 1;
    const pTotal = Number(item.total_parcelas || item.parcela_total) || 1;
    const mesInicioStr = (item.mes_inicio || item.competencia || "2026-10").slice(0, 7);

    const mesInicioInt = compParaMeses(mesInicioStr);
    const mesesDecorridos = mesVisualizadoInt - mesInicioInt;
    const pCalculada = pInicial + mesesDecorridos;

    // A parcela está ATIVA APENAS se a parcela calculada estiver no intervalo [1, pTotal]
    const isAtiva = pCalculada >= 1 && pCalculada <= pTotal;
    const isQuitada = pCalculada > pTotal;

    const valParc = Number(item.valor_parcela || item.valor) || 0;
    const valorParcela = isAtiva ? valParc : 0;
    const parcelasRestantes = Math.max(0, pTotal - pCalculada);
    const progresso = Math.min(100, Math.round((Math.max(1, Math.min(pCalculada, pTotal)) / pTotal) * 100));

    // Data exata em que a última parcela será debitada
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
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Cronograma de Quitação de Compras Parceladas
        </h2>
        <Button onClick={() => handleOpenModal()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> Nova Compra Parcelada
        </Button>
      </div>

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
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleOpenModal(c.rawItem)}>
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Compra Parcelada" : "Nova Compra Parcelada"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Descrição da Compra</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Notebook, Celular..." />
            </div>
            <div className="space-y-2">
              <Label>Cartão Utilizado</Label>
              <Input value={cartao} onChange={(e) => setCartao(e.target.value)} placeholder="Ex: Nubank, Itaú, XP..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Valor Parcela (R$)</Label>
                <Input value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} placeholder="150,00" />
              </div>
              <div className="space-y-2">
                <Label>Parcela Atual</Label>
                <Input value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-2">
                <Label>Total Parcelas</Label>
                <Input value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} placeholder="10" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700 text-white">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}