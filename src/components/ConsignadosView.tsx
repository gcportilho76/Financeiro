import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConsignadoItem {
  id: string;
  nome: string;
  valor_parcela: number | string;
  parcela_atual: number | string;
  total_parcelas: number | string;
  saldo_devedor?: number | string;
}

interface ConsignadosViewProps {
  data?: {
    consignados?: ConsignadoItem[];
  };
  onSaved?: () => void;
}

export function ConsignadosView({ data, onSaved }: ConsignadosViewProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ConsignadoItem | null>(null);

  const [nome, setNome] = useState("");
  const [valorParcela, setValorParcela] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState("");

  const consignadosBrutos = data?.consignados && data.consignados.length > 0
    ? data.consignados
    : [
        { id: "pan", nome: "Banco Pan", valor_parcela: 520.65, parcela_atual: 53, total_parcelas: 60 },
        { id: "nu197", nome: "Nubank (Contrato 197)", valor_parcela: 197.11, parcela_atual: 6, total_parcelas: 30 },
        { id: "nu790", nome: "Nubank (Contrato 790)", valor_parcela: 790.42, parcela_atual: 8, total_parcelas: 48 },
        { id: "nu706", nome: "Nubank (Contrato 706)", valor_parcela: 706.56, parcela_atual: 15, total_parcelas: 96 },
      ];

  const handleOpenModal = (item?: ConsignadoItem) => {
    if (item) {
      setEditingItem(item);
      setNome(item.nome || "");
      setValorParcela(String(item.valor_parcela || ""));
      setTotalParcelas(String(item.total_parcelas || ""));
      setParcelaAtual(String(item.parcela_atual || ""));
    } else {
      setEditingItem(null);
      setNome("");
      setValorParcela("");
      setTotalParcelas("12");
      setParcelaAtual("1");
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!nome || !valorParcela || !totalParcelas || !parcelaAtual) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const payload = {
      nome,
      valor_parcela: parseFloat(valorParcela.replace(",", ".")),
      total_parcelas: parseInt(totalParcelas, 10),
      parcela_atual: parseInt(parcelaAtual, 10),
    };

    try {
      if (editingItem?.id && !editingItem.id.startsWith("pan") && !editingItem.id.startsWith("nu")) {
        const { error } = await supabase.from("consignados").update(payload).eq("id", editingItem.id);
        if (error) throw error;
        toast.success("Consignado atualizado!");
      } else {
        const { error } = await supabase.from("consignados").insert([payload]);
        if (error) throw error;
        toast.success("Consignado cadastrado!");
      }
      setIsModalOpen(false);
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente excluir este consignado?")) return;
    try {
      const { error } = await supabase.from("consignados").delete().eq("id", id);
      if (error) throw error;
      toast.success("Consignado removido!");
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error("Erro ao excluir: " + err.message);
    }
  };

  const consignadosProcessados = consignadosBrutos.map((item) => {
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
      nome: item.nome,
      parcela: valorParcela,
      parcelaAtual: pAtual,
      totalParcelas: pTotal,
      parcelasRestantes: pRestantes,
      progresso,
      fimEstimado: `${mesFormatado}/${anoTermino}`,
    };
  });

  consignadosProcessados.sort((a, b) => a.parcelasRestantes - b.parcelasRestantes);

  const totalComprometimento = consignadosProcessados.reduce((acc, c) => acc + c.parcela, 0);
  const proximoAConcluir = consignadosProcessados[0];

  return (
    <div className="space-y-6 mt-4">
      {/* Topo com Ações */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold tracking-tight text-foreground">Visão e Cronograma de Consignados</h2>
        <Button onClick={() => handleOpenModal()} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          <Plus className="w-4 h-4" /> Novo Consignado
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comprometimento Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ {totalComprometimento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{consignadosProcessados.length} contratos ativos em folha</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próxima Margem Liberada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              + R$ {proximoAConcluir ? proximoAConcluir.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {proximoAConcluir ? `${proximoAConcluir.nome} • Término em ${proximoAConcluir.parcelasRestantes} meses (${proximoAConcluir.fimEstimado})` : "Nenhum contrato ativo"}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projeção de Liberação Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              + R$ {totalComprometimento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {consignadosProcessados.length > 0 ? `Margem 100% livre até ${consignadosProcessados[consignadosProcessados.length - 1].fimEstimado}` : "Margem totalmente livre"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cronograma Dinâmico */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Cronograma de Liberação de Margem Líquida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {consignadosProcessados.map((c) => (
            <div key={c.id} className="space-y-2 border-b border-border/40 pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-foreground">
                  {c.nome} — R$ {c.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-emerald-500 font-medium text-xs sm:text-sm">
                    Término: {c.fimEstimado} ({c.parcelaAtual}/{c.totalParcelas} — faltam {c.parcelasRestantes} parcelas)
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

      {/* Modal de Adição/Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar Consignado" : "Novo Consignado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome / Banco / Contrato</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Nubank (Contrato 197)" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Valor Parcela (R$)</Label>
                <Input value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} placeholder="197,11" />
              </div>
              <div className="space-y-2">
                <Label>Parcela Atual</Label>
                <Input value={parcelaAtual} onChange={(e) => setParcelaAtual(e.target.value)} placeholder="6" />
              </div>
              <div className="space-y-2">
                <Label>Total Parcelas</Label>
                <Input value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} placeholder="30" />
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