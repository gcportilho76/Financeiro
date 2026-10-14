import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

export function ConsignadosView() {
  const consignados = [
    { id: "pan", banco: "Banco Pan", parcela: 520.65, parcelasRestantes: 8, fimEstimado: "Maio/2027", progresso: 90 },
    { id: "nu197", banco: "Nubank (Contrato 197)", parcela: 197.11, parcelasRestantes: 22, fimEstimado: "Agosto/2028", progresso: 70 },
    { id: "nu790", banco: "Nubank (Contrato 790)", parcela: 790.42, parcelasRestantes: 31, fimEstimado: "Maio/2029", progresso: 50 },
    { id: "nu706", banco: "Nubank (Contrato 706)", parcela: 706.56, parcelasRestantes: 77, fimEstimado: "Março/2033", progresso: 20 },
  ];

  return (
    <div className="space-y-6 mt-4">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Comprometimento Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              R$ 2.214,74 <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">4 contratos ativos em folha</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Próxima Margem Liberada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              + R$ 520,65 <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Banco Pan • Término em 8 meses</p>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Projeção de Liberação Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              + R$ 2.214,74 <span className="text-xs font-normal text-muted-foreground">/mês</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Margem 100% livre até Março/2033</p>
          </CardContent>
        </Card>
      </div>

      {/* Cronograma de Liberação */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" /> Cronograma de Liberação de Margem Líquida
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {consignados.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex justify-between items-center text-sm">
                <span className="font-semibold text-foreground">
                  {c.banco} — R$ {c.parcela.toFixed(2).replace(".", ",")}/mês
                </span>
                <span className="text-emerald-500 font-medium">
                  Término: {c.fimEstimado} ({c.parcelasRestantes} parcelas)
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