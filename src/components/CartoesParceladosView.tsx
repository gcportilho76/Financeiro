import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, TrendingDown, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
  data?: {
    compras_parceladas?: CompraParceladaItem[];
  };
  currentMonth?: string;
  onSaved?: () => void;
}

const STORAGE_KEY = "orçamento_gute_cartoes_parcelados";

const MESES_MAP: Record<string, number> = {
  janeiro: 0, feveiro: 1, fevereiro: 1, marco: 2, março: 2, abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11
};

export function CartoesParceladosView({ data, currentMonth, onSaved }: CartoesParceladosViewProps) {
  const [compras, setCompras] = useState<CompraParceladaItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return data?.compras_parceladas || [];
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CompraParceladaItem | null>(null);

  const [descricao, setDescricao] = useState("");
  const [cartao, setCartao] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState("");

  const parseCurrentDate = (monthStr?: string): Date => {
    if (!monthStr || typeof monthStr !== "string") return new Date(2026, 9, 1);

    try {
      if (monthStr.includes("-")) {
        const [ano, mes] = monthStr.split("-").map(Number);
        if (!isNaN(ano) && !isNaN(mes)) return new Date(ano, mes - 1, 1);
      }

      if (monthStr.includes("/")) {
        const [mesNome, anoStr] = monthStr.split("/");
        const mesIndex = MESES_MAP[mesNome.trim().toLowerCase()] ?? 9;
        const ano = Number(anoStr);
        if (!isNaN(ano)) return new Date(ano, mesIndex, 1);
      }
    } catch {
      return new Date(2026, 9, 1);
    }

    return new Date(2026, 9, 1);
  };

  const dateVisualizada = parseCurrentDate(currentMonth);

  const saveToStorage = (updatedList: CompraParceladaItem[]) => {
    setCompras(updatedList);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
    } catch (e) {
      console.error("Erro ao salvar localmente:", e);
    }
  };

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

  const handleSave = () => {
    if (!descricao || !valorParcela || !totalParcelas || !parcelaAtual) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const payload: CompraParceladaItem = {
      id: editingItem ? editingItem.id : "compra_" + Date.now(),
      descricao,
      cartao: cartao || "Cartão",
      valor_parcela: parseFloat(valorParcela.replace(",", ".")),
      total_parcelas: parseInt(totalParcelas, 10),
      parcela_atual: parseInt(parcelaAtual, 10),
      mes_inicio: editingItem?.mes_inicio || "2026-10",
    };

    let updatedList: CompraParceladaItem[];
    if (editingItem) {
      updatedList = compras.map((item) => (item.id === editingItem.id ? payload : item));
      toast.success("Compra parcelada atualizada!");
    } else {
      updatedList = [...compras, payload];
      toast.success("Compra parcelada cadastrada!");
    }

    saveToStorage(updatedList);
    setIsModalOpen(false);
    if (onSaved) onSaved();
  };

  const handleDelete = (id: string) => {
    if (!confirm("Deseja realmente remover esta compra parcelada?")) return;
    const updatedList = compras.filter((item) => item.id !== id);
    saveToStorage(updatedList);
    toast.success("Compra removida!");
    if (onSaved) onSaved();
  };

  const dateBaseCadastro = new Date(2026, 9, 1);
  const diffMeses = (dateVisualizada.getFullYear() - dateBaseCadastro.getFullYear()) * 12 + 
                    (dateVisualizada.getMonth() - dateBaseCadastro.getMonth());

  const comprasProcessadas = compras.map((item) => {
    const pInicial = Number(item.parcela_atual) || 1;
    const pTotal = Number(item.total_parcelas) || 1;

    const pCalculada = pInicial + diffMeses;

    const isAtiva = pCalculada > 0 && pCalculada <= pTotal;
    const isQuitada = pCalculada > pTotal;

    const valorParcela = isAtiva ? Number(item.valor_parcela) || 0 : 0;
    const pExibicao = Math.max(1, Math.min(pCalculada, pTotal));
    const progresso = Math.min(100, Math.round((pExibicao / pTotal) * 100));

    const dataTermino = new Date(2026, 9, 1);
    dataTermino.setMonth(dataTermino.getMonth() + (pTotal - pInicial));
    const mesExtenso = dataTermino.toLocaleDateString("pt-BR", { month: "long" });
    const mesFormatado = mesExtenso.charAt(0).toUpperCase() + mesExtenso.slice(1);

    return {
      rawItem: item,
      id: item.id,
      descricao: item.descricao,
      cartao: item.cartao || "Cartão",
      parcela: valorParcela,
      parcelaAtual: pCalculada,
      totalParcelas: pTotal,
      parcelasRestantes: Math.max(0, pTotal - pCalculada + 1),
      progresso,
      isAtiva,
      isQuitada,
      fimEstimado: `${mesFormatado}/${dataTermino.getFullYear()}`,
    };
  });

  const comprasAtivasNoMes = comprasProcessadas.filter((c) => c.isAtiva);
  comprasAtivasNoMes.sort((a, b) => a.parcelasRestantes - b.parcelasRestantes);

  const totalComprometidoCartao = comprasAtivasNoMes.reduce((acc, c) => acc + c.parcela, 0);
  const proximaAQuitar = comprasAtivasNoMes[0];

  const economiaTotalLiberada = comprasProcessadas
    .filter((c) => c.isQuitada)
    .reduce((acc, c) => acc + Number(c.rawItem.valor_parcela), 0);

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
              {proximaAQuitar ? `${proximaAQuitar.descricao} • Quita em ${proximaAQuitar.fimEstimado}` : "Nenhuma compra a quitar neste período"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Economia Total Acumulada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              - R$ {economiaTotalLiberada.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Valor mensal já livre de parcelados quitados até este mês</p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-emerald-500" /> Parcelas Ativas no Mês Selecionado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {comprasAtivasNoMes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              🎉 Nenhuma parcela de cartão ativa neste mês! Todas as compras parceladas cadastradas já foram quitadas.
            </p>
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
                      Quita em: {c.fimEstimado} ({c.parcelaAtual}/{c.totalParcelas} — faltam {c.parcelasRestantes} parcelas)
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
                <Label>Parcela em Out/2026</Label>
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