import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRL, hojeISO } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/date-picker";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Landmark, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { VinculacaoPanel } from "@/components/vinculacao-panel";
import { toast } from "sonner";

const TIPOS = [
  { v: "corrente", l: "Conta corrente" },
  { v: "poupanca", l: "Poupança" },
  { v: "carteira", l: "Carteira / dinheiro" },
  { v: "investimento", l: "Investimento" },
  { v: "outra", l: "Outra" },
];

type Conta = {
  id: string;
  nome: string;
  instituicao: string | null;
  tipo: string;
  saldo_inicial: number;
  data_saldo_inicial: string;
  saldo_banco: number | null;
  data_saldo_banco: string | null;
  ultima_conferencia: string | null;
  ativa: boolean;
  observacoes: string | null;
};

type FormState = {
  id: string | null;
  nome: string;
  instituicao: string;
  tipo: string;
  saldo_inicial: string;
  data_saldo_inicial: string;
  saldo_banco: string;
  data_saldo_banco: string;
  ativa: boolean;
  observacoes: string;
};

const vazio = (): FormState => ({
  id: null,
  nome: "",
  instituicao: "",
  tipo: "corrente",
  saldo_inicial: "",
  data_saldo_inicial: hojeISO(),
  saldo_banco: "",
  data_saldo_banco: "",
  ativa: true,
  observacoes: "",
});

