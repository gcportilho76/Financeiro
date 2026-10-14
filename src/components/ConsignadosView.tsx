import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

interface ConsignadosViewProps {
  data?: {
    consignados?: Array<{
      id: string;
      nome: string;
      valor_parcela: number | string;
      parcela_atual: number | string;
      total_parcelas: number | string;
      saldo_devedor?: number | string;
    }>;
  };
}

export function ConsignadosView({ data }: ConsignadosViewProps) {
  // Lista padrão de fallback caso ainda não venham dados do Supabase
  const consignadosBrutos = data?.consignados && data.consignados.length > 0
    ? data.consignados
    : [
        { id: "pan", nome: "Banco Pan", valor_parcela: 520.65, parcela_atual: 53, total_parcelas: 60 },
        { id: "nu197", nome: "Nubank (Contrato 197)", valor_parcela: 197.11, parcela_atual: 8, total_parcelas: 29 },
        { id: "nu790", nome: "Nubank (Contrato 790)", valor_parcela: 790.42, parcela_atual: 10, total_parcelas: 40 },
        { id: "nu706", nome: "Nubank (Contrato 706)", valor_parcela: 706.56, parcela_atual: 16, total_parcelas: 92 },
      ];

  // Processa e calcula os indicadores dinamicamente
  const consignadosProcessados = consignadosBrutos.map((item) => {
    const pAtual = Number(item.parcela_atual) || 1;
    const pTotal = Number(item.total_parcelas) || 1;
    const pRestantes = Math.max(0, pTotal - pAtual);
    const valorParcela = Number(item.valor_parcela) || 0;
    const progresso = Math.min(100, Math.round((pAtual / pTotal) * 100));

    // Calcula a data estimada de término a partir do mês atual
    const dataTermino = new Date();
    dataTermino.setMonth(dataTermino.getMonth() + pRestantes);
    const mesExtenso = dataTermino.toLocaleDateString("pt-BR", { month: "long" });
    const anoTermino = dataTermino.getFullYear();
    const mesFormatado = mesExtenso.charAt(0).toUpperCase() + mesExtenso.slice(1);

    return {
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

  // Ordena pelo contrato que vai acabar mais rápido (menor número de parcelas restantes)
  consignadosProcessados.sort((a, b) => a.parcelasRestantes - b.parcelasRestantes);

  const totalComprometimento = consignadosProcessados.reduce((acc, c) => acc + c.parcela, 0);
  const proximoAConcluir = consignadosProcessados[0];

  return (
    <div className="space-y-6 mt-4">
      {/* Cards de Resumo Calculados Dinamicamente */}
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

      {/* Cronograma Dinâmico de Liberação de Margem */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Cronograma de Liberação de Margem Líquida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {consignadosProcessados.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-foreground">
                  {c.nome} — R$ {c.parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mês
                </span>
                <span className="text-emerald-500 font-medium">
                  Término: {c.fimEstimado} ({c.parcelaAtual}/{c.totalParcelas} — faltam {c.parcelasRestantes} parcelas)
                </span>
              </div>
              <Progress value={c.progresso} className="h-2 bg-secondary" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}