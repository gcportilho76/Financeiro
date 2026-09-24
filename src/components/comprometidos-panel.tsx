import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Landmark, Receipt, ListFilter, Plus, Pencil, Trash2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRL, formatCompetencia, proxCompetencia } from "@/lib/finance";

type Filtro = "todos" | "cartoes" | "consignados" | "despesas";
type Bloco = "cartoes" | "consignados" | "despesas";

type Linha = {
  id: string;
  bloco: Bloco;
  origem: string;
  descricao: string;
  categoria: string;
  parcela: string;
  parcela_num: number;
  parcela_total: number;
  tipo?: string;
  valor: number;
};

type FormState = {
  bloco: Bloco;
  id: string | null;
  origem: string;
  descricao: string;
  categoria: string;
  valor: string;
  parcela_num: string;
  parcela_total: string;
  tipo: string;
};

function limparParcela(desc: string) {
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

const vazio = (bloco: Bloco): FormState => ({
  bloco,
  id: null,
  origem: bloco === "cartoes" ? "Geral" : "",
  descricao: "",
  categoria: bloco === "cartoes" ? "Cartão" : "Outros",
  valor: "",
  parcela_num: "1",
  parcela_total: "1",
  tipo: "variavel",
});

export function ComprometidosPanel({ comp, contratos }: { comp: string; contratos: any[] }) {
  const alvo = proxCompetencia(comp);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [expandido, setExpandido] = useState<Bloco | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState<Record<Bloco, string>>({ cartoes: "", consignados: "", despesas: "" });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["comprometidos", alvo],
    queryFn: async () => {
      const [cartoes, despesas] = await Promise.all([
        supabase.from("cartoes_lancamentos").select("*").eq("competencia", alvo).eq("ativo", true),
        supabase.from("despesas").select("*").eq("competencia", alvo),
      ]);
      return {
        cartoes: cartoes.data ?? [],
        despesas: despesas.data ?? [],
      };
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["comprometidos"] });
    qc.invalidateQueries({ queryKey: ["fin"] });
  };

  const linhas = useMemo<Linha[]>(() => {
    const out: Linha[] = [];
    for (const c of data?.cartoes ?? []) {
      out.push({
        id: c.id,
        bloco: "cartoes",
        origem: c.cartao,
        descricao: limparParcela(c.descricao),
        categoria: c.categoria,
        parcela: `${c.parcela_num}/${c.parcela_total}`,
        parcela_num: Number(c.parcela_num),
        parcela_total: Number(c.parcela_total),
        valor: Number(c.valor),
      });
    }
    for (const ct of contratos ?? []) {
      if (!ct.ativo) continue;
      const prox = Number(ct.parcela_atual) + 1;
      if (prox > Number(ct.total_parcelas)) continue;
      out.push({
        id: ct.id,
        bloco: "consignados",
        origem: ct.banco ?? "Consignado",
        descricao: ct.nome,
        categoria: "Consignado",
        parcela: `${prox}/${ct.total_parcelas}`,
        parcela_num: prox,
        parcela_total: Number(ct.total_parcelas),
        valor: Number(ct.valor_parcela),
      });
    }
    for (const d of data?.despesas ?? []) {
      out.push({
        id: d.id,
        bloco: "despesas",
        origem: d.tipo === "fixa" ? "Despesa fixa" : "Despesa variável",
        descricao: d.descricao,
        categoria: d.categoria,
        parcela: "—",
        parcela_num: 1,
        parcela_total: 1,
        tipo: d.tipo,
        valor: Number(d.valor),
      });
    }
    return out.sort((a, b) => b.valor - a.valor);
  }, [data, contratos]);

  const totalPor = (b: Bloco) =>
    linhas.filter((l) => l.bloco === b).reduce((s, l) => s + l.valor, 0);

  const visiveis = filtro === "todos" ? linhas : linhas.filter((l) => l.bloco === filtro);
  const total = visiveis.reduce((s, l) => s + l.valor, 0);

  const filtros: { id: Filtro; label: string; icon: any; total: number }[] = [
    { id: "todos", label: "Todos", icon: <ListFilter className="w-4 h-4" />, total: linhas.reduce((s, l) => s + l.valor, 0) },
    { id: "cartoes", label: "Cartões", icon: <CreditCard className="w-4 h-4" />, total: totalPor("cartoes") },
    { id: "consignados", label: "Consignados", icon: <Landmark className="w-4 h-4" />, total: totalPor("consignados") },
    { id: "despesas", label: "Despesas", icon: <Receipt className="w-4 h-4" />, total: totalPor("despesas") },
  ];

  const totalGeral = linhas.reduce((s, l) => s + l.valor, 0);

  const resumo = useMemo(() => {
    const base: { id: Filtro; label: string; barra: string; total: number }[] = [
      { id: "cartoes", label: "Cartões", barra: "bg-chart-2", total: totalPor("cartoes") },
      { id: "consignados", label: "Consignados", barra: "bg-chart-4", total: totalPor("consignados") },
      { id: "despesas", label: "Despesas", barra: "bg-chart-3", total: totalPor("despesas") },
    ];
    const maiorPct = totalGeral > 0 ? Math.max(...base.map((b) => (b.total / totalGeral) * 100)) : 0;
    return base.map((b) => {
      const pct = totalGeral > 0 ? (b.total / totalGeral) * 100 : 0;
      return { ...b, pct, diff: totalGeral > 0 ? pct - maiorPct : null };
    });
  }, [linhas, totalGeral]);



  const abrirNovo = () => {
    const bloco: Bloco = filtro === "despesas" ? "despesas" : "cartoes";
    setForm(vazio(bloco));
  };

  const abrirEdicao = (l: Linha) => {
    setForm({
      bloco: l.bloco,
      id: l.id,
      origem: l.bloco === "consignados" ? l.origem : l.origem,
      descricao: l.descricao,
      categoria: l.categoria,
      valor: String(l.valor),
      parcela_num: String(l.parcela_num),
      parcela_total: String(l.parcela_total),
      tipo: l.tipo ?? "variavel",
    });
  };

  const salvar = async () => {
    if (!form) return;
    const valor = Number(String(form.valor).replace(",", "."));
    if (!form.descricao.trim() || !Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe descrição e valor válidos.");
      return;
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada.");

      if (form.bloco === "cartoes") {
        const payload = {
          cartao: form.origem || "Geral",
          descricao: form.descricao.trim(),
          categoria: form.categoria || "Cartão",
          valor,
          parcela_num: Number(form.parcela_num) || 1,
          parcela_total: Number(form.parcela_total) || 1,
        };
        const { error } = form.id
          ? await supabase.from("cartoes_lancamentos").update(payload).eq("id", form.id)
          : await supabase.from("cartoes_lancamentos").insert({
              ...payload,
              user_id: uid,
              competencia: alvo,
              status: "PENDENTE",
              ativo: true,
            });
        if (error) throw error;
      } else if (form.bloco === "despesas") {
        const payload = {
          descricao: form.descricao.trim(),
          categoria: form.categoria || "Outros",
          valor,
          tipo: form.tipo,
        };
        const { error } = form.id
          ? await supabase.from("despesas").update(payload).eq("id", form.id)
          : await supabase.from("despesas").insert({
              ...payload,
              user_id: uid,
              competencia: alvo,
              data_venc: alvo,
              status: "PENDENTE",
            });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consignados_contratos")
          .update({
            nome: form.descricao.trim(),
            valor_parcela: valor,
            total_parcelas: Number(form.parcela_total) || 1,
          })
          .eq("id", form.id!);
        if (error) throw error;
      }
      toast.success("Salvo com sucesso.");
      setForm(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const excluir = async (l: Linha) => {
    const msg =
      l.bloco === "consignados"
        ? `Desativar o contrato "${l.descricao}"? Ele deixa de ser comprometido.`
        : `Excluir "${l.descricao}"?`;
    if (!confirm(msg)) return;
    try {
      if (l.bloco === "cartoes") {
        const { error } = await supabase.from("cartoes_lancamentos").delete().eq("id", l.id);
        if (error) throw error;
      } else if (l.bloco === "despesas") {
        const { error } = await supabase.from("despesas").delete().eq("id", l.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("consignados_contratos")
          .update({ ativo: false })
          .eq("id", l.id);
        if (error) throw error;
      }
      toast.success("Removido.");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao remover.");
    }
  };

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            PARCELAS COMPROMETIDAS — <span className="capitalize">{formatCompetencia(alvo)}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Somente o que já está lançado/parcelado para o próximo mês.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total do filtro</div>
            <div className="text-2xl font-bold tabular">{BRL(total)}</div>
          </div>
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="w-4 h-4 mr-1" /> Novo
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total geral comprometido</div>
            <div className="text-3xl font-bold tabular">{BRL(totalGeral)}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {linhas.length} lançamento{linhas.length !== 1 ? "s" : ""} em {formatCompetencia(alvo)}
          </div>
        </div>

        {totalGeral > 0 && (
          <>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-border mb-3">
              {resumo.map((r) => (
                <div key={r.id} className={r.barra} style={{ width: `${r.pct}%` }} title={`${r.label}: ${r.pct.toFixed(1)}%`} />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              {resumo.map((r) => {
                const bloco = r.id as Bloco;
                const itens = linhas.filter((l) => l.bloco === bloco);
                const termo = (busca[bloco] ?? "").trim().toLowerCase();
                const itensFiltrados = termo
                  ? itens.filter((l) =>
                      [l.descricao, l.origem, l.parcela].some((v) => v.toLowerCase().includes(termo))
                    )
                  : itens;
                const aberto = expandido === bloco;
                return (
                  <div key={r.id} className="rounded-md border border-border bg-card">
                    <button
                      onClick={() => setExpandido(aberto ? null : bloco)}
                      className="w-full text-left p-3 hover:border-primary/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.barra}`} />
                          {r.label}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
                      </div>
                      <div className="mt-1 text-lg font-semibold tabular">{BRL(r.total)}</div>
                      <div className="text-xs text-muted-foreground tabular">
                        {r.pct.toFixed(1)}% do total
                        {r.diff !== null && (
                          <span className="ml-1">
                            · {r.diff >= 0 ? "+" : "−"}{Math.abs(r.diff).toFixed(1)} p.p. vs maior
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {itens.length} lançamento{itens.length !== 1 ? "s" : ""} · toque para {aberto ? "ocultar" : "ver"} a composição
                      </div>
                    </button>

                    {aberto && (
                      <div className="border-t border-border px-3 py-2">
                        <div className="mb-2">
                          <Input
                            placeholder="Buscar descrição, origem ou parcela..."
                            value={busca[bloco]}
                            onChange={(e) => setBusca({ ...busca, [bloco]: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                        {itensFiltrados.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-1">Nenhum lançamento neste bloco.</p>
                        ) : (
                          <ul className="divide-y divide-border/60">
                            {itensFiltrados.map((l) => (
                              <li key={l.id} className="py-1.5 flex items-start justify-between gap-2 text-xs">
                                <span className="min-w-0">
                                  <span className="block truncate">{l.descricao}</span>
                                  <span className="text-muted-foreground">
                                    {l.origem}
                                    {l.parcela !== "—" ? ` · ${l.parcela}` : ""}
                                  </span>
                                </span>
                                <span className="tabular font-medium whitespace-nowrap">{BRL(l.valor)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-border text-xs font-semibold">
                          <span>Subtotal ({itensFiltrados.length})</span>
                          <span className="tabular">{BRL(itensFiltrados.reduce((s, l) => s + l.valor, 0))}</span>
                        </div>
                        <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => setFiltro(r.id)}>
                          Filtrar tabela por {r.label}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

          </>
        )}
      </div>



      <div className="flex flex-wrap gap-2 mb-4">
        {filtros.map((f) => (
          <Button
            key={f.id}
            size="sm"
            variant={filtro === f.id ? "default" : "outline"}
            onClick={() => setFiltro(f.id)}
          >
            <span className="mr-1.5">{f.icon}</span>
            {f.label}
            <span className="ml-2 tabular text-xs opacity-80">{BRL(f.total)}</span>
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
      ) : visiveis.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Nenhum lançamento comprometido neste filtro.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Lançamento</th>
                <th className="py-2 pr-3 font-medium">Origem</th>
                <th className="py-2 pr-3 font-medium">Categoria</th>
                <th className="py-2 pr-3 font-medium">Parcela</th>
                <th className="py-2 pr-3 text-right font-medium">Valor</th>
                <th className="py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((l) => (
                <tr key={`${l.bloco}-${l.id}`} className="border-b border-border/60">
                  <td className="py-2 pr-3">{l.descricao}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{l.origem}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline" className="text-[11px]">{l.categoria}</Badge>
                  </td>
                  <td className="py-2 pr-3 tabular text-muted-foreground">{l.parcela}</td>
                  <td className="py-2 pr-3 text-right tabular font-medium">{BRL(l.valor)}</td>
                  <td className="py-2 text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => abrirEdicao(l)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => excluir(l)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-3 pr-3 font-semibold" colSpan={3}>
                  Total ({visiveis.length} lançamento{visiveis.length !== 1 ? "s" : ""})
                </td>
                <td />
                <td className="py-3 pr-3 text-right font-bold tabular">{BRL(total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.id ? "Editar lançamento" : "Novo comprometido"} — {formatCompetencia(alvo)}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-3">
              {!form.id && (
                <div>
                  <Label>Tipo de lançamento</Label>
                  <Select
                    value={form.bloco}
                    onValueChange={(v) => setForm({ ...vazio(v as Bloco) })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cartoes">Cartão</SelectItem>
                      <SelectItem value="despesas">Despesa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label>Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Ex.: Mentoria Run"
                />
              </div>

              {form.bloco === "cartoes" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Cartão</Label>
                    <Input value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                  </div>
                  <div>
                    <Label>Parcela atual</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.parcela_num}
                      onChange={(e) => setForm({ ...form, parcela_num: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Total de parcelas</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.parcela_total}
                      onChange={(e) => setForm({ ...form, parcela_total: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {form.bloco === "despesas" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Categoria</Label>
                    <Input value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
                  </div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixa">Fixa</SelectItem>
                        <SelectItem value="variavel">Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {form.bloco === "consignados" && (
                <div>
                  <Label>Total de parcelas</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.parcela_total}
                    onChange={(e) => setForm({ ...form, parcela_total: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Editar aqui altera o contrato do consignado.
                  </p>
                </div>
              )}

              <div>
                <Label>Valor (R$)</Label>
                <Input
                  inputMode="decimal"
                  value={form.valor}
                  onChange={(e) => setForm({ ...form, valor: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
