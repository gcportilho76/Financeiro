import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchAll } from "@/lib/queries";
import { BRL } from "@/lib/finance";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Wallet, CreditCard, Plus, Edit2, Trash2, ChevronLeft, ChevronRight 
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [competencia, setCompetencia] = useState("2026-10-01");
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", competencia],
    queryFn: () => fetchAll(competencia),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  if (isLoading) return <div className="p-8 text-center">Carregando dados...</div>;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="w-6 h-6" /> Painel Financeiro
        </h1>
      </div>

      <CartoesView data={data} comp={competencia} onSaved={refetch} />
    </div>
  );
}

function CartoesView({ data, comp, onSaved }: any) {
  const cartoesLista = data?.cartoes ?? data?.cartoesRegistry ?? [];
  const [openCartao, setOpenCartao] = useState(false);
  const [editingCartao, setEditingCartao] = useState<any>(null);

  async function deletarCartao(id: string) {
    if (!confirm("Tem certeza que deseja excluir este cartão?")) return;
    const { error } = await supabase.from("cartoes").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cartão excluído!");
      onSaved();
    }
  }

  return (
    <Card className="p-5 bg-card border-border space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-info" /> Cartões de Crédito Cadastrados
        </h3>
        <Button onClick={() => { setEditingCartao(null); setOpenCartao(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Cartão
        </Button>
      </div>

      {cartoesLista.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm">Nenhum cartão cadastrado ainda.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cartoesLista.map((c: any) => (
            <div key={c.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <div className="font-medium text-base flex items-center gap-2">
                  {c.nome}
                  <Badge variant={c.ativo !== false ? "default" : "secondary"}>
                    {c.ativo !== false ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex flex-col gap-0.5">
                  <span>Fechamento: dia <strong>{c.dia_fechamento ?? "—"}</strong></span>
                  <span>Vencimento: dia <strong>{c.dia_vencimento ?? "—"}</strong></span>
                  {c.limite > 0 && <span>Limite: <strong>{BRL(Number(c.limite))}</strong></span>}
                </div>
              </div>

              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditingCartao(c); setOpenCartao(true); }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" onClick={() => deletarCartao(c.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CartaoForm 
        open={openCartao} 
        onOpenChange={setOpenCartao} 
        editing={editingCartao} 
        onSaved={() => { setOpenCartao(false); onSaved(); }} 
      />
    </Card>
  );
}

function CartaoForm({ open, onOpenChange, editing, onSaved }: any) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [fechamento, setFechamento] = useState(editing?.dia_fechamento ?? 1);
  const [vencimento, setVencimento] = useState(editing?.dia_vencimento ?? 10);
  const [limite, setLimite] = useState(editing?.limite ?? 0);
  const [loading, setLoading] = useState(false);

  async function salvar() {
    if (!nome) return toast.error("Informe o nome do cartão");
    setLoading(true);

    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;

    const payload = {
      nome,
      dia_fechamento: Number(fechamento),
      dia_vencimento: Number(vencimento),
      limite: Number(limite),
      user_id: userId,
    };

    let res;
    if (editing?.id) {
      res = await supabase.from("cartoes").update(payload).eq("id", editing.id);
    } else {
      res = await supabase.from("cartoes").insert(payload);
    }

    setLoading(false);
    if (res.error) {
      toast.error(res.error.message);
    } else {
      toast.success("Cartão salvo!");
      onSaved();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Cartão" : "Novo Cartão de Crédito"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <label className="text-xs font-medium">Nome do Cartão / Banco</label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Santander" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium">Dia Fechamento</label>
              <Input type="number" value={fechamento} onChange={(e) => setFechamento(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Dia Vencimento</label>
              <Input type="number" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium">Limite (Opcional)</label>
            <Input type="number" value={limite} onChange={(e) => setLimite(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={loading}>{loading ? "Salvando..." : "Salvar Cartão"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
