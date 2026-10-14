import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, TrendingDown, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CompraParceladaItem {
  id: string;
  descricao: string;
  cartao?: string;
  valor_parcela: number | string;
  parcela_atual: number | string;
  total_parcelas: number | string;
}

interface CartoesParceladosViewProps {
  data?: {
    compras_parceladas?: CompraParceladaItem[];
    cartoes_lancamentos?: CompraParceladaItem[];
  };
  onSaved?: () => void;
}

export function CartoesParceladosView({ data, onSaved }: CartoesParceladosViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CompraParceladaItem | null>(null);

  const [descricao, setDescricao] = useState("");
  const [cartao, setCartao] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState("");

  // Tenta obter compras parceladas vindas do Supabase ou usa dados simulados para estruturação
  const comprasBrutas: CompraParceladaItem[] =
    (data?.compras_parceladas && data.compras_parceladas.length > 0)
      ? data.compras_parceladas
      : (data?.cartoes_lancamentos && data.cartoes_lancamentos.length > 0)
      ? data.cartoes_lancamentos
      : [
          { id: "c1", descricao: "Eletrônicos / Notebook", cartao: "Nubank", valor_parcela: 350.00, parcela_atual: 4, total_parcelas: 10 },
          { id: "c2", descricao: "Móveis e Decoração", cartao: "Itaú", valor_parcela: 220.50, parcela_atual: 8, total_parcelas: 12 },
          { id: "c3", descricao: "Passagens Aéreas", cartao: "XP", valor_parcela: 480.00, parcela_atual: 2, total_parcelas: 6 },
        ];

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
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const payload = {
      descricao,
      cartao,
      valor_parcela: parseFloat(valorParcela.replace(",", ".")),
      total_parcelas: parseInt(totalParcelas, 10),
      parcela_atual: parseInt(parcelaAtual, 10),
    };

    try {
      if (editingItem?.id && !editingItem.id.startsWith("c")) {
        const { error } = await supabase.from("cartoes_parcelados").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Compra parcelada atualizada!");
      } else {
        const { error } = await supabase.from("cartoes_parcelados").insert([payload]);
        if (error) throw error;
        toast.success("Compra parcelada cadastrada!");
      }
      setIsModalOpen(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover esta compra parcelada?")) return;
    try {
      const { error } = await supabase.from("cartoes_parcelados").delete().eq("id", id);
      if (error) throw error;
      toast.success("Compra removida!");
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  // Processamento dos dados para cronograma dinâmico
  const comprasProcessadas = comprasBrutas.map((item) => {
    const pAtual = Number(item.parcela_atual) || 1;
    const pTotal = Number(item.total_parcelas) || 1;
    const pRestantes = Math.max(0, pTotal - pAtual);
    const valorParcela = Number(item.valor_parcela) || 0;
    const progresso = Math.min(100, Math.round((pAtual / pTotal) * 100));

    const dataTermino = new Date();
    dataTermino.setMonth(dataTermino.getMonth() + pRestantes);
    const mesExtenso = dataTermino.toLocaleDateString("pt-BR", { month: "long" });
    const anoTermino = dataTermino.getFullYear();
    const mesFormatado = mesExtenso.charAt(0).toUpperCase() + mesExtenso.slice(1);

    return {
      rawItem: item,
      id: item.id,
      descricao: item.descricao,
      cartao: item.cartao || "Cartão",
      parcela: valorParcela,
      parcelaAtual: pAtual,
      totalParcelas: pTotal,
      parcelasRestantes: pRestantes,
      progresso,
      fimEstimado: `${mesFormatado}/${anoTermino}`,
    };
  });

  // Ordena pela compra que vai quitar mais rápido
  comprasProcessadas.sort((a, b) => a.parcelasRestantes - b.parcelasRestantes);

  const totalComprometidoCartao = comprasProcessadas.reduce((acc, c) => acc + c.parcela, 0);
  const proximaAQuitar = comprasProcessadas[0];

  return (
    <div className="space-y-6 mt-4">
      {/* Cabecalho */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Cronograma de Quitação de Compras Parceladas
        </h2>
        <Button onClick={() => handleOpenModal()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> Nova Compra Parcelada
        </Button>
      </div>

      {/* Indicadores Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Parcelas Ativas no Cartão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              R$ {totalComprometidoCartao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{comprasProcessadas.length} compras parceladas ativas nas faturas</p>
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
              {proximaAQuitar ? `${proximaAQuitar.descricao} • Quita em ${proximaAQuitar.parcelasRestantes} meses (${proximaAQuitar.fimEstimado})` : "Nenhuma compra a quitar"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quitação Total das Parcelas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              - R$ {totalComprometidoCartao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {comprasProcessadas.length > 0 ? `Faturas 100% livres de parcelados antigos em ${comprasProcessadas[comprasProcessadas.length - 1].fimEstimado}` : "Sem parcelados pendentes"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cronograma Visual */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-500" /> Linha do Tempo de Término de Parcelas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {comprasProcessadas.map((c) => (
            <div key={c.id} className="space-y-2 border-b border-border/40 pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between items-center text-sm">
                <div>
                  <span className="font-semibold text-foreground">{c.descricao}</span>
                  <span className="text-xs text-muted-foreground ml-2">({c.cartao}) — R$ {c.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-500 font-medium text-xs sm:text-sm">
                    Quita em: {c.fimEstimado} ({c.parcelaAtual}/{c.totalParcelas} — faltam {c.parcelasRestantes} meses)
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
          ))}
        </CardContent>
      </Card>

      {/* Modal de Cadastro/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Compra Parcelada" : "Nova Compra Parcelada"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Descrição da Compra</Label>
              <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Notebook, Passagens, Celular..." />
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
                <Input value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} placeholder="3" />
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