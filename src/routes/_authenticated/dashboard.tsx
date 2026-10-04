import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import { Wallet, TrendingUp, TriangleAlert as AlertTriangle, Calendar, Printer, Download, Plus, CreditCard as Edit2, Trash2, Copy, ChevronLeft, ChevronRight, LogOut, CreditCard, Receipt, Banknote, Landmark, Trophy, Settings, Target, Package, Bell, ChevronDown, ChevronUp, PiggyBank, ArrowUpFromLine, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DatePicker } from "@/components/date-picker";
import { ComprometidosPanel } from "@/components/comprometidos-panel";
import { ContasPanel } from "@/components/contas-panel";
import { ImportExtratoPanel } from "@/components/import-extrato-panel";

import { fetchAll } from "@/lib/queries";

import {
  BRL, calcular, competenciaAtual, diasNoMes, formatCompetencia,
  hojeISO, jurosSalvosTotais, proxCompetencia, somaCartoesAtivos,
} from "@/lib/finance";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { gerarPDF } from "@/lib/pdf";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

const CATEGORIAS_DESPESA = [
  "Habitação", "Alimentação", "Transporte", "Educação", "Saúde",
  "Lazer", "Cartão", "Amortização", "Consignado", "Outros",
];
const CATEGORIAS_RECEITA = ["Salário", "Freelance", "Investimentos", "Outros"];

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [comp, setComp] = useState(competenciaAtual());
  const [tab, setTab] = useState("resumo");

  const { data, isLoading } = useQuery({
    queryKey: ["fin", comp],
    queryFn: () => fetchAll(comp),
  });

  // Auto-avanço de consignados ao mudar para nova competência
  useEffect(() => {
    if (!data?.contratos?.length) return;
    (async () => {
      const hojeMes = competenciaAtual();
      if (comp !== hojeMes) return;
      for (const c of data.contratos) {
        if (!c.ativo) continue;
        if (c.ultimo_avanco === comp) continue;
        if (c.parcela_atual >= c.total_parcelas) continue;
        const novaParcela = c.parcela_atual + 1;
        const novoSaldo = Math.max(0, Number(c.saldo_devedor) - Number(c.valor_parcela));
        await supabase.from("consignados_contratos")
          .update({ parcela_atual: novaParcela, saldo_devedor: novoSaldo, ultimo_avanco: comp })
          .eq("id", c.id);
        await supabase.from("consignados_eventos").insert({
          user_id: data.userId, contrato_id: c.id, competencia: comp,
          tipo: "avanco", parcelas_abatidas: 1,
        });
      }
      qc.invalidateQueries({ queryKey: ["fin"] });
    })();
  }, [data, comp, qc]);

  if (isLoading || !data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  const profile = data.profile ?? { saldo_inicial: 0, reserva_minima: 0 };
  const saldoInicialMes = Number(data.saldoInicialMes ?? 0);
  const reservasGuardadas = ((data as any).reservas ?? []).reduce(
    (s: number, r: any) => s + (Number(r.valor) || 0), 0,
  );
  const calc = calcular({
    saldoInicial: saldoInicialMes,
    reservaMinima: Number(profile.reserva_minima),
    receitas: data.receitas ?? [],
    despesas: data.despesas ?? [],
    cartoes: data.cartoes ?? [],
    competencia: comp,
    reservasGuardadas,
    salarioBase: Number((profile as any).salario_base ?? 11000),
  });
  const jurosTotais = jurosSalvosTotais(data.eventos ?? []);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["fin"] });
  }

  function mudarMes(delta: number) {
    if (delta > 0) setComp(proxCompetencia(comp));
    else {
      const [y, m] = comp.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      setComp(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors theme="dark" position="top-right" />

      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Orçamento Gutê</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => mudarMes(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <div className="px-4 py-2 rounded-md bg-secondary min-w-[160px] text-center font-semibold capitalize">
              {formatCompetencia(comp)}
            </div>
            <Button variant="outline" size="icon" onClick={() => mudarMes(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/mentor" })} title="Mentor financeiro com IA">
              <Sparkles className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Mentor</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => gerarPDF({ comp, profile, receitas: data.receitas, despesas: data.despesas, cartoes: data.cartoes, contratos: data.contratos, insumos: data.insumos, eventos: data.eventos, calc })}>
              <Printer className="w-4 h-4 mr-1" /> Relatório
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} title="Sair da conta">
              <LogOut className="w-4 h-4 sm:mr-1" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6 print-area">
        {/* Barra de Alertas */}
        <AlertsBar despesas={data.despesas ?? []} insumos={data.insumos ?? []} />

        {/* Cards de topo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard label="Saldo" value={BRL(calc.saldoVivo)} hint={reservasGuardadas > 0 ? `Livre em conta · ${BRL(reservasGuardadas)} em caixinhas` : "Recebido − Pago"} icon={<Wallet />} accent />
          <KpiCard
            label="Margem Livre"
            value={BRL(calc.margemLivre)}
            hint={calc.caixaLimite ? "⚠ Caixa Limite Atingido" : "Após pendentes e reserva"}
            danger={calc.caixaLimite}
            icon={<Target />}
          />
          <KpiCard
            label="Disponibilidade Diária"
            value={BRL(calc.dispDiaria)}
            hint={`${calc.diasRestantes} dia${calc.diasRestantes !== 1 ? "s" : ""} restante${calc.diasRestantes !== 1 ? "s" : ""}${calc.modoPlanejamento ? " · Planejamento" : ""}`}
            icon={<Calendar />}
          />
          <KpiCard
            label="Resultado Projetado"
            value={BRL(calc.resultadoMes)}
            hint={`Saldo Inicial + Receitas − Despesas − Cartões`}
            icon={<TrendingUp />}
            positive={calc.resultadoMes >= 0}
          />
        </div>

        <Card className="p-5 bg-card border-border">
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">DISTRIBUIÇÃO DAS DESPESAS</h2>
          <PizzaReceita
            receitas={calc.totalReceitas}
            despesas={(data.despesas ?? []).filter((d: any) => d.tipo !== "consignado")}
            cartoes={(data.cartoes ?? []).filter((c: any) => c.ativo)}
            resultado={calc.resultadoMes}
          />
        </Card>

        {/* Mini resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Receitas" value={BRL(calc.totalReceitas)} sub={calc.receitaProjetada > 0 ? `Projeção salário base: ${BRL(calc.receitaProjetada)}` : `Recebidas: ${BRL(calc.recebidos)}`} color="success" />
          <MiniStat label="Despesas Cash" value={BRL(calc.totalDespesasCash)} sub={`Pagas: ${BRL(calc.despPagas)}`} color="warning" />
          <MiniStat label="Cartões (Soma)" value={BRL(somaCartoesAtivos(data.cartoes ?? []))} sub={`Ativos: ${(data.cartoes ?? []).filter((c: any) => c.ativo).length}`} color="info" />
          <MiniStat label="Reservas / Caixinhas" value={BRL(reservasGuardadas)} sub={`Patrimônio: ${BRL(calc.patrimonioTotal)}`} color="info" />
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid grid-cols-3 md:grid-cols-10 w-full max-w-4xl h-auto">
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
            <TabsTrigger value="contas">Contas</TabsTrigger>
            <TabsTrigger value="receitas">Receitas</TabsTrigger>
            <TabsTrigger value="despesas">Despesas</TabsTrigger>
            <TabsTrigger value="cartoes">Cartões</TabsTrigger>
            <TabsTrigger value="insumos">Insumos</TabsTrigger>
            <TabsTrigger value="consignados">Consignados</TabsTrigger>
            <TabsTrigger value="reservas">Reservas</TabsTrigger>
            <TabsTrigger value="comprometido">Comprometido</TabsTrigger>
            <TabsTrigger value="importar">Importar</TabsTrigger>
          </TabsList>

          <TabsContent value="resumo" className="mt-4">
            <ResumoView calc={calc} data={data} profile={profile} comp={comp} onSaved={refresh} />
          </TabsContent>

          <TabsContent value="contas" className="mt-4">
            <ContasPanel userId={data.userId} />
          </TabsContent>

          <TabsContent value="receitas" className="mt-4">
            <ReceitasView data={data} comp={comp} onSaved={refresh} />
          </TabsContent>

          <TabsContent value="despesas" className="mt-4">
            <DespesasView data={data} comp={comp} onSaved={refresh} />
          </TabsContent>

          <TabsContent value="cartoes" className="mt-4">
            <CartoesView data={data} comp={comp} onSaved={refresh} />
          </TabsContent>

          <TabsContent value="insumos" className="mt-4">
            <InsumosView data={data} comp={comp} onSaved={refresh} />
          </TabsContent>

          <TabsContent value="consignados" className="mt-4">
            <ConsignadosView data={data} comp={comp} onSaved={refresh} />
          </TabsContent>

          <TabsContent value="reservas" className="mt-4">
            <ReservasView data={data} comp={comp} onSaved={refresh} />
          </TabsContent>

          <TabsContent value="comprometido" className="mt-4">
            <ComprometidosPanel comp={comp} contratos={data.contratos} />
          </TabsContent>

          <TabsContent value="importar" className="mt-4">
            <ImportExtratoPanel comp={comp} onSaved={refresh} />
          </TabsContent>
        </Tabs>

        {/* Painel de Conquistas */}
        <ConquistasPanel eventos={data.eventos} contratos={data.contratos} comp={comp} jurosTotais={jurosTotais} />
      </main>
    </div>
  );
}

function ConquistasPanel({ eventos, contratos, comp, jurosTotais }: any) {
  const jurosMes = (eventos ?? [])
    .filter((e: any) => e.tipo === "amortizacao" && e.competencia === comp)
    .reduce((s: number, e: any) => s + Number(e.juros_salvos ?? 0), 0);
  const comprometimento = (contratos ?? [])
    .filter((c: any) => c.ativo && c.parcela_atual < c.total_parcelas)
    .reduce((s: number, c: any) => s + Number(c.valor_parcela ?? 0), 0);
  const saldoDevedor = (contratos ?? [])
    .reduce((s: number, c: any) => s + Number(c.saldo_devedor ?? 0), 0);
  return (
    <Card className="p-6 bg-card border-border">
      <h2 className="text-sm font-semibold text-muted-foreground mb-3">🏆 PAINEL DE CONQUISTAS — JUROS DESTRUÍDOS</h2>
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-2">
        <Trophy className="w-16 h-16 text-warning" />
        <div className="text-center md:text-left">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Total Histórico</div>
          <div className="text-4xl font-bold tabular text-success">{BRL(jurosTotais)}</div>
          <div className="mt-2 text-xs text-muted-foreground">
            Juros destruídos neste mês:{" "}
            <span className="font-semibold text-success tabular">{BRL(jurosMes)}</span>
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-1 text-[11px] text-muted-foreground">
        <div>
          Comprometimento Mensal (parcelas ativas):{" "}
          <span className="text-foreground tabular font-medium">{BRL(comprometimento)}</span>
        </div>
        <div className="md:text-right">
          Saldo Devedor Consolidado:{" "}
          <span className="text-foreground tabular font-medium">{BRL(saldoDevedor)}</span>
        </div>
      </div>
    </Card>
  );
}

function KpiCard({ label, value, hint, icon, accent, danger, positive }: any) {
  return (
    <Card className={`p-4 bg-card border-border ${danger ? "border-destructive/60" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
          accent ? "bg-primary/15 text-primary" :
          danger ? "bg-destructive/15 text-destructive" :
          positive === false ? "bg-destructive/15 text-destructive" :
          "bg-secondary text-muted-foreground"
        } [&>svg]:w-4 [&>svg]:h-4`}>{icon}</div>
      </div>
      <div className={`text-2xl font-bold tabular ${danger ? "text-destructive" : positive === false ? "text-destructive" : "text-foreground"}`}>{value}</div>
      <div className={`text-xs mt-1 ${danger ? "text-destructive" : "text-muted-foreground"}`}>{hint}</div>
    </Card>
  );
}

function MiniStat({ label, value, sub, color }: any) {
  const colorMap: any = {
    success: "text-success", warning: "text-warning", info: "text-info", muted: "text-muted-foreground",
  };
  return (
    <Card className="p-3 bg-card border-border">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold tabular ${colorMap[color]}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
    </Card>
  );
}

const PALETA_CATEGORIAS = [
  "#3b82f6", "#f97316", "#a855f7", "#eab308", "#06b6d4", "#ef4444",
  "#ec4899", "#0ea5e9", "#d946ef", "#f59e0b", "#6366f1", "#dc2626",
];
const COR_SOBRA = "#22c55e";

function corDaFatia(nome: string, idx: number) {
  if (nome === "Sobra Líquida") return COR_SOBRA;
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = (hash * 31 + nome.charCodeAt(i)) >>> 0;
  return PALETA_CATEGORIAS[(hash + idx) % PALETA_CATEGORIAS.length];
}

function PizzaReceita({ receitas, despesas, cartoes, resultado }: any) {
  const grupos: Record<string, number> = {};
  for (const d of despesas) grupos[d.categoria] = (grupos[d.categoria] ?? 0) + Number(d.valor);
  for (const c of cartoes) {
    const cat = c.categoria || "Outros";
    grupos[cat] = (grupos[cat] ?? 0) + Number(c.valor);
  }
  const fatias = Object.entries(grupos).map(([k, v]) => ({ name: k, value: v }));
  if (resultado > 0) fatias.push({ name: "Sobra Líquida", value: resultado });
  if (fatias.length === 0) fatias.push({ name: "Sem dados", value: 1 });

  const usadas = new Set<string>();
  const coresFinais = fatias.map((f, i) => {
    let c = corDaFatia(f.name, i);
    let tent = 0;
    while (usadas.has(c) && tent < PALETA_CATEGORIAS.length) {
      c = PALETA_CATEGORIAS[(i + ++tent) % PALETA_CATEGORIAS.length];
    }
    if (f.name !== "Sobra Líquida") usadas.add(c);
    return c;
  });

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="w-full md:w-1/2 h-[260px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={fatias} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={2} dataKey="value">
              {fatias.map((f, i) => (
                <Cell key={i} fill={coresFinais[i]} stroke="var(--background)" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
              formatter={(v: any) => BRL(Number(v))}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 w-full md:w-1/2">
        <div className="text-xs text-muted-foreground mb-2">Total Receita: <strong className="text-foreground">{BRL(receitas)}</strong></div>
        {fatias.map((f, i) => {
          const pct = receitas > 0 ? (f.value / receitas) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-2 text-sm">
              <div className="w-3 h-3 rounded-sm" style={{ background: coresFinais[i] }} />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="tabular text-muted-foreground">{pct.toFixed(1)}%</span>
              <span className="tabular font-medium w-20 text-right">{BRL(f.value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResumoView({ calc, data, profile, comp, onSaved }: any) {
  const saldoMes = Number(data.saldoInicialMes ?? 0);
  const [saldo, setSaldo] = useState(String(saldoMes));
  const [reserva, setReserva] = useState(String(profile.reserva_minima ?? 0));
  const [salarioBase, setSalarioBase] = useState(String(profile.salario_base ?? 11000));
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    setSaldo(String(Number(data.saldoInicialMes ?? 0)));
    setReserva(String(profile.reserva_minima ?? 0));
    setSalarioBase(String(profile.salario_base ?? 11000));
  }, [comp, data.saldoInicialMes, profile.reserva_minima, profile.salario_base]);

  async function salvar() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error: e1 } = await supabase.from("profiles").upsert({
      id: u.user.id,
      reserva_minima: Number(reserva),
      salario_base: Number(salarioBase) || 0,
      updated_at: new Date().toISOString(),
    } as any);
    const { error: e2 } = await (supabase.from as any)("saldos_mensais").upsert({
      user_id: u.user.id,
      competencia: comp,
      saldo_inicial: Number(saldo),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,competencia" });
    if (e1 || e2) toast.error((e1 ?? e2)!.message);
    else { toast.success(`Saldo Inicial de ${comp.slice(0, 7)} salvo`); onSaved(); }
  }

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-card border-border">
        <h3 className="font-semibold mb-4 text-lg">Resumo Geral de Contas — {`${(data.receitas?.length ?? 0) + (data.despesas?.length ?? 0) + (data.cartoes?.length ?? 0)} lançamentos`}</h3>
        <div className="grid md:grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div className="space-y-2">
            <Row k="Saldo Inicial" v={BRL(saldoMes)} />
            <Row k="(+) Receitas Recebidas" v={BRL(calc.recebidos)} color="success" />
            <Row k="(+) Receitas Previstas" v={BRL(calc.previstos)} color="muted" />
            {calc.receitaProjetada > 0 && (
              <Row k="(+) Receita Projetada (Salário Base)" v={BRL(calc.receitaProjetada)} color="info" />
            )}
            <Row k="(−) Despesas Pagas" v={BRL(calc.despPagas)} color="destructive" />
            <Row k="(−) Cartões Pagos" v={BRL(calc.cartPagos)} color="destructive" />
            <div className="h-px bg-border my-2" />
            <Row k="Saldo (hoje)" v={BRL(calc.saldoVivo)} bold />
          </div>
          <div className="space-y-2">
            <Row k="(−) Despesas Pendentes" v={BRL(calc.despPendentes)} color="warning" />
            <Row k="(−) Cartões Pendentes" v={BRL(calc.cartPendentes)} color="warning" />
            <Row k="(−) Reserva Mínima" v={BRL(Number(profile.reserva_minima))} color="muted" />
            <div className="h-px bg-border my-2" />
            <Row k="Margem Livre do Mês" v={BRL(calc.margemLivre)} bold color={calc.caixaLimite ? "destructive" : "success"} />
            <Row k="Dias Restantes" v={`${calc.diasRestantes}${calc.modoPlanejamento ? " (planejamento)" : ""}`} />
            <Row k="Disponibilidade Diária" v={BRL(calc.dispDiaria)} bold color="info" />
            <Row k="Resultado Projetado do Mês" v={BRL(calc.resultadoMes)} bold color={calc.resultadoMes >= 0 ? "success" : "destructive"} />
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <button
          onClick={() => setAberto((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 hover:bg-secondary/30 transition"
        >
          <span className="font-semibold flex items-center gap-2 text-sm">
            <Settings className="w-4 h-4" /> Configurações de Saldo (Saldo Inicial do mês e Reserva)
          </span>
          {aberto ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {aberto && (
          <div className="px-5 pb-5 pt-1 border-t border-border">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Saldo Inicial de {comp.slice(0, 7)} (R$)</Label>
                <Input type="number" step="0.01" value={saldo} onChange={(e) => setSaldo(e.target.value)} />
              </div>
              <div>
                <Label>Colchão / Reserva Mínima (R$)</Label>
                <Input type="number" step="0.01" value={reserva} onChange={(e) => setReserva(e.target.value)} />
              </div>
              <div>
                <Label>Salário Base (R$)</Label>
                <Input type="number" step="0.01" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} />
              </div>
            </div>
            <Button onClick={salvar} className="mt-3">Salvar Configurações</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function AlertsBar({ despesas, insumos }: any) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  const diffDias = (s?: string | null) => {
    if (!s) return Infinity;
    const d = new Date(s + "T00:00:00");
    return Math.round((d.getTime() - hoje.getTime()) / 86400000);
  };

  const despVencendo = (despesas ?? []).filter((d: any) => {
    if (d.status !== "PENDENTE" || d.tipo === "consignado") return false;
    const dd = diffDias(d.data_venc);
    return dd >= 0 && dd <= 5;
  });

  const insVencendo = (insumos ?? []).flatMap((i: any) => {
    const margem = Number(i.dias_alerta ?? 5);
    const alertas: any[] = [];
    const dv = diffDias(i.validade);
    const dc = diffDias(i.data_final_consumo);
    if (i.validade && dv <= margem) alertas.push({ ...i, _motivo: "validade", _dias: dv, _data: i.validade });
    if (i.data_final_consumo && dc <= margem) alertas.push({ ...i, _motivo: "fim de consumo", _dias: dc, _data: i.data_final_consumo });
    return alertas;
  });

  const total = despVencendo.length + insVencendo.length;
  if (total === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary/30 border border-border text-xs text-muted-foreground">
        <Bell className="w-3.5 h-3.5" /> Nenhum vencimento próximo.
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-warning/10 border border-warning/30 text-xs">
      <AlertTriangle className="w-3.5 h-3.5 text-warning mt-0.5 shrink-0" />
      <div className="flex flex-wrap gap-1.5">
        <span className="font-semibold text-warning mr-1">Atenção — vencimentos próximos:</span>
        {despVencendo.map((d: any) => (
          <Badge key={d.id} variant="outline" className="border-warning/40 text-warning">
            {d.descricao} · {BRL(Number(d.valor))} · {d.data_venc}
          </Badge>
        ))}
        {insVencendo.map((i: any, k: number) => (
          <Badge key={i.id + k} variant="outline" className="border-info/40 text-info">
            Insumo: {i.nome} · {i._motivo} em {i._dias}d ({i._data})
          </Badge>
        ))}
      </div>
    </div>
  );
}

function InsumosView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  async function clonar(i: any) {
    const { id, created_at, updated_at, ...rest } = i;
    const next = proxCompetencia(i.competencia);
    const { error } = await (supabase.from as any)("insumos").insert({ ...rest, competencia: next });
    if (error) toast.error(error.message); else { toast.success("Clonado"); onSaved(); }
  }
  async function deletar(id: string) {
    if (!confirm("Excluir insumo?")) return;
    const { error } = await (supabase.from as any)("insumos").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onSaved(); }
  }

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2"><Package className="w-4 h-4 text-info" /> Insumos & Consumo Físico</h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Novo insumo</Button>
      </div>
      {(data.insumos ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum insumo cadastrado neste mês.</p>}
      <div className="space-y-2">
        {(data.insumos ?? []).map((i: any) => (
          <div key={i.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/40 border border-border">
            <Package className="w-4 h-4 text-info shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{i.nome}</div>
              <div className="text-xs text-muted-foreground">
                Fim consumo: {i.data_final_consumo ?? "—"} · Validade: {i.validade ?? "—"}
              </div>
            </div>
            <div className="font-bold tabular text-info">{BRL(Number(i.valor_base))}</div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => clonar(i)} title="Clonar p/ próximo mês"><Copy className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => deletar(i.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
      <InsumoForm open={open} onOpenChange={setOpen} comp={comp} editing={editing} onSaved={() => { setOpen(false); onSaved(); }} />
    </Card>
  );
}

function InsumoForm({ open, onOpenChange, comp, editing, onSaved }: any) {
  const empty = { nome: "", valor_base: "", data_final_consumo: "", validade: "", observacao: "", dias_alerta: "5" };
  const [form, setForm] = useState<any>(editing ?? empty);
  useEffect(() => {
    setForm(editing ? { ...editing, dias_alerta: String(editing.dias_alerta ?? 5) } : empty);
  }, [editing, open]);

  async function salvar() {
    const { data: u } = await supabase.auth.getUser();
    const payload: any = {
      nome: form.nome,
      valor_base: Number(form.valor_base) || 0,
      data_final_consumo: form.data_final_consumo || null,
      validade: form.validade || null,
      observacao: form.observacao || null,
      dias_alerta: Math.max(0, Number(form.dias_alerta) || 0),
      user_id: u.user!.id,
      competencia: comp,
    };
    if (editing?.id) {
      const { error } = await (supabase.from as any)("insumos").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase.from as any)("insumos").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo"); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Insumo</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome do Insumo</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Ração premium 15kg" /></div>
          <div><Label>Valor Base (R$)</Label><Input type="number" step="0.01" value={form.valor_base} onChange={(e) => setForm({ ...form, valor_base: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data Fim do Consumo</Label>
              <DatePicker value={form.data_final_consumo} onChange={(v) => setForm({ ...form, data_final_consumo: v })} />
            </div>
            <div>
              <Label>Data de Validade</Label>
              <DatePicker value={form.validade} onChange={(v) => setForm({ ...form, validade: v })} />
            </div>
          </div>
          <div>
            <Label>Alertar quantos dias antes de acabar/vencer</Label>
            <Input type="number" min="0" value={form.dias_alerta} onChange={(e) => setForm({ ...form, dias_alerta: e.target.value })} placeholder="5" />
          </div>
          <div><Label>Observação</Label><Input value={form.observacao ?? ""} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, color, bold }: any) {
  const cmap: any = { success: "text-success", destructive: "text-destructive", warning: "text-warning", info: "text-info", muted: "text-muted-foreground" };
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className={`tabular ${bold ? "font-bold" : ""} ${cmap[color] ?? ""}`}>{v}</span>
    </div>
  );
}

function ReceitasView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const allIds = (data.receitas ?? []).map((r: any) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id: string) => sel[id]);
  const selectedIds = allIds.filter((id: string) => sel[id]);

  async function clonar(r: any) {
    const { id, created_at, ...rest } = r;
    const next = proxCompetencia(r.competencia);
    const { error } = await supabase.from("receitas").insert({ ...rest, competencia: next, data: next });
    if (error) toast.error(error.message); else { toast.success("Clonado para " + formatCompetencia(next)); onSaved(); }
  }
  async function deletar(id: string) {
    if (!confirm("Excluir este lançamento?")) return;
    const { error } = await supabase.from("receitas").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onSaved(); }
  }

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2"><Banknote className="w-4 h-4 text-success" /> Receitas</h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nova receita</Button>
      </div>
      {(data.receitas ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma receita neste mês.</p>}
      <div className="space-y-2">
        {(data.receitas ?? []).map((r: any) => (
          <div key={r.id} className={`flex items-center gap-3 p-3 rounded-md border ${sel[r.id] ? "bg-destructive/5 border-destructive/30" : "bg-secondary/40 border-border"}`}>
            <Checkbox checked={!!sel[r.id]} onCheckedChange={(v) => setSel({ ...sel, [r.id]: !!v })} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{r.descricao}</span>
                <Badge variant={r.status === "RECEBIDO" ? "default" : "outline"} className={r.status === "RECEBIDO" ? "bg-success/20 text-success border-success/30" : "border-warning/40 text-warning"}>
                  {r.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{r.categoria} · {r.data}</div>
            </div>
            <div className="font-bold tabular text-success">{BRL(Number(r.valor))}</div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => clonar(r)}><Copy className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => deletar(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
      <ReceitaForm open={open} onOpenChange={setOpen} comp={comp} editing={editing} onSaved={() => { setOpen(false); onSaved(); }} />
    </Card>
  );
}

function ReceitaForm({ open, onOpenChange, comp, editing, onSaved }: any) {
  const [form, setForm] = useState<any>(() => editing ?? { descricao: "", valor: "", data: hojeISO(), categoria: "Salário", status: "PREVISTO" });
  useEffect(() => { setForm(editing ?? { descricao: "", valor: "", data: hojeISO(), categoria: "Salário", status: "PREVISTO" }); }, [editing, open]);

  async function salvar() {
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, valor: Number(form.valor), user_id: u.user!.id, competencia: comp };
    delete (payload as any).created_at;
    if (editing?.id) {
      const { error } = await supabase.from("receitas").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("receitas").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo"); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Receita</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            <div><Label>Data</Label><DatePicker value={form.data} onChange={(v) => setForm({ ...form, data: v })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS_RECEITA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PREVISTO">PREVISTO</SelectItem>
                  <SelectItem value="RECEBIDO">RECEBIDO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DespesasView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  async function togglePago(d: any) {
    const novo = d.status === "PAGO" ? "PENDENTE" : "PAGO";
    await supabase.from("despesas").update({ status: novo }).eq("id", d.id);
    onSaved();
  }

  async function deletar(id: string) {
    if (!confirm("Excluir despesa?")) return;
    await supabase.from("despesas").delete().eq("id", id);
    onSaved();
  }

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-warning" /> Despesas</h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nova despesa</Button>
      </div>
      {(data.despesas ?? []).length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma despesa neste mês.</p>}
      <div className="space-y-2">
        {(data.despesas ?? []).map((d: any) => (
          <div key={d.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/40 border border-border">
            <Checkbox checked={d.status === "PAGO"} onCheckedChange={() => togglePago(d)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{d.descricao}</span>
                <Badge variant="outline" className={d.status === "PAGO" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>{d.status}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">{d.categoria} · vence {d.data_venc}</div>
            </div>
            <div className="font-bold tabular text-warning">{BRL(Number(d.valor))}</div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => deletar(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
      <DespesaForm open={open} onOpenChange={setOpen} comp={comp} editing={editing} onSaved={() => { setOpen(false); onSaved(); }} />
    </Card>
  );
}

function DespesaForm({ open, onOpenChange, comp, editing, onSaved }: any) {
  const empty = { descricao: "", valor: "", data_venc: hojeISO(), categoria: "Outros", status: "PENDENTE", tipo: "variavel" };
  const [form, setForm] = useState<any>(editing ?? empty);
  useEffect(() => { setForm(editing ?? empty); }, [editing, open]);

  async function salvar() {
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, valor: Number(form.valor), user_id: u.user!.id, competencia: comp };
    delete (payload as any).created_at;
    if (editing?.id) {
      await supabase.from("despesas").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("despesas").insert(payload);
    }
    toast.success("Salvo"); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} Despesa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            <div><Label>Vencimento</Label><DatePicker value={form.data_venc} onChange={(v) => setForm({ ...form, data_venc: v })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───── CARTÕES ───── */
function CartoesView({ data, comp, onSaved }: any) {
  const cartoesRegistry = data?.cartoesRegistry ?? data?.cartoesCadastrados?.data ?? data?.cartoesCadastrados ?? data?.cartoes ?? [];
  const [openCartao, setOpenCartao] = useState(false);
  const [editingCartao, setEditingCartao] = useState<any>(null);

  const grupos = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const c of (data?.cartoes ?? [])) {
      const k = c.cartao || "Geral";
      if (!m[k]) m[k] = [];
      m[k].push(c);
    }
    return m;
  }, [data?.cartoes]);

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
    <Card className="p-5 bg-card border-border space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2 text-base">
          <CreditCard className="w-4 h-4 text-primary" /> Cartões de Crédito Cadastrados
        </h3>
        <Button onClick={() => { setEditingCartao(null); setOpenCartao(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Cadastrar Cartão
        </Button>
      </div>

      {cartoesRegistry.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
          <p className="text-sm">Nenhum cartão cadastrado na lista.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cartoesRegistry.map((c: any) => (
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
                  {Number(c.limite) > 0 && <span>Limite: <strong>{BRL(Number(c.limite))}</strong></span>}
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

      <CartaoCadastroForm 
        open={openCartao} 
        onOpenChange={setOpenCartao} 
        editing={editingCartao} 
        onSaved={() => { setOpenCartao(false); onSaved(); }} 
      />
    </Card>
  );
}

function CartaoCadastroForm({ open, onOpenChange, editing, onSaved }: any) {
  const [nome, setNome] = useState(editing?.nome ?? "");
  const [fechamento, setFechamento] = useState(editing?.dia_fechamento ?? 1);
  const [vencimento, setVencimento] = useState(editing?.dia_vencimento ?? 10);
  const [limite, setLimite] = useState(editing?.limite ?? 0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setNome(editing?.nome ?? "");
    setFechamento(editing?.dia_fechamento ?? 1);
    setVencimento(editing?.dia_vencimento ?? 10);
    setLimite(editing?.limite ?? 0);
  }, [editing, open]);

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

/* ───── CONSIGNADOS ───── */
function ConsignadosView({ data, comp, onSaved }: any) {
  return (
    <Card className="p-5 bg-card border-border">
      <h3 className="font-semibold mb-3">Consignados</h3>
      {(data.contratos ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {(data.contratos ?? []).map((c: any) => (
            <div key={c.id} className="p-3 bg-secondary/30 rounded border border-border flex justify-between">
              <div>
                <div className="font-medium">{c.nome}</div>
                <div className="text-xs text-muted-foreground">Parcela: {BRL(Number(c.valor_parcela))}</div>
              </div>
              <div className="font-bold tabular text-warning">{BRL(Number(c.saldo_devedor))}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ───── RESERVAS ───── */
function ReservasView({ data, comp, onSaved }: any) {
  return (
    <Card className="p-5 bg-card border-border">
      <h3 className="font-semibold mb-3">Reservas e Caixinhas</h3>
      {(data.reservas ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma reserva cadastrada.</p>
      ) : (
        <div className="space-y-2">
          {(data.reservas ?? []).map((r: any) => (
            <div key={r.id} className="p-3 bg-secondary/30 rounded border border-border flex justify-between">
              <div>{r.nome}</div>
              <div className="font-bold tabular text-info">{BRL(Number(r.valor))}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}