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
    (s: number, r: any) => s + Number(r.valor ?? 0), 0,
  );
  const calc = calcular({
    saldoInicial: saldoInicialMes,
    reservaMinima: Number(profile.reserva_minima),
    receitas: data.receitas,
    despesas: data.despesas,
    cartoes: data.cartoes,
    competencia: comp,
    reservasGuardadas,
    salarioBase: Number((profile as any).salario_base ?? 11000),
  });
  const jurosTotais = jurosSalvosTotais(data.eventos);

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
        <AlertsBar despesas={data.despesas} insumos={data.insumos} />

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
            despesas={data.despesas.filter((d) => d.tipo !== "consignado")}
            cartoes={data.cartoes.filter((c) => c.ativo)}
            resultado={calc.resultadoMes}
          />
        </Card>

        {/* Mini resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniStat label="Receitas" value={BRL(calc.totalReceitas)} sub={calc.receitaProjetada > 0 ? `Projeção salário base: ${BRL(calc.receitaProjetada)}` : `Recebidas: ${BRL(calc.recebidos)}`} color="success" />
          <MiniStat label="Despesas Cash" value={BRL(calc.totalDespesasCash)} sub={`Pagas: ${BRL(calc.despPagas)}`} color="warning" />
          <MiniStat label="Cartões (Soma)" value={BRL(somaCartoesAtivos(data.cartoes))} sub={`Ativos: ${data.cartoes.filter(c => c.ativo).length}`} color="info" />
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


        {/* Painel de Conquistas — abaixo do resumo geral, conforme spec */}
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

/* ───────────── COMPONENTES ───────────── */

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

// Paleta de cores estritamente diferentes (sem verde — reservado p/ Sobra Líquida)
const PALETA_CATEGORIAS = [
  "#3b82f6", // azul
  "#f97316", // laranja
  "#a855f7", // roxo
  "#eab308", // amarelo
  "#06b6d4", // ciano
  "#ef4444", // vermelho
  "#ec4899", // rosa/pink
  "#0ea5e9", // azul claro
  "#d946ef", // fúcsia
  "#f59e0b", // âmbar
  "#6366f1", // indigo
  "#dc2626", // vermelho escuro
];
const COR_SOBRA = "#22c55e"; // verde reservado

function corDaFatia(nome: string, idx: number) {
  if (nome === "Sobra Líquida") return COR_SOBRA;
  // determinístico por nome → mesma categoria sempre mesma cor
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

  // Garante cores distintas entre fatias adjacentes
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
  const [aberto, setAberto] = useState(false); // colapsado por padrão

  // Re-sincroniza quando o mês muda
  useEffect(() => {
    setSaldo(String(Number(data.saldoInicialMes ?? 0)));
    setReserva(String(profile.reserva_minima ?? 0));
    setSalarioBase(String(profile.salario_base ?? 11000));
  }, [comp, data.saldoInicialMes, profile.reserva_minima, profile.salario_base]);

  async function salvar() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Reserva mínima continua no profile (global do usuário)
    const { error: e1 } = await supabase.from("profiles").upsert({
      id: u.user.id,
      reserva_minima: Number(reserva),
      salario_base: Number(salarioBase) || 0,
      updated_at: new Date().toISOString(),
    } as any);
    // Saldo Inicial é vinculado ao mês selecionado
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
      {/* Quadro 2 — Resumo Geral (principal, expandido) */}
      <Card className="p-6 bg-card border-border">
        <h3 className="font-semibold mb-4 text-lg">Resumo Geral de Contas — {`${data.receitas.length + data.despesas.length + data.cartoes.length} lançamentos`}</h3>
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

      {/* Quadro 1 — Configurações (linha retrátil abaixo) */}
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
                <p className="text-xs text-muted-foreground mt-1">
                  {data.hasSaldoRow
                    ? "Salvo apenas para este mês."
                    : `Padrão sugerido do resultado projetado do mês anterior (${BRL(Number(data.defaultSaldoFromPrev ?? 0))}). Salve para fixar neste mês.`}
                </p>
              </div>
              <div>
                <Label>Colchão / Reserva Mínima (R$)</Label>
                <Input type="number" step="0.01" value={reserva} onChange={(e) => setReserva(e.target.value)} />
              </div>
              <div>
                <Label>Salário Base — projeção p/ meses futuros (R$)</Label>
                <Input type="number" step="0.01" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">
                  Usado como receita projetada em meses futuros sem nenhuma receita lançada.
                </p>
              </div>
            </div>
            <Button onClick={salvar} className="mt-3">Salvar Configurações</Button>
          </div>
        )}
      </Card>
    </div>
  );
}


/* ───── ALERTAS ───── */
function AlertsBar({ despesas, insumos }: any) {
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);

  const diffDias = (s?: string | null) => {
    if (!s) return Infinity;
    const d = new Date(s + "T00:00:00");
    return Math.round((d.getTime() - hoje.getTime()) / 86400000);
  };

  // despesas pendentes: janela fixa 5 dias
  const despVencendo = (despesas ?? []).filter((d: any) => {
    if (d.status !== "PENDENTE" || d.tipo === "consignado") return false;
    const dd = diffDias(d.data_venc);
    return dd >= 0 && dd <= 5;
  });

  // insumos: usa dias_alerta configurado por item
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

