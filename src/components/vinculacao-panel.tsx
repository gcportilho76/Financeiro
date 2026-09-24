import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BRL } from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, History } from "lucide-react";

const A_DEFINIR = "__sem__";

type Conta = { id: string; nome: string; ativa: boolean };

type Linha = {
  id: string;
  tabela: "receitas" | "despesas";
  tipo: "Receita" | "Despesa";
  data: string;
  descricao: string;
  categoria: string;
  forma: string;
  valor: number;
  status: string;
  conciliacao: string;
  conta_id: string | null;
};

const realizado = (l: Linha) =>
  l.tipo === "Receita" ? l.status === "RECEBIDO" : l.status === "PAGO";

export function VinculacaoPanel() {
  const qc = useQueryClient();
  const [fConta, setFConta] = useState("todas");
  const [fTipo, setFTipo] = useState("todos");
  const [fPag, setFPag] = useState("todos");
  const [fConc, setFConc] = useState("todos");
  const [fValor, setFValor] = useState("todos");
  const [ordem, setOrdem] = useState("data");
  const [soSemConta, setSoSemConta] = useState(false);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [destino, setDestino] = useState<string>(A_DEFINIR);
  const [confirmar, setConfirmar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verHistorico, setVerHistorico] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["vinculacao"],
    queryFn: async () => {
      const [contas, receitas, despesas] = await Promise.all([
        (supabase.from as any)("contas").select("id,nome,ativa").order("nome"),
        (supabase.from as any)("receitas")
          .select("id,data,descricao,categoria,valor,status,status_conciliacao,conta_id,origem")
          .order("data", { ascending: false }),
        (supabase.from as any)("despesas")
          .select("id,data_venc,descricao,categoria,valor,status,status_conciliacao,conta_id,origem,tipo")
          .order("data_venc", { ascending: false }),
      ]);
      const linhas: Linha[] = [
        ...((receitas.data ?? []) as any[]).map((r) => ({
          id: r.id, tabela: "receitas" as const, tipo: "Receita" as const,
          data: r.data, descricao: r.descricao, categoria: r.categoria,
          forma: r.origem ?? "manual",
          valor: Number(r.valor), status: r.status,
          conciliacao: r.status_conciliacao ?? "NAO_CONCILIADO", conta_id: r.conta_id,
        })),
        ...((despesas.data ?? []) as any[]).map((d) => ({
          id: d.id, tabela: "despesas" as const, tipo: "Despesa" as const,
          data: d.data_venc, descricao: d.descricao, categoria: d.categoria,
          forma: [d.tipo, d.origem].filter(Boolean).join(" · "),
          valor: Number(d.valor), status: d.status,
          conciliacao: d.status_conciliacao ?? "NAO_CONCILIADO", conta_id: d.conta_id,
        })),
      ].sort((a, b) => (a.data < b.data ? 1 : -1));
      return { contas: (contas.data ?? []) as Conta[], linhas };
    },
  });

  const { data: historico } = useQuery({
    queryKey: ["vinculacao-log"],
    queryFn: async () => {
      const { data } = await (supabase.from as any)("vinculacao_log")
        .select("*").order("created_at", { ascending: false }).limit(200);
      return (data ?? []) as any[];
    },
  });

  const contas = data?.contas ?? [];
  const linhas = data?.linhas ?? [];
  const nomeConta = (id: string | null) =>
    contas.find((c) => c.id === id)?.nome ?? "A definir";

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const out = linhas.filter((l) => {
      if (soSemConta && l.conta_id) return false;
      if (fConta === "sem" && l.conta_id) return false;
      if (fConta !== "todas" && fConta !== "sem" && l.conta_id !== fConta) return false;
      if (fTipo === "receita" && l.tipo !== "Receita") return false;
      if (fTipo === "despesa" && l.tipo !== "Despesa") return false;
      if (fPag === "realizado" && !realizado(l)) return false;
      if (fPag === "pendente" && realizado(l)) return false;
      if (fConc === "conciliado" && l.conciliacao !== "CONCILIADO") return false;
      if (fConc === "nao" && l.conciliacao === "CONCILIADO") return false;
      if (fValor === "ate100" && !(l.valor <= 100)) return false;
      if (fValor === "100a500" && !(l.valor > 100 && l.valor <= 500)) return false;
      if (fValor === "500a1000" && !(l.valor > 500 && l.valor <= 1000)) return false;
      if (fValor === "acima1000" && !(l.valor > 1000)) return false;
      if (q && !`${l.descricao} ${l.categoria} ${nomeConta(l.conta_id)}`.toLowerCase().includes(q))
        return false;
      return true;
    });
    if (ordem === "maior") out.sort((a, b) => b.valor - a.valor);
    else if (ordem === "menor") out.sort((a, b) => a.valor - b.valor);
    return out;
  }, [linhas, fConta, fTipo, fPag, fConc, fValor, ordem, soSemConta, busca, contas]);

  const selecionadas = filtradas.filter((l) => sel[l.id]);
  const semConta = linhas.filter((l) => !l.conta_id).length;
  const vinculados = linhas.length - semConta;
  const pct = linhas.length ? Math.round((vinculados / linhas.length) * 100) : 0;

  const resumo = useMemo(() => {
    const rec = linhas.filter((l) => l.tipo === "Receita");
    const desp = linhas.filter((l) => l.tipo === "Despesa");
    return {
      total: linhas.length,
      recSem: rec.filter((l) => !l.conta_id).length,
      despSem: desp.filter((l) => !l.conta_id).length,
      recVinc: rec.filter((l) => l.conta_id).length,
      recTotal: rec.length,
      despVinc: desp.filter((l) => l.conta_id).length,
      despTotal: desp.length,
      conciliados: linhas.filter((l) => l.conciliacao === "CONCILIADO").length,
      porConta: contas.map((c) => ({
        ...c, qtd: linhas.filter((l) => l.conta_id === c.id).length,
      })),
    };
  }, [linhas, contas]);

  const toggleTodos = (on: boolean) => {
    const n: Record<string, boolean> = { ...sel };
    filtradas.forEach((l) => { n[l.id] = on; });
    setSel(n);
  };

  const registrarLog = async (alvos: Linha[], contaId: string | null) => {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user?.id;
    if (!userId) return;
    const rows = alvos.map((l) => ({
      user_id: userId,
      lancamento_id: l.id,
      tabela: l.tabela,
      descricao: l.descricao,
      valor: l.valor,
      conta_anterior_id: l.conta_id,
      conta_anterior_nome: nomeConta(l.conta_id),
      conta_nova_id: contaId,
      conta_nova_nome: contaId ? nomeConta(contaId) : "A definir",
    }));
    await (supabase.from as any)("vinculacao_log").insert(rows);
    qc.invalidateQueries({ queryKey: ["vinculacao-log"] });
  };

  const aplicar = async () => {
    setSaving(true);
    const contaId = destino === A_DEFINIR ? null : destino;
    const alvos = [...selecionadas];
    const porTabela = {
      receitas: alvos.filter((l) => l.tabela === "receitas").map((l) => l.id),
      despesas: alvos.filter((l) => l.tabela === "despesas").map((l) => l.id),
    };
    let erro: string | null = null;
    for (const t of ["receitas", "despesas"] as const) {
      const ids = porTabela[t];
      if (!ids.length) continue;
      const { error } = await (supabase.from as any)(t)
        .update({ conta_id: contaId }).in("id", ids);
      if (error) erro = error.message;
    }
    if (!erro) await registrarLog(alvos, contaId);
    setSaving(false);
    setConfirmar(false);
    if (erro) { toast.error(erro); return; }
    toast.success(`${alvos.length} lançamento(s) atualizados`);
    setSel({});
    qc.invalidateQueries({ queryKey: ["vinculacao"] });
    qc.invalidateQueries({ queryKey: ["contas"] });
    qc.invalidateQueries({ queryKey: ["fin"] });
  };

  const alterarUma = async (l: Linha, valor: string) => {
    const contaId = valor === A_DEFINIR ? null : valor;
    if (contaId === l.conta_id) return;
    const { error } = await (supabase.from as any)(l.tabela)
      .update({ conta_id: contaId }).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    await registrarLog([l], contaId);
    qc.invalidateQueries({ queryKey: ["vinculacao"] });
    qc.invalidateQueries({ queryKey: ["contas"] });
    qc.invalidateQueries({ queryKey: ["fin"] });
  };

  if (isLoading) {
    return <Card className="p-6 text-sm text-muted-foreground">Carregando lançamentos…</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vinculação de lançamentos às contas
            </p>
            <p className="text-lg font-semibold mt-1">
              {semConta > 0
                ? `${semConta} lançamentos aguardando vinculação`
                : "Todos os lançamentos estão classificados"}
            </p>
          </div>
          {semConta > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {semConta} sem conta
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Todos vinculados
            </Badge>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Progresso da vinculação: {vinculados} de {resumo.total} vinculados</span>
            <span>{pct}% concluído</span>
          </div>
          <Progress value={pct} />
        </div>

        <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] text-muted-foreground">Receitas sem conta</p>
            <p className="text-xl font-semibold">{resumo.recSem}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] text-muted-foreground">Despesas sem conta</p>
            <p className="text-xl font-semibold">{resumo.despSem}</p>
          </div>
          {resumo.porConta.map((c) => (
            <div key={c.id} className="rounded-lg border p-3">
              <p className="text-[11px] text-muted-foreground">{c.nome}</p>
              <p className="text-xl font-semibold">{c.qtd}</p>
            </div>
          ))}
        </div>

        {semConta === 0 && resumo.total > 0 && (
          <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
            <p className="font-semibold">
              Vinculação concluída: {resumo.total}/{resumo.total} lançamentos classificados.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {resumo.recTotal} receitas e {resumo.despTotal} despesas com conta definida. Nenhum
              valor, data, descrição, categoria ou situação foi alterado — só a conta vinculada.
              Compras de cartão continuam fora do saldo bancário até o pagamento da fatura.
            </p>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Nenhuma conta é atribuída automaticamente: os lançamentos ficam como <strong>A definir</strong> até
          você escolher. Compras de cartão não aparecem aqui — elas só afetam a conta quando a fatura é paga.
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
          <Select value={fConta} onValueChange={setFConta}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as contas</SelectItem>
              <SelectItem value="sem">A definir</SelectItem>
              {contas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={fTipo} onValueChange={setFTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Receitas e despesas</SelectItem>
              <SelectItem value="receita">Só receitas</SelectItem>
              <SelectItem value="despesa">Só despesas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fPag} onValueChange={setFPag}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer situação</SelectItem>
              <SelectItem value="realizado">Realizados (pago/recebido)</SelectItem>
              <SelectItem value="pendente">Pendentes / previstos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fConc} onValueChange={setFConc}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Conciliação: todas</SelectItem>
              <SelectItem value="conciliado">Conciliado</SelectItem>
              <SelectItem value="nao">Não conciliado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fValor} onValueChange={setFValor}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer valor</SelectItem>
              <SelectItem value="ate100">Até R$ 100</SelectItem>
              <SelectItem value="100a500">R$ 100 a R$ 500</SelectItem>
              <SelectItem value="500a1000">R$ 500 a R$ 1.000</SelectItem>
              <SelectItem value="acima1000">Acima de R$ 1.000</SelectItem>
            </SelectContent>
          </Select>
          <Select value={ordem} onValueChange={setOrdem}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="data">Ordenar por data</SelectItem>
              <SelectItem value="maior">Maior valor → menor</SelectItem>
              <SelectItem value="menor">Menor valor → maior</SelectItem>
            </SelectContent>
          </Select>
          <Input
            className="lg:col-span-2"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar descrição (ex.: Uber, Supermercado, Salário)..."
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={soSemConta} onCheckedChange={(v) => setSoSemConta(!!v)} />
          Somente lançamentos A definir
        </label>

        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <Button size="sm" variant="outline" onClick={() => toggleTodos(true)}>
            Selecionar {filtradas.length} da lista
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSel({})}>Limpar seleção</Button>
          <Button size="sm" variant="ghost" className="gap-1" onClick={() => setVerHistorico(true)}>
            <History className="h-4 w-4" /> Histórico
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Select value={destino} onValueChange={setDestino}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={A_DEFINIR}>A definir</SelectItem>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={selecionadas.length === 0}
              onClick={() => setConfirmar(true)}
            >
              Alterar conta ({selecionadas.length})
            </Button>
          </div>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="p-2 w-8">
                <Checkbox
                  checked={filtradas.length > 0 && filtradas.every((l) => sel[l.id])}
                  onCheckedChange={(v) => toggleTodos(!!v)}
                />
              </th>
              <th className="p-2 text-left">Data</th>
              <th className="p-2 text-left">Descrição</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-right">Valor</th>
              <th className="p-2 text-left">Categoria</th>
              <th className="p-2 text-left">Forma</th>
              <th className="p-2 text-left">Pagamento</th>
              <th className="p-2 text-left">Conciliação</th>
              <th className="p-2 text-left">Conta</th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((l) => (
              <tr key={l.id} className={`border-t ${!l.conta_id ? "bg-destructive/5" : ""}`}>
                <td className="p-2">
                  <Checkbox
                    checked={!!sel[l.id]}
                    onCheckedChange={(v) => setSel({ ...sel, [l.id]: !!v })}
                  />
                </td>
                <td className="p-2 whitespace-nowrap">
                  {l.data ? new Date(`${l.data}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="p-2">{l.descricao}</td>
                <td className="p-2">
                  <Badge variant={l.tipo === "Receita" ? "secondary" : "outline"}>{l.tipo}</Badge>
                </td>
                <td className="p-2 text-right whitespace-nowrap">{BRL(l.valor)}</td>
                <td className="p-2">{l.categoria}</td>
                <td className="p-2 text-xs text-muted-foreground">{l.forma || "—"}</td>
                <td className="p-2 text-xs">{l.status}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {l.conciliacao === "CONCILIADO" ? "conciliado" : "não conciliado"}
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={l.conta_id ?? A_DEFINIR}
                      onValueChange={(v) => alterarUma(l, v)}
                    >
                      <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value={A_DEFINIR}>A definir</SelectItem>
                        {contas.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!l.conta_id && (
                      <Badge variant="destructive" className="text-[10px]">A definir</Badge>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr>
                <td colSpan={10} className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum lançamento com esses filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar alteração de conta</DialogTitle>
            <DialogDescription>
              Você está prestes a vincular {selecionadas.length} lançamento(s) à conta{" "}
              <strong>{destino === A_DEFINIR ? "A definir" : nomeConta(destino)}</strong>. Deseja
              continuar? Valores, datas, categorias e situação de pagamento não são alterados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmar(false)}>Cancelar</Button>
            <Button onClick={aplicar} disabled={saving}>
              {saving ? "Aplicando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={verHistorico} onOpenChange={setVerHistorico}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de vinculação</DialogTitle>
            <DialogDescription>
              Últimas alterações de conta registradas para auditoria.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {(historico ?? []).map((h) => (
              <div key={h.id} className="rounded border p-2 text-xs">
                <p className="font-medium">{h.descricao} · {BRL(Number(h.valor ?? 0))}</p>
                <p className="text-muted-foreground">
                  Conta anterior: {h.conta_anterior_nome ?? "A definir"} → Conta nova:{" "}
                  {h.conta_nova_nome ?? "A definir"}
                </p>
                <p className="text-muted-foreground">
                  {new Date(h.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
            ))}
            {(historico ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma alteração registrada ainda.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
