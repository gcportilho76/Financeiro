import { useMemo, useState, useEffect } from "react";
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

// Funções de auxílio seguras sem dependências externas
function BRLSafe(val: number): string {
  try {
    return Number(val || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } catch {
    return `R$ ${(val || 0).toFixed(2)}`;
  }
}

function calcularProximaCompetencia(c?: string): string {
  if (!c) return "2026-11";
  const partes = String(c).split("-").map(Number);
  if (partes.length < 2 || isNaN(partes[0]) || isNaN(partes[1])) return "2026-11";
  let [ano, mes] = partes;
  mes += 1;
  if (mes > 12) {
    mes = 1;
    ano += 1;
  }
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

function formatarCompetenciaTexto(c?: string): string {
  if (!c) return "";
  const partes = String(c).split("-").map(Number);
  if (partes.length < 2 || isNaN(partes[0]) || isNaN(partes[1])) return c;
  const data = new Date(partes[0], partes[1] - 1, 1);
  return data.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function limparParcela(desc: string) {
  if (!desc) return "";
  return desc.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
}

const compParaMeses = (c: string) => {
  if (!c) return 0;
  const [ano, mes] = String(c).split("-").map(Number);
  if (isNaN(ano) || isNaN(mes)) return 0;
  return ano * 12 + mes;
};

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

const LOCAL_STORAGE_KEY = "gute_cartoes_parcelados_v7";

export function ComprometidosPanel({ comp, contratos }: { comp?: string; contratos?: any[] }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const compSegura = comp || "2026-10";
  const alvo = useMemo(() => calcularProximaCompetencia(compSegura), [compSegura]);
  const alvoStr = (alvo || "2026-11").slice(0, 7);
  const alvoMesesInt = compParaMeses(alvoStr);

  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [expandido, setExpandido] = useState<Bloco | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState<Record<Bloco, string>>({ cartoes: "", consignados: "", despesas: "" });
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["comprometidos", alvo],
    queryFn: async () => {
      try {
        const [cartoes, despesas] = await Promise.all([
          supabase.from("cartoes_lancamentos").select("*").eq("ativo", true),
          supabase.from("despesas").select("*").eq("competencia", alvo),
        ]);
        return {
          cartoes: cartoes.data ?? [],
          despesas: despesas.data ?? [],
        };
      } catch (e) {
        console.error("Erro Supabase:", e);
        return { cartoes: [], despesas: [] };
      }
    },
    enabled: isClient,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["comprometidos"] });
    qc.invalidateQueries({ queryKey: ["fin"] });
  };

  const linhas = useMemo<Linha[]>(() => {
    if (!isClient) return [];

    const out: Linha[] = [];

    // 1. Processa Cartões de Crédito (localStorage + Supabase)
    let listaCartoesRaw: any[] = [];
    try {
      if (typeof window !== "undefined") {
        const local = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (local) {
          listaCartoesRaw = JSON.parse(local);
        }
      }
    } catch (e) {
      console.error(e);
    }

    const mapCartoes = new Map<string, any>();
    for (const item of listaCartoesRaw) {
      if (item && item.id) mapCartoes.set(String(item.id), item);
    }
    for (const item of data?.cartoes ?? []) {
      if (item && item.id && !mapCartoes.has(String(item.id))) {
        mapCartoes.set(String(item.id), item);
      }
    }

    for (const c of Array.from(mapCartoes.values())) {
      const pInicial = Number(c.parcela_atual || c.parcela_num) || 1;
      const pTotal = Number(c.total_parcelas || c.parcela_total) || 1;
      const mesInicioStr = String(c.mes_inicio || c.competencia || alvoStr).slice(0, 7);

      const mesInicioInt = compParaMeses(mesInicioStr);
      const pCalculada = pInicial + (alvoMesesInt - mesInicioInt);

      if (pCalculada >= 1 && pCalculada <= pTotal) {
        const vParc = Number(c.valor_parcela || c.valor) || 0;
        out.push({
          id: String(c.id),
          bloco: "cartoes",
          origem: c.cartao || "Cartão",
          descricao: limparParcela(c.descricao || ""),
          categoria: c.categoria || "Cartão",
          parcela: `${pCalculada}/${pTotal}`,
          parcela_num: pCalculada,
          parcela_total: pTotal,
          valor: vParc,
        });
      }
    }

    // 2. Processa Consignados
    for (const ct of contratos ?? []) {
      if (!ct || ct.ativo === false) continue;
      const prox = Number(ct.parcela_atual || 0) + 1;
      const pTotal = Number(ct.total_parcelas || 1);
      if (prox <= pTotal) {
        out.push({
          id: String(ct.id),
          bloco: "consignados",
          origem: ct.banco ?? "Consignado",
          descricao: ct.nome || "Empréstimo",
          categoria: "Consignado",
          parcela: `${prox}/${pTotal}`,
          parcela_num: prox,
          parcela_total: pTotal,
          valor: Number(ct.valor_parcela || 0),
        });
      }
    }

    // 3. Processa Despesas
    for (const d of data?.despesas ?? []) {
      if (!d) continue;
      out.push({
        id: String(d.id),
        bloco: "despesas",
        origem: d.tipo === "fixa" ? "Despesa fixa" : "Despesa variável",
        descricao: d.descricao || "Despesa",
        categoria: d.categoria || "Outros",
        parcela: "—",
        parcela_num: 1,
        parcela_total: 1,
        tipo: d.tipo,
        valor: Number(d.valor || 0),
      });
    }

    return out.sort((a, b) => b.valor - a.valor);
  }, [data, contratos, alvoStr, alvoMesesInt, isClient]);

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
      origem: l.origem,
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

      if (form.bloco === "cartoes") {
        const idNovo = form.id || "parcela_" + Date.now();
        const novoItem = {
          id: idNovo,
          descricao: form.descricao.trim(),
          cartao: form.origem || "Cartão",
          categoria: form.categoria || "Cartão",
          valor_parcela: valor,
          parcela_atual: Number(form.parcela_num) || 1,
          total_parcelas: Number(form.parcela_total) || 1,
          mes_inicio: alvoStr,
        };

        try {
          if (typeof window !== "undefined") {
            const local = localStorage.getItem(LOCAL_STORAGE_KEY);
            let prev: any[] = local ? JSON.parse(local) : [];
            const existe = prev.some((c) => c.id === idNovo);
            const lista = existe
              ? prev.map((c) => (c.id === idNovo ? novoItem : c))
              : [...prev, novoItem];
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(lista));
          }
        } catch (e) {
          console.error(e);
        }

        if (uid) {
          const payload = {
            cartao: form.origem || "Geral",
            descricao: form.descricao.trim(),
            categoria: form.categoria || "Cartão",
            valor,
            valor_parcela: valor,
            parcela_num: Number(form.parcela_num) || 1,
            parcela_atual: Number(form.parcela_num) || 1,
            parcela_total: Number(form.parcela_total) || 1,
            total_parcelas: Number(form.parcela_total) || 1,
          };

          if (form.id && !form.id.startsWith("parcela_")) {
            await supabase.from("cartoes_lancamentos").update(payload).eq("id", form.id);
          } else {
            await supabase.from("cartoes_lancamentos").insert({
              ...payload,
              user_id: uid,
              competencia: alvo,
              mes_inicio: alvo,
              status: "PENDENTE",
              ativo: true,
            });
          }
        }
      } else if (form.bloco === "despesas") {
        if (!uid) throw new Error("Sessão expirada.");
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
        try {
          if (typeof window !== "undefined") {
            const local = localStorage.getItem(LOCAL_STORAGE_KEY);
            if (local) {
              const prev: any[] = JSON.parse(local);
              const filtrados = prev.filter((item) => String(item.id) !== String(l.id));
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtrados));
            }
          }
        } catch (e) {
          console.error(e);
        }

        if (!l.id.startsWith("parcela_")) {
          await supabase.from("cartoes_lancamentos").delete().eq("id", l.id);
        }
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

  const tituloFormatado = useMemo(() => formatarCompetenciaTexto(alvo), [alvo]);

  if (!isClient) {
    return (
      <Card className="p-5 bg-card border-border">
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando painel…</div>
      </Card>
    );
  }

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground">
            PARCELAS COMPROMETIDAS — <span className="capitalize">{tituloFormatado}</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Somente o que já está lançado/parcelado para o próximo mês.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total do filtro</div>
            <div className="text-2xl font-bold tabular">{BRLSafe(total)}</div>
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
            <div className="text-3xl font-bold tabular">{BRLSafe(totalGeral)}</div>
          </div>
          <div className="text-xs text-muted-foreground">
            {linhas.length} lançamento{linhas.length !== 1 ? "s" : ""} em {tituloFormatado}
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
                      className="w-full text-left p-3 hover:border-primary/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={`inline-block w-2.5 h-2.5 rounded-full ${r.barra}`} />
                          {r.label}
                        </div>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${aberto ? "rotate-180" : ""}`} />
                      </div>
                      <div className="mt-1 text-lg font-semibold tabular">{BRLSafe(r.total)}</div>
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
                                  <span className="block truncate font-medium">{l.descricao}</span>
                                  <span className="text-muted-foreground">
                                    {l.origem}
                                    {l.parcela !== "—" ? ` · ${l.parcela}` : ""}
                                  </span>
                                </span>
                                <span className="tabular font-medium whitespace-nowrap">{BRLSafe(l.valor)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex items-center justify-between pt-2 mt-1 border-t border-border text-xs font-semibold">
                          <span>Subtotal ({itensFiltrados.length})</span>
                          <span className="tabular">{BRLSafe(itensFiltrados.reduce((s, l) => s + l.valor, 0))}</span>
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
            <span className="ml-2 tabular text-xs opacity-80">{BRLSafe(f.total)}</span>
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
                  <td className="py-2 pr-3 text-right tabular font-medium">{BRLSafe(l.valor)}</td>
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
                <td className="py-3 pr-3 text-right font-bold tabular">{BRLSafe(total)}</td>
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
              {form?.id ? "Editar lançamento" : "Novo comprometido"} — {tituloFormatado}
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