/* ───── INSUMOS ───── */
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
      {data.insumos.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum insumo cadastrado neste mês.</p>}
      <div className="space-y-2">
        {data.insumos.map((i: any) => (
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
  }, [editing, open]); // eslint-disable-line

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
              <p className="text-[10px] text-muted-foreground mb-1">Previsão de quando o produto vai acabar (uso diário).</p>
              <DatePicker value={form.data_final_consumo} onChange={(v) => setForm({ ...form, data_final_consumo: v })} />
            </div>
            <div>
              <Label>Data de Validade</Label>
              <p className="text-[10px] text-muted-foreground mb-1">Vencimento do produto definido pelo fabricante.</p>
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

/* ───── RECEITAS ───── */
function ReceitasView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

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
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center gap-2"><Banknote className="w-4 h-4 text-success" /> Receitas</h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nova receita</Button>
      </div>
      {data.receitas.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma receita neste mês.</p>}
      <div className="space-y-2">
        {data.receitas.map((r: any) => (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/40 border border-border">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{r.descricao}</span>
                <Badge variant={r.status === "RECEBIDO" ? "default" : "outline"}
                  className={r.status === "RECEBIDO" ? "bg-success/20 text-success border-success/30" : "border-warning/40 text-warning"}>
                  {r.status}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground">{r.categoria} · {r.data}</div>
            </div>
            <div className="font-bold tabular text-success">{BRL(Number(r.valor))}</div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => clonar(r)} title="Clonar p/ próximo mês"><Copy className="w-4 h-4" /></Button>
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
                  <SelectItem value="PREVISTO">PREVISTO (planejado)</SelectItem>
                  <SelectItem value="RECEBIDO">RECEBIDO (em conta)</SelectItem>
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

/* ───── DESPESAS ───── */
function DespesasView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);

  async function clonar(d: any) {
    const { id, created_at, ...rest } = d;
    const next = proxCompetencia(d.competencia);
    const { error } = await supabase.from("despesas").insert({ ...rest, competencia: next, data_venc: next, status: "PENDENTE" });
    if (error) toast.error(error.message); else { toast.success("Clonado"); onSaved(); }
  }
  async function deletar(id: string) {
    if (!confirm("Excluir?")) return;
    // Rollback de amortização: se a despesa está vinculada a um evento, reverter contrato e remover evento
    const despesa = data.despesas.find((x: any) => x.id === id);
    if (despesa?.tipo === "amortizacao") {
      const { data: evs } = await (supabase.from as any)("consignados_eventos").select("*").eq("despesa_id", id);
      for (const ev of evs ?? []) {
        const { data: c } = await supabase.from("consignados_contratos").select("*").eq("id", ev.contrato_id).maybeSingle();
        if (c) {
          await supabase.from("consignados_contratos").update({
            total_parcelas: Number(c.total_parcelas) + Number(ev.parcelas_abatidas ?? 0),
            saldo_devedor: Number(c.saldo_devedor) + Number(ev.reducao_bruta ?? 0),
          }).eq("id", c.id);
        }
        await supabase.from("consignados_eventos").delete().eq("id", ev.id);
      }
      if ((evs ?? []).length) toast.success("Amortização revertida no Painel de Conquistas");
    }
    const { error } = await supabase.from("despesas").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Excluído"); onSaved(); }
  }
  async function togglePago(d: any) {
    const novo = d.status === "PAGO" ? "PENDENTE" : "PAGO";
    await supabase.from("despesas").update({ status: novo }).eq("id", d.id);
    onSaved();
  }

  // visíveis: PENDENTES primeiro; dentro de cada grupo, mais recentes (created_at desc) no topo
  const visiveis = [...data.despesas].sort((a: any, b: any) => {
    const sa = a.status === "PENDENTE" ? 0 : 1;
    const sb = b.status === "PENDENTE" ? 0 : 1;
    if (sa !== sb) return sa - sb;
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    return tb - ta;
  });

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2"><Receipt className="w-4 h-4 text-warning" /> Despesas</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}><Download className="w-4 h-4 mr-1" />Importar Fixas do Mês Anterior</Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Nova despesa</Button>
        </div>
      </div>
      {visiveis.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma despesa neste mês.</p>}
      <div className="space-y-2">
        {visiveis.map((d: any) => (
          <div key={d.id} className="flex items-center gap-3 p-3 rounded-md bg-secondary/40 border border-border">
            <Checkbox checked={d.status === "PAGO"} onCheckedChange={() => togglePago(d)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{d.descricao}</span>
                <Badge variant="outline" className={
                  d.status === "PAGO" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"
                }>{d.status}</Badge>
                <Badge variant="outline" className="text-xs">{d.tipo}</Badge>
                {d.recorrente && <Badge variant="outline" className="text-xs border-info/40 text-info">↻ recorrente</Badge>}
              </div>
              <div className="text-xs text-muted-foreground">{d.categoria} · vence {d.data_venc}</div>
            </div>
            <div className="font-bold tabular text-warning">{BRL(Number(d.valor))}</div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => clonar(d)} title="Clonar p/ próximo mês"><Copy className="w-4 h-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => deletar(d.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
      </div>
      <DespesaForm open={open} onOpenChange={setOpen} comp={comp} editing={editing} onSaved={() => { setOpen(false); onSaved(); }} />
      <ImportarFixasDialog open={importOpen} onOpenChange={setImportOpen} comp={comp} onSaved={() => { setImportOpen(false); onSaved(); }} />
    </Card>
  );
}

function DespesaForm({ open, onOpenChange, comp, editing, onSaved }: any) {
  const empty = { descricao: "", valor: "", data_venc: hojeISO(), categoria: "Outros", status: "PENDENTE", tipo: "variavel", recorrente: false };
  const [form, setForm] = useState<any>(editing ?? empty);
  useEffect(() => { setForm(editing ?? empty); }, [editing, open]); // eslint-disable-line

  async function salvar() {
    const { data: u } = await supabase.auth.getUser();
    const payload = { ...form, valor: Number(form.valor), user_id: u.user!.id, competencia: comp };
    delete (payload as any).created_at;
    if (editing?.id) {
      const { error } = await supabase.from("despesas").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("despesas").insert(payload);
      if (error) return toast.error(error.message);
      // Replicação recorrente "Choose to clone": cria também no próximo mês se for fixa+recorrente
      if (form.tipo === "fixa" && form.recorrente) {
        const next = proxCompetencia(comp);
        await supabase.from("despesas").insert({ ...payload, competencia: next, data_venc: next, status: "PENDENTE" });
      }
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
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS_DESPESA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="variavel">Variável</SelectItem>
                  <SelectItem value="fixa">Fixa</SelectItem>
                  <SelectItem value="amortizacao">Amortização</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                  <SelectItem value="PAGO">PAGO</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.tipo === "fixa" && (
            <label className="flex items-center gap-2 text-sm pt-2 border-t border-border">
              <Checkbox checked={form.recorrente} onCheckedChange={(v) => setForm({ ...form, recorrente: !!v })} />
              <span>Replicar para o próximo mês de forma recorrente</span>
            </label>
          )}
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportarFixasDialog({ open, onOpenChange, comp, onSaved }: any) {
  const [fixas, setFixas] = useState<any[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!open) return;
    (async () => {
      // mês anterior
      const [y, m] = comp.split("-").map(Number);
      const d = new Date(y, m - 2, 1);
      const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
      const { data: rows } = await supabase.from("despesas").select("*").eq("competencia", prev).eq("tipo", "fixa");
      setFixas(rows ?? []);
      const ini: Record<string, boolean> = {};
      (rows ?? []).forEach((r: any) => (ini[r.id] = true));
      setSel(ini);
    })();
  }, [open, comp]);

  async function importar() {
    const { data: u } = await supabase.auth.getUser();
    const escolhidas = fixas.filter((f) => sel[f.id]);
    if (escolhidas.length === 0) return toast.error("Selecione ao menos uma");
    const rows = escolhidas.map((f) => {
      const { id, created_at, ...rest } = f;
      return { ...rest, user_id: u.user!.id, competencia: comp, data_venc: comp, status: "PENDENTE" };
    });
    const { error } = await supabase.from("despesas").insert(rows);
    if (error) toast.error(error.message); else { toast.success(`${rows.length} importadas`); onSaved(); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Importar Fixas do Mês Anterior</DialogTitle></DialogHeader>
        <div className="max-h-[400px] overflow-auto space-y-2">
          {fixas.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhuma despesa fixa no mês anterior.</p>}
          {fixas.map((f) => (
            <label key={f.id} className="flex items-center gap-3 p-2 rounded bg-secondary/40 cursor-pointer">
              <Checkbox checked={!!sel[f.id]} onCheckedChange={(v) => setSel({ ...sel, [f.id]: !!v })} />
              <div className="flex-1">
                <div className="text-sm font-medium">{f.descricao}</div>
                <div className="text-xs text-muted-foreground">{f.categoria}</div>
              </div>
              <div className="tabular text-warning">{BRL(Number(f.valor))}</div>
            </label>
          ))}
        </div>
        <DialogFooter><Button onClick={importar}>Importar selecionadas</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───── CARTÕES ───── */
function CartoesView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [regOpen, setRegOpen] = useState(false);

  async function clonar(c: any) {
    const { id, created_at, ...rest } = c;
    const next = proxCompetencia(c.competencia);
    const { error } = await supabase.from("cartoes_lancamentos").insert({ ...rest, competencia: next, status: "PENDENTE" });
    if (error) toast.error(error.message); else { toast.success("Clonado"); onSaved(); }
  }
  async function deletar(id: string) {
    if (!confirm("Excluir?")) return;
    await supabase.from("cartoes_lancamentos").delete().eq("id", id);
    onSaved();
  }
  async function toggleAtivo(c: any) {
    await supabase.from("cartoes_lancamentos").update({ ativo: !c.ativo }).eq("id", c.id);
    toast.success(c.ativo ? "Desativado (fora da soma)" : "Reativado");
    onSaved();
  }
  async function toggleFatura(c: any) {
    const novo = c.fatura === "seguinte" ? "atual" : "seguinte";
    await (supabase.from as any)("cartoes_lancamentos").update({ fatura: novo }).eq("id", c.id);
    onSaved();
  }
  async function pagarFatura(itens: any[]) {
    const alvos = (itens as any[]).filter((c) => c.ativo && c.status === "PENDENTE");
    if (alvos.length === 0) return;
    const total = alvos.reduce((s, c) => s + Number(c.valor), 0);
    if (!confirm(`Pagar fatura no valor de ${BRL(total)} (${alvos.length} lançamento(s))?\n\nEsse valor será deduzido do Saldo Atual.`)) return;
    const { error } = await supabase.from("cartoes_lancamentos").update({ status: "PAGO" }).in("id", alvos.map((c) => c.id));
    if (error) toast.error(error.message); else { toast.success(`Fatura paga: ${BRL(total)}`); onSaved(); }
  }
  async function estornarFatura(itens: any[]) {
    const alvos = (itens as any[]).filter((c) => c.ativo && c.status === "PAGO");
    if (alvos.length === 0) return;
    const total = alvos.reduce((s, c) => s + Number(c.valor), 0);
    if (!confirm(`Estornar fatura de ${BRL(total)}? O valor volta ao Saldo Atual como pendente.`)) return;
    const { error } = await supabase.from("cartoes_lancamentos").update({ status: "PENDENTE" }).in("id", alvos.map((c) => c.id));
    if (error) toast.error(error.message); else { toast.success(`Fatura estornada: ${BRL(total)}`); onSaved(); }
  }
  async function togglePagoItem(c: any) {
    const novo = c.status === "PAGO" ? "PENDENTE" : "PAGO";
    const { error } = await supabase.from("cartoes_lancamentos").update({ status: novo }).eq("id", c.id);
    if (error) toast.error(error.message); else onSaved();
  }
  async function desativarMae(c: any) {
    if (!confirm(`Desativar/Excluir o Lançamento Mãe "${c.descricao}"?\n\nEscolha OK para EXCLUIR de vez, ou Cancelar para apenas DESATIVAR (sai da soma).`)) {
      await supabase.from("cartoes_lancamentos").update({ ativo: false }).eq("id", c.id);
      toast.success("Lançamento Mãe desativado");
    } else {
      await supabase.from("cartoes_lancamentos").delete().eq("id", c.id);
      toast.success("Lançamento Mãe excluído");
    }
    onSaved();
  }

  const totalAtivos = somaCartoesAtivos(data.cartoes);

  // Agrupar lançamentos por cartão (banco/emissor)
  const grupos = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const c of data.cartoes) {
      const k = c.cartao || "Geral";
      (m[k] ??= []).push(c);
    }
    return m;
  }, [data.cartoes]);

  const registry = data.cartoesRegistry ?? [];

  return (
    <div className="space-y-4">
      {/* Cadastro de Cartões (registry) */}
      <Card className="p-5 bg-card border-border">
        <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2"><CreditCard className="w-4 h-4 text-info" /> Meus Cartões Cadastrados</h3>
          <Button size="sm" variant="outline" onClick={() => setRegOpen(true)}><Plus className="w-4 h-4 mr-1" />Cadastrar cartão</Button>
        </div>
        {registry.length === 0 ? (
          <p className="text-xs text-muted-foreground">Cadastre seus cartões (ex.: Santander, Nubank) antes de lançar gastos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {registry.map((r: any) => (
              <CartaoRegistryChip key={r.id} item={r} onChanged={onSaved} />
            ))}
          </div>
        )}
      </Card>

      {/* Lançamentos por cartão */}
      <Card className="p-5 bg-card border-border">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h3 className="font-semibold flex items-center gap-2">Lançamentos — Total ativo: <span className="tabular text-info">{BRL(totalAtivos)}</span></h3>
          <Button onClick={() => { setEditing(null); setOpen(true); }} disabled={registry.length === 0} title={registry.length === 0 ? "Cadastre um cartão primeiro" : ""}>
            <Plus className="w-4 h-4 mr-1" />Novo lançamento
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Soma do bloco = soma exata dos itens ativos. Desative a fatura mãe quando detalhar os itens.</p>
        {data.cartoes.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento de cartão.</p>}

        <div className="space-y-5">
          {Object.entries(grupos).map(([nomeCartao, itens]) => {
            const ativos = (itens as any[]).filter((c) => c.ativo);
            const subtotal = ativos.reduce((s, c) => s + Number(c.valor), 0);
            const pendentes = ativos.filter((c) => c.status === "PENDENTE");
            const pagos = ativos.filter((c) => c.status === "PAGO");
            const totalPend = pendentes.reduce((s, c) => s + Number(c.valor), 0);
            const totalPagos = pagos.reduce((s, c) => s + Number(c.valor), 0);
            const statusFatura = pendentes.length === 0 && pagos.length > 0 ? "PAGO" : "PENDENTE";
            return (
              <div key={nomeCartao} className="rounded-lg border border-border bg-background/40">
                <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30 rounded-t-lg flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CreditCard className="w-4 h-4 text-info" />
                    <span className="font-semibold">{nomeCartao}</span>
                    <Badge variant="outline" className="text-[10px]">{(itens as any[]).length} itens</Badge>
                    <Badge className={statusFatura === "PAGO" ? "bg-success/20 text-success border-success/30" : "bg-warning/20 text-warning border-warning/40"}>
                      {statusFatura === "PAGO" ? "FATURA PAGA" : "FATURA PENDENTE"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="text-sm">
                      <span className="text-muted-foreground mr-1">Subtotal:</span>
                      <span className="font-bold tabular text-info">{BRL(subtotal)}</span>
                    </div>
                    {pendentes.length > 0 && (
                      <Button size="sm" className="h-8 bg-success hover:bg-success/90 text-success-foreground" onClick={() => pagarFatura(itens as any[])}>
                        Pagar Fatura ({BRL(totalPend)})
                      </Button>
                    )}
                    {pagos.length > 0 && pendentes.length === 0 && (
                      <Button size="sm" variant="outline" className="h-8 border-warning/40 text-warning hover:bg-warning/10" onClick={() => estornarFatura(itens as any[])} title={`Estornar ${BRL(totalPagos)}`}>
                        Estornar Fatura
                      </Button>
                    )}
                  </div>
                </div>
                <div className="p-3 space-y-2">
                  {[...(itens as any[])].sort((a, b) => {
                    const sa = a.status === "PENDENTE" ? 0 : 1;
                    const sb = b.status === "PENDENTE" ? 0 : 1;
                    if (sa !== sb) return sa - sb;
                    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
                  }).map((c: any) => (
                    <div key={c.id} className={`flex items-center gap-3 p-3 rounded-md border ${c.consolidado ? "bg-warning/10 border-warning/40" : c.ativo ? "bg-secondary/40 border-border" : "bg-secondary/10 border-border/40 opacity-60"}`}>
                      <Checkbox checked={c.ativo} onCheckedChange={() => toggleAtivo(c)} title="Ativo na soma" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{c.descricao}</span>
                          <Badge
                            variant="outline"
                            className={`cursor-pointer ${c.status === "PAGO" ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}`}
                            onClick={() => togglePagoItem(c)}
                            title="Clique para alternar Pago/Pendente"
                          >
                            {c.status}
                          </Badge>
                          {c.consolidado && (
                            <Badge className="bg-warning/20 text-warning border-warning/40 uppercase text-[10px] tracking-wide">
                              Lançamento de Controle Provisório
                            </Badge>
                          )}
                          <Badge variant="outline" className={c.fatura === "seguinte" ? "bg-warning/15 text-warning border-warning/30" : "bg-info/15 text-info border-info/30"}>
                            {c.fatura === "seguinte" ? "Fatura Seguinte" : "Fatura Atual"}
                          </Badge>
                          {c.parcela_total > 1 && <Badge variant="outline" className="text-[10px]">{c.parcela_num}/{c.parcela_total}</Badge>}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          {c.categoria}{c.data_compra ? ` · compra ${c.data_compra}` : ""}
                          {c.consolidado && <span className="ml-1 text-warning">· desative ao detalhar gastos reais</span>}
                        </div>
                      </div>
                      <div className="font-bold tabular text-info">{BRL(Number(c.valor))}</div>
                      <div className="flex gap-1">
                        {c.consolidado && (
                          <Button size="sm" variant="outline" className="h-8 text-[11px] border-warning/40 text-warning hover:bg-warning/10" onClick={() => desativarMae(c)} title="Desativar/Excluir Valor Mãe">
                            Desativar Valor Mãe
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" onClick={() => toggleFatura(c)} title="Alternar fatura"><Calendar className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Edit2 className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => clonar(c)}><Copy className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deletar(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <CartaoForm open={open} onOpenChange={setOpen} comp={comp} editing={editing} registry={registry} onSaved={() => { setOpen(false); onSaved(); }} />
        <CartaoRegistryForm open={regOpen} onOpenChange={setRegOpen} onSaved={() => { setRegOpen(false); onSaved(); }} />
      </Card>
    </div>
  );
}

function CartaoRegistryChip({ item, onChanged }: any) {
  const [editOpen, setEditOpen] = useState(false);
  async function excluir() {
    if (!confirm(`Excluir o cartão "${item.nome}"? Lançamentos já existentes permanecerão.`)) return;
    const { error } = await (supabase.from as any)("cartoes_registry").delete().eq("id", item.id);
    if (error) toast.error(error.message); else { toast.success("Cartão removido"); onChanged(); }
  }
  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-secondary/50 border border-border text-sm">
        <CreditCard className="w-3.5 h-3.5 text-info" />
        <span className="font-medium">{item.nome}</span>
        {item.banco && <span className="text-xs text-muted-foreground">· {item.banco}</span>}
        <span className="text-[10px] text-muted-foreground">· Limite {BRL(Number(item.limite ?? 0))} · Fecha dia {item.dia_fechamento ?? "—"}</span>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditOpen(true)}><Edit2 className="w-3.5 h-3.5" /></Button>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={excluir}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
      </div>
      <CartaoRegistryForm open={editOpen} onOpenChange={setEditOpen} editing={item} onSaved={() => { setEditOpen(false); onChanged(); }} />
    </>
  );
}

function CartaoRegistryForm({ open, onOpenChange, editing, onSaved }: any) {
  const empty = { nome: "", banco: "", limite: "0", dia_fechamento: "1" };
  const [form, setForm] = useState<any>(empty);
  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      nome: editing.nome ?? "", banco: editing.banco ?? "",
      limite: String(editing.limite ?? 0), dia_fechamento: String(editing.dia_fechamento ?? 1),
    } : empty);
  }, [open, editing]); // eslint-disable-line
  async function salvar() {
    if (!form.nome.trim()) return toast.error("Informe o nome do cartão");
    const dia = Math.max(1, Math.min(31, Number(form.dia_fechamento) || 1));
    const payload: any = {
      nome: form.nome.trim(), banco: form.banco.trim() || null,
      limite: Number(form.limite) || 0, dia_fechamento: dia,
    };
    if (editing?.id) {
      const { error } = await (supabase.from as any)("cartoes_registry").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase.from as any)("cartoes_registry").insert({ ...payload, user_id: u.user!.id });
      if (error) return toast.error(error.message);
    }
    toast.success("Cartão salvo"); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Cadastrar"} Cartão</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome do Cartão</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Santander Black" /></div>
          <div><Label>Banco / Emissor</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ex: Santander" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Limite / Meta de Gastos (R$)</Label><Input type="number" step="0.01" value={form.limite} onChange={(e) => setForm({ ...form, limite: e.target.value })} /></div>
            <div><Label>Dia de Fechamento da Fatura</Label><Input type="number" min="1" max="31" value={form.dia_fechamento} onChange={(e) => setForm({ ...form, dia_fechamento: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CartaoForm({ open, onOpenChange, comp, editing, registry, onSaved }: any) {
  const empty = {
    cartao: registry?.[0]?.nome ?? "", descricao: "", valor: "",
    categoria: "Outros", data_compra: hojeISO(),
    fatura: "atual",
    parcelado: false, parcela_atual: "1", parcela_total: "1",
    status: "PENDENTE", consolidado: false, ativo: true,
  };
  const [form, setForm] = useState<any>(empty);
  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      ...empty, ...editing,
      data_compra: editing.data_compra ?? hojeISO(),
      parcelado: Number(editing.parcela_total ?? 1) > 1,
      parcela_atual: String(editing.parcela_num ?? 1),
      parcela_total: String(editing.parcela_total ?? 1),
      fatura: editing.fatura ?? "atual",
      categoria: editing.categoria || "Outros",
    } : { ...empty, cartao: registry?.[0]?.nome ?? "" });
  }, [editing, open]); // eslint-disable-line

  // Cálculo automático: data > dia_fechamento => empurra p/ fatura seguinte
  const cartaoReg = (registry ?? []).find((r: any) => r.nome === form.cartao);
  const diaFech = Number(cartaoReg?.dia_fechamento ?? 0);
  const diaCompra = form.data_compra ? Number(form.data_compra.slice(8, 10)) : 0;
  const empurrar = diaFech > 0 && diaCompra > diaFech;
  useEffect(() => {
    if (editing) return;
    setForm((f: any) => ({ ...f, fatura: empurrar ? "seguinte" : "atual" }));
  }, [empurrar, editing]);

  function addMonths(c: string, n: number) {
    const [y, m] = c.split("-").map(Number);
    const d = new Date(y, m - 1 + n, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }

  async function salvar() {
    if (!form.cartao) return toast.error("Selecione um cartão");
    const { data: u } = await supabase.auth.getUser();
    const valor = Number(form.valor) || 0;
    const isParcelado = !!form.parcelado;
    const total = Math.max(1, Number(form.parcela_total) || 1);
    const atual = Math.min(total, Math.max(1, Number(form.parcela_atual) || 1));

    if (editing?.id) {
      const payload: any = {
        cartao: form.cartao, descricao: form.descricao, valor,
        categoria: form.categoria, fatura: form.fatura,
        data_compra: form.data_compra || null,
        status: form.status, consolidado: !!form.consolidado, ativo: !!form.ativo,
      };
      const { error } = await supabase.from("cartoes_lancamentos").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const offsetBase = form.fatura === "seguinte" ? 1 : 0;
      // Replica APENAS as parcelas restantes: da [atual] até [total]
      const restantes = isParcelado ? (total - atual + 1) : 1;
      const rows = Array.from({ length: restantes }).map((_, i) => {
        const compI = addMonths(comp, offsetBase + i);
        const parcNum = isParcelado ? atual + i : 1;
        const parcTot = isParcelado ? total : 1;
        const desc = isParcelado ? `${form.descricao} (${parcNum}/${parcTot})` : form.descricao;
        return {
          user_id: u.user!.id, cartao: form.cartao, descricao: desc, valor,
          categoria: form.categoria, competencia: compI,
          fatura: i === 0 ? form.fatura : "atual",
          data_compra: form.data_compra || null,
          parcela_num: parcNum, parcela_total: parcTot,
          status: "PENDENTE", consolidado: !!form.consolidado, ativo: true,
        };
      });
      const { error } = await supabase.from("cartoes_lancamentos").insert(rows as any);
      if (error) return toast.error(error.message);
    }
    toast.success("Salvo"); onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Lançamento de Cartão</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cartão *</Label>
              <Select value={form.cartao} onValueChange={(v) => setForm({ ...form, cartao: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(registry ?? []).map((r: any) => (
                    <SelectItem key={r.id} value={r.nome}>{r.nome}{r.banco ? ` · ${r.banco}` : ""}</SelectItem>
                  ))}
                  {editing?.cartao && !(registry ?? []).some((r: any) => r.nome === editing.cartao) && (
                    <SelectItem value={editing.cartao}>{editing.cartao} (legado)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS_DESPESA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            <div><Label>Data da Compra</Label><DatePicker value={form.data_compra} onChange={(v) => setForm({ ...form, data_compra: v })} /></div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.parcelado} onCheckedChange={(v) => setForm({ ...form, parcelado: !!v })} disabled={!!editing} />
                <span>Compra parcelada</span>
              </label>
            </div>
          </div>
          {form.parcelado && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-md bg-secondary/30 border border-border">
              <div>
                <Label>Parcela Atual *</Label>
                <Input type="number" min="1" value={form.parcela_atual} onChange={(e) => setForm({ ...form, parcela_atual: e.target.value })} disabled={!!editing} />
              </div>
              <div>
                <Label>Total de Parcelas *</Label>
                <Input type="number" min="1" value={form.parcela_total} onChange={(e) => setForm({ ...form, parcela_total: e.target.value })} disabled={!!editing} />
              </div>
              <p className="col-span-2 text-[11px] text-muted-foreground">
                Ex.: parcela 10 de 12 → o sistema cria 10/12 neste mês, 11/12 no próximo e 12/12 no subsequente, encerrando automaticamente.
              </p>
            </div>
          )}
          <div>
            <Label>Status da Fatura</Label>
            <Select value={form.fatura} onValueChange={(v) => setForm({ ...form, fatura: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="atual">Fatura Atual</SelectItem>
                <SelectItem value="seguinte">Fatura Seguinte</SelectItem>
              </SelectContent>
            </Select>
            {diaFech > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Fechamento dia {diaFech}. {empurrar ? "Como a data é > fechamento, sugerimos Fatura Seguinte." : "Dentro do ciclo atual."}
              </p>
            )}
          </div>
          <label className="flex items-start gap-2 text-sm pt-2 border-t border-border">
            <Checkbox checked={form.consolidado} onCheckedChange={(v) => setForm({ ...form, consolidado: !!v })} />
            <span>
              Este é um <strong>Lançamento Mãe (Consolidado)</strong>
              <span className="block text-[11px] text-muted-foreground">Use para registrar o total provisório da fatura. Desative-o quando começar a detalhar os gastos reais para evitar duplicidade.</span>
            </span>
          </label>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───── CONSIGNADOS ───── */
function ConsignadosView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [amortOpen, setAmortOpen] = useState<any>(null);

  async function deletar(c: any) {
    if (!confirm(`Excluir definitivamente o contrato "${c.nome}"? Eventos vinculados serão mantidos no histórico.`)) return;
    const { error } = await supabase.from("consignados_contratos").delete().eq("id", c.id);
    if (error) toast.error(error.message); else { toast.success("Contrato excluído"); onSaved(); }
  }

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold flex items-center gap-2"><Landmark className="w-4 h-4 text-info" /> Consignados (Retenção em Folha · impacto neutro)</h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="w-4 h-4 mr-1" />Novo contrato</Button>
      </div>
      {data.contratos.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum contrato ativo.</p>}
      <div className="space-y-3">
        {data.contratos.map((c: any) => {
          const pct = (c.parcela_atual / c.total_parcelas) * 100;
          const restantes = Math.max(0, c.total_parcelas - c.parcela_atual);
          return (
            <div key={c.id} className="p-4 rounded-md bg-secondary/40 border border-border">
              <div className="flex justify-between items-start gap-3 mb-2 flex-wrap">
                <div>
                  <div className="font-semibold">{c.nome}</div>
                  <div className="text-xs text-muted-foreground">{c.banco ?? "—"}{c.taxa_juros_mensal != null ? ` · ${Number(c.taxa_juros_mensal).toFixed(2)}% a.m.` : ""} · Parcela {c.parcela_atual}/{c.total_parcelas} · {restantes} restantes</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Saldo Devedor</div>
                  <div className="font-bold tabular text-warning">{BRL(Number(c.saldo_devedor))}</div>
                </div>
              </div>
              <Progress value={pct} className="mb-3" />
              <div className="flex justify-between items-center text-sm flex-wrap gap-2">
                <span className="text-muted-foreground">Parcela: <span className="text-foreground font-medium tabular">{BRL(Number(c.valor_parcela))}</span></span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setAmortOpen(c)}><Trophy className="w-4 h-4 mr-1" />Amortizar</Button>
                  <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}><Edit2 className="w-4 h-4 mr-1" />Editar</Button>
                  <Button size="sm" variant="outline" onClick={() => deletar(c)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4 mr-1" />Excluir</Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <AbatimentosList eventos={data.eventos} contratos={data.contratos} onSaved={onSaved} />
      <ContratoForm open={open} onOpenChange={setOpen} editing={editing} onSaved={() => { setOpen(false); onSaved(); }} />
      <AmortizarDialog contrato={amortOpen} onClose={() => setAmortOpen(null)} comp={comp} onSaved={() => { setAmortOpen(null); onSaved(); }} />
    </Card>
  );
}

function AbatimentosList({ eventos, contratos, onSaved }: any) {
  const [editing, setEditing] = useState<any>(null);
  const items = (eventos ?? []).filter((e: any) => e.tipo === "amortizacao");
  const nomeContrato = (id: string) => contratos?.find((c: any) => c.id === id)?.nome ?? "Contrato";

  async function excluir(ev: any) {
    if (!confirm("Excluir este abatimento? O saldo devedor e parcelas do contrato serão restaurados.")) return;
    const { data: c } = await supabase.from("consignados_contratos").select("*").eq("id", ev.contrato_id).maybeSingle();
    if (c) {
      await supabase.from("consignados_contratos").update({
        total_parcelas: Number(c.total_parcelas) + Number(ev.parcelas_abatidas ?? 0),
        saldo_devedor: Number(c.saldo_devedor) + Number(ev.reducao_bruta ?? 0),
      }).eq("id", c.id);
    }
    if (ev.despesa_id) await supabase.from("despesas").delete().eq("id", ev.despesa_id);
    await supabase.from("consignados_eventos").delete().eq("id", ev.id);
    toast.success("Abatimento revertido"); onSaved();
  }

  if (items.length === 0) return null;
  return (
    <div className="mt-6 pt-4 border-t border-border">
      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Histórico de Abatimentos Extraordinários</h4>
      <div className="space-y-2">
        {items.map((ev: any) => (
          <div key={ev.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/30 border border-border text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{nomeContrato(ev.contrato_id)} · {ev.competencia}</div>
              <div className="text-xs text-muted-foreground">
                Pago: <span className="tabular text-warning">{BRL(Number(ev.valor_extra ?? 0))}</span> ·
                Redução: <span className="tabular">{BRL(Number(ev.reducao_bruta ?? 0))}</span> ·
                Parcelas: {ev.parcelas_abatidas} ·
                Juros destruídos: <span className="tabular text-success">{BRL(Number(ev.juros_salvos ?? 0))}</span>
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={() => setEditing(ev)}><Edit2 className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" onClick={() => excluir(ev)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
      <AbatimentoEditForm editing={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onSaved(); }} />
    </div>
  );
}

function AbatimentoEditForm({ editing, onClose, onSaved }: any) {
  const [form, setForm] = useState<any>({ valor_extra: "", parcelas_abatidas: "1", reducao_bruta: "" });
  useEffect(() => {
    if (!editing) return;
    setForm({
      valor_extra: String(editing.valor_extra ?? 0),
      parcelas_abatidas: String(editing.parcelas_abatidas ?? 1),
      reducao_bruta: String(editing.reducao_bruta ?? 0),
    });
  }, [editing]);
  if (!editing) return null;
  const ve = Number(form.valor_extra) || 0;
  const rb = Number(form.reducao_bruta) || 0;
  const js = Math.max(0, rb - ve);

  async function salvar() {
    // Diff contrato: re-aplicar delta entre estado antigo e novo
    const { data: c } = await supabase.from("consignados_contratos").select("*").eq("id", editing.contrato_id).maybeSingle();
    if (c) {
      const deltaParc = Number(editing.parcelas_abatidas ?? 0) - (Number(form.parcelas_abatidas) || 0);
      const deltaSaldo = Number(editing.reducao_bruta ?? 0) - rb;
      await supabase.from("consignados_contratos").update({
        total_parcelas: Math.max(0, Number(c.total_parcelas) + deltaParc),
        saldo_devedor: Math.max(0, Number(c.saldo_devedor) + deltaSaldo),
      }).eq("id", c.id);
    }
    await (supabase.from as any)("consignados_eventos").update({
      valor_extra: ve, parcelas_abatidas: Number(form.parcelas_abatidas) || 1,
      reducao_bruta: rb, juros_salvos: js,
    }).eq("id", editing.id);
    if (editing.despesa_id) {
      await supabase.from("despesas").update({ valor: ve }).eq("id", editing.despesa_id);
    }
    toast.success("Abatimento atualizado"); onSaved();
  }

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar Abatimento</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Valor Extra Pago (R$)</Label><Input type="number" step="0.01" value={form.valor_extra} onChange={(e) => setForm({ ...form, valor_extra: e.target.value })} /></div>
          <div><Label>Parcelas Abatidas</Label><Input type="number" value={form.parcelas_abatidas} onChange={(e) => setForm({ ...form, parcelas_abatidas: e.target.value })} /></div>
          <div><Label>Redução Bruta no Saldo (R$)</Label><Input type="number" step="0.01" value={form.reducao_bruta} onChange={(e) => setForm({ ...form, reducao_bruta: e.target.value })} /></div>
          <div className="p-2 rounded bg-success/10 border border-success/30 text-xs">Juros destruídos: <strong className="text-success">{BRL(js)}</strong></div>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ContratoForm({ open, onOpenChange, editing, onSaved }: any) {
  const empty = { nome: "", banco: "", taxa_juros_mensal: "", valor_parcela: "", total_parcelas: "", saldo_devedor: "", parcela_atual: "0" };
  const [form, setForm] = useState<any>(empty);
  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        nome: editing.nome ?? "",
        banco: editing.banco ?? "",
        taxa_juros_mensal: editing.taxa_juros_mensal != null ? String(editing.taxa_juros_mensal) : "",
        valor_parcela: String(editing.valor_parcela ?? ""),
        total_parcelas: String(editing.total_parcelas ?? ""),
        saldo_devedor: String(editing.saldo_devedor ?? ""),
        parcela_atual: String(editing.parcela_atual ?? "0"),
      });
    } else {
      setForm(empty);
    }
  }, [editing, open]);

  async function salvar() {
    const { data: u } = await supabase.auth.getUser();
    const payload = {
      user_id: u.user!.id,
      nome: form.nome,
      banco: form.banco || null,
      taxa_juros_mensal: form.taxa_juros_mensal === "" ? null : Number(form.taxa_juros_mensal),
      valor_parcela: Number(form.valor_parcela),
      total_parcelas: Number(form.total_parcelas),
      saldo_devedor: Number(form.saldo_devedor),
      parcela_atual: Number(form.parcela_atual),
    };
    if (editing?.id) {
      const { error } = await supabase.from("consignados_contratos").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Contrato atualizado");
    } else {
      const { error } = await supabase.from("consignados_contratos").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Contrato criado");
    }
    onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} Contrato Consignado</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome do contrato</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
            <div><Label>Banco</Label><Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} /></div>
          </div>
          <div><Label>Taxa de Juros (% a.m.)</Label><Input type="number" step="0.0001" value={form.taxa_juros_mensal} onChange={(e) => setForm({ ...form, taxa_juros_mensal: e.target.value })} placeholder="Ex: 1.85" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Valor Parcela</Label><Input type="number" step="0.01" value={form.valor_parcela} onChange={(e) => setForm({ ...form, valor_parcela: e.target.value })} /></div>
            <div><Label>Parcela Atual</Label><Input type="number" value={form.parcela_atual} onChange={(e) => setForm({ ...form, parcela_atual: e.target.value })} /></div>
            <div><Label>Total Parcelas</Label><Input type="number" value={form.total_parcelas} onChange={(e) => setForm({ ...form, total_parcelas: e.target.value })} /></div>
          </div>
          <div><Label>Saldo Devedor Atual</Label><Input type="number" step="0.01" value={form.saldo_devedor} onChange={(e) => setForm({ ...form, saldo_devedor: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AmortizarDialog({ contrato, onClose, comp, onSaved }: any) {
  const [form, setForm] = useState({ valor_extra: "", parcelas_abatidas: "1", reducao_bruta: "" });
  useEffect(() => { setForm({ valor_extra: "", parcelas_abatidas: "1", reducao_bruta: "" }); }, [contrato]);
  if (!contrato) return null;

  const valorExtra = Number(form.valor_extra) || 0;
  const reducao = Number(form.reducao_bruta) || 0;
  const jurosSalvos = Math.max(0, reducao - valorExtra);

  async function aplicar() {
    const { data: u } = await supabase.auth.getUser();
    const parcAbat = Number(form.parcelas_abatidas) || 1;
    const novoTotal = Math.max(0, contrato.total_parcelas - parcAbat);
    const novoSaldo = Math.max(0, Number(contrato.saldo_devedor) - reducao);

    const { error: e1 } = await supabase.from("consignados_contratos").update({
      total_parcelas: novoTotal, saldo_devedor: novoSaldo,
    }).eq("id", contrato.id);
    if (e1) return toast.error(e1.message);

    // Despesa real do tipo amortização no mês atual — criada antes para ter o id de vínculo
    let despesaId: string | null = null;
    if (valorExtra > 0) {
      const { data: ins, error: eDesp } = await supabase.from("despesas").insert({
        user_id: u.user!.id, competencia: comp, data_venc: hojeISO(),
        descricao: `Amortização extraordinária — ${contrato.nome}`,
        categoria: "Amortização", valor: valorExtra, status: "PAGO", tipo: "amortizacao", recorrente: false,
      }).select("id").single();
      if (eDesp) return toast.error(eDesp.message);
      despesaId = ins?.id ?? null;
    }

    await (supabase.from as any)("consignados_eventos").insert({
      user_id: u.user!.id, contrato_id: contrato.id, competencia: comp,
      tipo: "amortizacao", parcelas_abatidas: parcAbat,
      valor_extra: valorExtra, reducao_bruta: reducao, juros_salvos: jurosSalvos,
      despesa_id: despesaId,
    });

    toast.success(`Você destruiu ${BRL(jurosSalvos)} em juros! 🏆`);
    onSaved();
  }

  return (
    <Dialog open={!!contrato} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Amortizar Extraordinário — {contrato.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Valor Extra Pago (R$) — sai do caixa hoje</Label><Input type="number" step="0.01" value={form.valor_extra} onChange={(e) => setForm({ ...form, valor_extra: e.target.value })} /></div>
          <div><Label>Quantidade de Parcelas Abatidas (de trás pra frente)</Label><Input type="number" value={form.parcelas_abatidas} onChange={(e) => setForm({ ...form, parcelas_abatidas: e.target.value })} /></div>
          <div><Label>Redução Bruta no Saldo Devedor (R$)</Label><Input type="number" step="0.01" value={form.reducao_bruta} onChange={(e) => setForm({ ...form, reducao_bruta: e.target.value })} /></div>
          <div className="p-3 rounded-md bg-success/10 border border-success/30">
            <div className="text-xs text-muted-foreground">Juros Destruídos</div>
            <div className="text-2xl font-bold text-success tabular">{BRL(jurosSalvos)}</div>
            <div className="text-xs text-muted-foreground">= Redução Bruta − Valor Extra Pago</div>
          </div>
        </div>
        <DialogFooter><Button onClick={aplicar}>Aplicar Amortização</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────── RESERVAS / CAIXINHAS ───────────── */

function ReservasView({ data, comp, onSaved }: any) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [amortAlvo, setAmortAlvo] = useState<any>(null);
  const reservas = (data.reservas ?? []) as any[];
  const total = reservas.reduce((s, r) => s + Number(r.valor ?? 0), 0);

  async function resgatar(r: any) {
    const valor = Number(r.valor ?? 0);
    if (!valor) return;
    if (!confirm(`Resgatar ${BRL(valor)} da caixinha "${r.nome}" de volta para o Saldo?`)) return;
    const { data: u } = await supabase.auth.getUser();
    const { error: e1 } = await supabase.from("receitas").insert({
      user_id: u.user!.id, competencia: comp, data: hojeISO(),
      descricao: `Resgate — ${r.nome}${r.banco ? ` (${r.banco})` : ""}`,
      categoria: "Investimentos", valor, status: "RECEBIDO",
    });
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await (supabase.from as any)("reservas").delete().eq("id", r.id);
    if (e2) return toast.error(e2.message);
    toast.success(`${BRL(valor)} de volta no Saldo`);
    onSaved();
  }

  async function deletar(r: any) {
    if (!confirm(`Excluir a caixinha "${r.nome}"? O valor NÃO volta para o Saldo (use "Resgatar" para isso).`)) return;
    const { error } = await (supabase.from as any)("reservas").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Caixinha excluída");
    onSaved();
  }

  return (
    <Card className="p-5 bg-card border-border">
      <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <PiggyBank className="w-4 h-4 text-info" /> Reservas / Caixinhas
          <Badge variant="outline" className="ml-2">{reservas.length} · Total {BRL(total)}</Badge>
        </h3>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />Nova caixinha
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Valor guardado sai do <strong>Saldo livre</strong> e passa a compor o <strong>Patrimônio Total</strong>.
        Use "Resgatar" para devolver ao caixa, ou "Amortizar Consignado" para abater direto no saldo devedor.
      </p>

      {reservas.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma caixinha cadastrada.</p>
      )}

      <div className="space-y-3">
        {reservas.map((r) => (
          <div key={r.id} className="p-4 rounded-md bg-secondary/40 border border-border">
            <div className="flex justify-between items-start gap-3 mb-3 flex-wrap">
              <div className="min-w-0">
                <div className="font-semibold truncate">{r.nome}</div>
                <div className="text-xs text-muted-foreground">{r.banco ?? "—"}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Guardado</div>
                <div className="font-bold tabular text-info">{BRL(Number(r.valor))}</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => resgatar(r)}>
                <ArrowUpFromLine className="w-4 h-4 mr-1" />Resgatar para o Saldo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAmortAlvo(r)}
                disabled={!(data.contratos ?? []).length}
                title={!(data.contratos ?? []).length ? "Nenhum contrato consignado ativo" : ""}
              >
                <Trophy className="w-4 h-4 mr-1" />Usar para Amortizar Consignado
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setEditing(r); setOpen(true); }}>
                <Edit2 className="w-4 h-4 mr-1" />Editar
              </Button>
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => deletar(r)}>
                <Trash2 className="w-4 h-4 mr-1" />Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ReservaForm open={open} onOpenChange={setOpen} editing={editing} comp={comp} onSaved={() => { setOpen(false); onSaved(); }} />
      <ReservaAmortizarDialog reserva={amortAlvo} contratos={data.contratos ?? []} comp={comp} onClose={() => setAmortAlvo(null)} onSaved={() => { setAmortAlvo(null); onSaved(); }} />
    </Card>
  );
}

function ReservaForm({ open, onOpenChange, editing, comp, onSaved }: any) {
  const empty = { nome: "", banco: "", valor: "", competencia: comp };
  const [form, setForm] = useState<any>(editing ?? empty);
  useEffect(() => { setForm(editing ?? { ...empty, competencia: comp }); }, [editing, open, comp]); // eslint-disable-line

  async function salvar() {
    if (!form.nome?.trim()) return toast.error("Informe o nome da caixinha");
    const payload: any = {
      nome: String(form.nome).trim(),
      banco: form.banco ? String(form.banco).trim() : null,
      valor: Number(form.valor) || 0,
      competencia: form.competencia || comp,
    };
    if (editing?.id) {
      const { error } = await (supabase.from as any)("reservas").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Caixinha atualizada");
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await (supabase.from as any)("reservas").insert({ ...payload, user_id: u.user!.id });
      if (error) return toast.error(error.message);
      toast.success(`Caixinha criada · ${BRL(payload.valor)} saíram do Saldo livre`);
    }
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar" : "Nova"} caixinha</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome da Caixinha</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Caixinha Turbo Nubank" /></div>
          <div><Label>Banco</Label><Input value={form.banco ?? ""} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ex.: Nubank" /></div>
          <div><Label>Valor Guardado (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
          <div><Label>Competência do Aporte</Label><Input type="month" value={String(form.competencia ?? comp).slice(0,7)} onChange={(e) => setForm({ ...form, competencia: `${e.target.value}-01` })} /><p className="text-xs text-muted-foreground mt-1">Mês em que o dinheiro foi guardado. A caixinha só aparece a partir desta competência.</p></div>
        </div>
        <DialogFooter><Button onClick={salvar}>Salvar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReservaAmortizarDialog({ reserva, contratos, comp, onClose, onSaved }: any) {
  const [contratoId, setContratoId] = useState<string>("");
  const [valor, setValor] = useState<string>("");
  const [reducao, setReducao] = useState<string>("");
  const [parcelas, setParcelas] = useState<string>("1");

  useEffect(() => {
    if (!reserva) return;
    setContratoId(contratos?.[0]?.id ?? "");
    setValor(String(Number(reserva.valor ?? 0)));
    setReducao(String(Number(reserva.valor ?? 0)));
    setParcelas("1");
  }, [reserva, contratos]);

  if (!reserva) return null;

  const contrato = contratos.find((c: any) => c.id === contratoId);
  const ve = Number(valor) || 0;
  const rb = Number(reducao) || 0;
  const js = Math.max(0, rb - ve);
  const disponivel = Number(reserva.valor ?? 0);

  async function aplicar() {
    if (!contrato) return toast.error("Selecione um contrato consignado");
    if (ve <= 0) return toast.error("Valor a amortizar deve ser maior que zero");
    if (ve > disponivel + 0.001) return toast.error(`Caixinha só tem ${BRL(disponivel)} guardado`);

    const { data: u } = await supabase.auth.getUser();
    const parcAbat = Number(parcelas) || 1;
    const novoTotal = Math.max(0, Number(contrato.total_parcelas) - parcAbat);
    const novoSaldoDev = Math.max(0, Number(contrato.saldo_devedor) - rb);

    const { error: e1 } = await supabase.from("consignados_contratos").update({
      total_parcelas: novoTotal, saldo_devedor: novoSaldoDev,
    }).eq("id", contrato.id);
    if (e1) return toast.error(e1.message);

    // Evento de amortização — sem despesa vinculada (dinheiro veio da caixinha, já estava fora do saldo livre)
    await (supabase.from as any)("consignados_eventos").insert({
      user_id: u.user!.id, contrato_id: contrato.id, competencia: comp,
      tipo: "amortizacao", parcelas_abatidas: parcAbat,
      valor_extra: ve, reducao_bruta: rb, juros_salvos: js, despesa_id: null,
    });

    // Baixa na caixinha
    const restante = Math.max(0, disponivel - ve);
    if (restante <= 0.001) {
      await (supabase.from as any)("reservas").delete().eq("id", reserva.id);
    } else {
      await (supabase.from as any)("reservas").update({ valor: restante }).eq("id", reserva.id);
    }

    toast.success(`Amortização aplicada · ${BRL(js)} em juros destruídos 🏆`);
    onSaved();
  }

  return (
    <Dialog open={!!reserva} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Amortizar Consignado com "{reserva.nome}"</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Guardado nesta caixinha: <strong className="text-info tabular">{BRL(disponivel)}</strong>
          </div>
          <div>
            <Label>Contrato Consignado</Label>
            <Select value={contratoId} onValueChange={setContratoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o contrato" /></SelectTrigger>
              <SelectContent>
                {contratos.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome} · Saldo {BRL(Number(c.saldo_devedor))}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Valor Amortizado (R$) — sai da caixinha</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Parcelas Abatidas (de trás pra frente)</Label><Input type="number" value={parcelas} onChange={(e) => setParcelas(e.target.value)} /></div>
          <div><Label>Redução Bruta no Saldo Devedor (R$)</Label><Input type="number" step="0.01" value={reducao} onChange={(e) => setReducao(e.target.value)} /></div>
          <div className="p-3 rounded-md bg-success/10 border border-success/30">
            <div className="text-xs text-muted-foreground">Juros Destruídos</div>
            <div className="text-2xl font-bold text-success tabular">{BRL(js)}</div>
            <div className="text-xs text-muted-foreground">= Redução Bruta − Valor Amortizado</div>
          </div>
        </div>
        <DialogFooter><Button onClick={aplicar}>Aplicar Amortização</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