const num = (s: string) => {
  const n = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

export function ContasPanel({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["contas"],
    queryFn: async () => {
      const [contas, receitas, despesas] = await Promise.all([
        (supabase.from as any)("contas").select("*").order("nome"),
        (supabase.from as any)("receitas").select("conta_id,valor,status").not("conta_id", "is", null),
        (supabase.from as any)("despesas").select("conta_id,valor,status").not("conta_id", "is", null),
      ]);
      return {
        contas: (contas.data ?? []) as Conta[],
        receitas: (receitas.data ?? []) as any[],
        despesas: (despesas.data ?? []) as any[],
      };
    },
  });

  const linhas = useMemo(() => {
    const contas = data?.contas ?? [];
    return contas.map((c) => {
      const recs = (data?.receitas ?? []).filter((r) => r.conta_id === c.id);
      const desps = (data?.despesas ?? []).filter((d) => d.conta_id === c.id);
      const entradas = recs
        .filter((r) => r.status === "RECEBIDO")
        .reduce((s, r) => s + Number(r.valor), 0);
      const saidas = desps
        .filter((d) => d.status === "PAGO")
        .reduce((s, d) => s + Number(d.valor), 0);
      const receitasFuturas = recs
        .filter((r) => r.status !== "RECEBIDO")
        .reduce((s, r) => s + Number(r.valor), 0);
      const despesasFuturas = desps
        .filter((d) => d.status !== "PAGO")
        .reduce((s, d) => s + Number(d.valor), 0);
      const pendencias =
        recs.filter((r) => r.status !== "RECEBIDO").length +
        desps.filter((d) => d.status !== "PAGO").length;
      const calculado = Number(c.saldo_inicial) + entradas - saidas;
      const projetado = calculado + receitasFuturas - despesasFuturas;
      const informado = c.saldo_banco === null ? null : Number(c.saldo_banco);
      const diferenca = informado === null ? null : informado - calculado;
      return {
        conta: c, entradas, saidas, calculado, informado, diferenca,
        receitasFuturas, despesasFuturas, pendencias, projetado,
      };
    });
  }, [data]);

  const totais = useMemo(() => {
    const calc = linhas.filter((l) => l.conta.ativa).reduce((s, l) => s + l.calculado, 0);
    const inf = linhas
      .filter((l) => l.conta.ativa && l.informado !== null)
      .reduce((s, l) => s + (l.informado as number), 0);
    const comInformado = linhas.some((l) => l.conta.ativa && l.informado !== null);
    return { calc, inf, comInformado };
  }, [linhas]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contas"] });
    qc.invalidateQueries({ queryKey: ["fin"] });
  };

  const abrirNovo = () => setForm(vazio());

  const abrirEdicao = (c: Conta) =>
    setForm({
      id: c.id,
      nome: c.nome,
      instituicao: c.instituicao ?? "",
      tipo: c.tipo,
      saldo_inicial: String(c.saldo_inicial ?? ""),
      data_saldo_inicial: c.data_saldo_inicial,
      saldo_banco: c.saldo_banco === null ? "" : String(c.saldo_banco),
      data_saldo_banco: c.data_saldo_banco ?? "",
      ativa: c.ativa,
      observacoes: c.observacoes ?? "",
    });

  const salvar = async () => {
    if (!form) return;
    if (!form.nome.trim()) {
      toast.error("Informe o nome da conta");
      return;
    }
    setSaving(true);
    const informouSaldoBanco = form.saldo_banco.trim() !== "";
    const payload: any = {
      user_id: userId,
      nome: form.nome.trim(),
      instituicao: form.instituicao.trim() || null,
      tipo: form.tipo,
      saldo_inicial: num(form.saldo_inicial),
      data_saldo_inicial: form.data_saldo_inicial || hojeISO(),
      saldo_banco: informouSaldoBanco ? num(form.saldo_banco) : null,
      data_saldo_banco: informouSaldoBanco ? form.data_saldo_banco || hojeISO() : null,
      ultima_conferencia: informouSaldoBanco ? new Date().toISOString() : null,
      ativa: form.ativa,
      observacoes: form.observacoes.trim() || null,
    };
    const res = form.id
      ? await (supabase.from as any)("contas").update(payload).eq("id", form.id)
      : await (supabase.from as any)("contas").insert(payload);
    setSaving(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    toast.success(form.id ? "Conta atualizada" : "Conta criada");
    setForm(null);
    refresh();
  };

  const excluir = async (c: Conta) => {
    if (!confirm(`Excluir a conta "${c.nome}"? Os lançamentos são preservados e apenas perdem o vínculo com ela.`)) return;
    const { error } = await (supabase.from as any)("contas").delete().eq("id", c.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Conta excluída");
    refresh();
  };

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Carregando contas...</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Saldo consolidado das contas ativas
            </p>
            <p className="text-3xl font-bold mt-1">{BRL(totais.calc)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Calculado a partir dos lançamentos já realizados e vinculados a cada conta.
              {totais.comInformado && (
                <> Informado pelo banco: <strong>{BRL(totais.inf)}</strong>.</>
              )}
            </p>
          </div>
          <Button onClick={abrirNovo} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Nova conta
          </Button>
        </div>
      </Card>

      {linhas.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          Nenhuma conta cadastrada ainda. Cadastre suas contas reais (banco, carteira, poupança)
          para acompanhar quanto dinheiro existe em cada uma e comparar com o extrato.
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {linhas.map(({ conta, entradas, saidas, calculado, informado, diferenca, receitasFuturas, despesasFuturas, pendencias, projetado }) => {
          const divergente = diferenca !== null && Math.abs(diferenca) >= 0.01;
          return (
            <Card key={conta.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Landmark className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-semibold leading-tight">{conta.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {conta.instituicao || "Sem instituição"} ·{" "}
                      {TIPOS.find((t) => t.v === conta.tipo)?.l ?? conta.tipo}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {!conta.ativa && <Badge variant="secondary">Inativa</Badge>}
                  <Button size="icon" variant="ghost" onClick={() => abrirEdicao(conta)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => excluir(conta)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Calculado</p>
                  <p className="text-sm font-semibold">{BRL(calculado)}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">No banco</p>
                  <p className="text-sm font-semibold">
                    {informado === null ? "—" : BRL(informado)}
                  </p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Diferença</p>
                  <p className="text-sm font-semibold">
                    {diferenca === null ? "—" : BRL(diferenca)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Saldo atual (realizado)</p>
                  <p className="text-sm font-semibold">{BRL(calculado)}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Saldo projetado</p>
                  <p className="text-sm font-semibold">{BRL(projetado)}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Receitas futuras</p>
                  <p className="text-sm font-semibold">{BRL(receitasFuturas)}</p>
                </div>
                <div className="rounded-md border p-2">
                  <p className="text-[10px] uppercase text-muted-foreground">Despesas futuras</p>
                  <p className="text-sm font-semibold">{BRL(despesasFuturas)}</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Pendências nesta conta: <strong>{pendencias}</strong>
              </p>

              <div className="flex items-center gap-2 text-xs">
                {informado === null ? (
                  <span className="text-muted-foreground">
                    Informe o saldo do extrato para conferir esta conta.
                  </span>
                ) : divergente ? (
                  <span className="flex items-center gap-1 text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Divergência de {BRL(Math.abs(diferenca as number))} entre o app e o banco.
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Conferido: app e banco batem.
                  </span>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">
                Saldo inicial {BRL(Number(conta.saldo_inicial))} · entradas realizadas {BRL(entradas)} ·
                saídas realizadas {BRL(saidas)}
                {conta.ultima_conferencia && (
                  <> · última conferência {new Date(conta.ultima_conferencia).toLocaleDateString("pt-BR")}</>
                )}
              </p>
            </Card>
          );
        })}
      </div>

      <VinculacaoPanel />

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar conta" : "Nova conta"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Conta Principal"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Instituição</Label>
                  <Input
                    value={form.instituicao}
                    onChange={(e) => setForm({ ...form, instituicao: e.target.value })}
                    placeholder="Ex.: Banco do Brasil"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => (
                        <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Saldo inicial</Label>
                  <Input
                    value={form.saldo_inicial}
                    onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })}
                    placeholder="0,00"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Data do saldo inicial</Label>
                  <DatePicker
                    value={form.data_saldo_inicial}
                    onChange={(v) => setForm({ ...form, data_saldo_inicial: v })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Saldo informado pelo banco</Label>
                  <Input
                    value={form.saldo_banco}
                    onChange={(e) => setForm({ ...form, saldo_banco: e.target.value })}
                    placeholder="Opcional"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Data do extrato</Label>
                  <DatePicker
                    value={form.data_saldo_banco}
                    onChange={(v) => setForm({ ...form, data_saldo_banco: v })}
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label>Observações</Label>
                <Input
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O saldo do banco é guardado separadamente e nunca sobrescreve o saldo calculado
                pelos seus lançamentos — ele serve para mostrar a diferença.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
