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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Wallet, CreditCard, Plus, Edit2, Trash2, ChevronLeft, ChevronRight,
  TrendingUp, ArrowDownCircle, ArrowUpCircle, PiggyBank, RefreshCw, FileText
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const [competencia, setCompetencia] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", competencia],
    queryFn: () => fetchAll(competencia),
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["dashboard"] });

  function mudarMes(delta: number) {
    const [y, m] = competencia.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setCompetencia(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
  }

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando painel financeiro...</div>;

  const receitas = data?.receitas ?? [];
  const despesas = data?.despesas ?? [];
  const consignados = data?.consignados ?? [];

  const totalReceitas = receitas.reduce((acc: number, r: any) => acc + Number(r.valor || 0), 0);
  const totalDespesas = despesas.reduce((acc: number, d: any) => acc + Number(d.valor || 0), 0);
  const totalConsignados = consignados.reduce((acc: number, c: any) => acc + Number(c.valor || 0), 0);
  const saldoMes = totalReceitas - totalDespesas - totalConsignados;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" /> Painel Financeiro
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">Gestão completa do seu orçamento</p>
        </div>

        <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-lg border border-border">
          <Button size="icon" variant="ghost" onClick={() => mudarMes(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-sm px-2">{competencia.slice(0, 7)}</span>
          <Button size="icon" variant="ghost" onClick={() => mudarMes(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Cards Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
            <ArrowUpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="text-base font-bold text-emerald-500">{BRL(totalReceitas)}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-500 rounded-lg">
            <ArrowDownCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="text-base font-bold text-rose-500">{BRL(totalDespesas)}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-lg">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Consignados</p>
            <p className="text-base font-bold text-amber-500">{BRL(totalConsignados)}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg">
            <PiggyBank className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Saldo do Mês</p>
            <p className={`text-base font-bold ${saldoMes >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
              {BRL(saldoMes)}
            </p>
          </div>
        </Card>
      </div>

      {/* Abas do Dashboard */}
      <Tabs defaultValue="geral" className="space-y-4">
        <TabsList className="flex flex-wrap gap-1 h-auto p-1">
          <TabsTrigger value="geral" className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Geral
          </TabsTrigger>
          <TabsTrigger value="receitas" className="flex items-center gap-1.5">
            <ArrowUpCircle className="w-4 h-4 text-emerald-500" /> Receitas ({receitas.length})
          </TabsTrigger>
          <TabsTrigger value="despesas" className="flex items-center gap-1.5">
            <ArrowDownCircle className="w-4 h-4 text-rose-500" /> Despesas ({despesas.length})
          </TabsTrigger>
          <TabsTrigger value="consignados" className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-amber-500" /> Consignados ({consignados.length})
          </TabsTrigger>
          <TabsTrigger value="cartoes" className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-primary" /> Cartões de Crédito
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-base">Resumo da Competência {competencia.slice(0, 7)}</h3>
            <p className="text-sm text-muted-foreground">
              Utilize as abas acima para gerir detalhadamente as suas Receitas, Despesas, Consignados e Cartões de Crédito.
            </p>
          </Card>
        </TabsContent>

        <TabsContent value="receitas">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-base text-emerald-500">Lançamentos de Receitas</h3>
            <div className="space-y-2">
              {receitas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma receita informada neste mês.</p>
              ) : (
                receitas.map((r: any) => (
                  <div key={r.id} className="flex justify-between p-3 rounded-lg bg-secondary/30 border">
                    <div>
                      <p className="font-medium text-sm">{r.descricao || r.categoria || "Receita"}</p>
                      <p className="text-xs text-muted-foreground">{r.data || competencia}</p>
                    </div>
                    <span className="font-bold text-emerald-500">{BRL(Number(r.valor))}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="despesas">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-base text-rose-500">Lançamentos de Despesas</h3>
            <div className="space-y-2">
              {despesas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma despesa informada neste mês.</p>
              ) : (
                despesas.map((d: any) => (
                  <div key={d.id} className="flex justify-between p-3 rounded-lg bg-secondary/30 border">
                    <div>
                      <p className="font-medium text-sm">{d.descricao || d.categoria || "Despesa"}</p>
                      <p className="text-xs text-muted-foreground">{d.data || competencia}</p>
                    </div>
                    <span className="font-bold text-rose-500">{BRL(Number(d.valor))}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="consignados">
          <Card className="p-5 space-y-4">
            <h3 className="font-semibold text-base text-amber-500">Empréstimos / Consignados</h3>
            <div className="space-y-2">
              {consignados.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum consignado registrado.</p>
              ) : (
                consignados.map((c: any) => (
                  <div key={c.id} className="flex justify-between p-3 rounded-lg bg-secondary/30 border">
                    <div>
                      <p className="font-medium text-sm">{c.descricao || "Consignado"}</p>
                      <p className="text-xs text-muted-foreground">{c.banco ?? ""}</p>
                    </div>
                    <span className="font-bold text-amber-500">{BRL(Number(c.valor))}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="cartoes">
          <CartoesView data={data} comp={competencia} onSaved={refetch} />
        </TabsContent>
      </Tabs>
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
          <CreditCard className="w-4 h-4 text-primary" /> Cartões de Crédito Cadastrados
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