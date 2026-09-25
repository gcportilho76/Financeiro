import { useState, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, Loader as Loader2, CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Trash2, Save, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { BRL, hojeISO, competenciaAtual } from "@/lib/finance";

type ExtractedItem = {
  data: string;
  descricao: string;
  valor: number;
  tipo: "receita" | "despesa";
  categoria: string;
};

type RowItem = ExtractedItem & {
  _id: string;
  _selected: boolean;
  _status: "PREVISTO" | "RECEBIDO" | "PAGO" | "PENDENTE";
};

const CATEGORIAS = [
  "Habitação",
  "Alimentação",
  "Transporte",
  "Educação",
  "Saúde",
  "Lazer",
  "Cartão",
  "Salário",
  "Freelance",
  "Investimentos",
  "Amortização",
  "Consignado",
  "Outros",
];

export function ImportExtratoPanel({
  comp,
  onSaved,
}: {
  comp: string;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RowItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setFile(null);
    setRows([]);
  }, []);

  const handleFile = useCallback((f: File) => {
    const allowed = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
    ];
    if (!allowed.includes(f.type)) {
      toast.error("Formato não suportado. Use PDF, PNG, JPG ou WEBP.");
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máximo 15 MB).");
      return;
    }
    setFile(f);
    setRows([]);
  }, []);

  async function extrair() {
    if (!file) return;
    setLoading(true);
    setRows([]);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import-extrato", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao processar o documento.");
        return;
      }

      const itens: ExtractedItem[] = json.itens ?? [];
      if (itens.length === 0) {
        toast.error("A IA não encontrou transações no documento.");
        return;
      }

      const newRows: RowItem[] = itens.map((item, i) => ({
        ...item,
        _id: `${Date.now()}-${i}`,
        _selected: true,
        _status: item.tipo === "receita" ? "PREVISTO" : "PENDENTE",
      }));

      setRows(newRows);
      toast.success(`${itens.length} transação(ões) encontrada(s). Revise antes de salvar.`);
    } catch (e: any) {
      toast.error(e.message ?? "Erro de conexão com o servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function salvar() {
    const selecionados = rows.filter((r) => r._selected);
    if (selecionados.length === 0) {
      toast.error("Selecione ao menos uma transação para salvar.");
      return;
    }

    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        toast.error("Sessão expirada.");
        return;
      }
      const uid = u.user.id;

      const receitas: any[] = [];
      const despesas: any[] = [];

      for (const r of selecionados) {
        const dataLanc = r.data && r.data.length === 10 ? r.data : hojeISO();
        if (r.tipo === "receita") {
          receitas.push({
            user_id: uid,
            competencia: comp,
            data: dataLanc,
            descricao: r.descricao,
            categoria: r.categoria || "Outros",
            valor: r.valor,
            status: r._status === "RECEBIDO" ? "RECEBIDO" : "PREVISTO",
          });
        } else {
          despesas.push({
            user_id: uid,
            competencia: comp,
            data_venc: dataLanc,
            descricao: r.descricao,
            categoria: r.categoria || "Outros",
            valor: r.valor,
            status: r._status === "PAGO" ? "PAGO" : "PENDENTE",
            tipo: "variavel",
            recorrente: false,
          });
        }
      }

      let erroMsg: string | null = null;

      if (receitas.length) {
        const { error } = await supabase.from("receitas").insert(receitas);
        if (error) erroMsg = error.message;
      }
      if (!erroMsg && despesas.length) {
        const { error } = await supabase.from("despesas").insert(despesas);
        if (error) erroMsg = error.message;
      }

      if (erroMsg) {
        toast.error(erroMsg);
      } else {
        const totalRec = receitas.reduce((s, r) => s + r.valor, 0);
        const totalDesp = despesas.reduce((s, d) => s + d.valor, 0);
        toast.success(
          `${receitas.length} receita(s) (${BRL(totalRec)}) e ${despesas.length} despesa(s) (${BRL(
            totalDesp,
          )}) importadas.`,
        );
        qc.invalidateQueries({ queryKey: ["fin"] });
        reset();
        setOpen(false);
        onSaved();
      }
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  function updateRow(id: string, patch: Partial<RowItem>) {
    setRows((prev) => prev.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  }

  function toggleAll(on: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, _selected: on })));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r._id !== id));
  }

  const selecionados = rows.filter((r) => r._selected);
  const totalRec = selecionados
    .filter((r) => r.tipo === "receita")
    .reduce((s, r) => s + r.valor, 0);
  const totalDesp = selecionados
    .filter((r) => r.tipo === "despesa")
    .reduce((s, r) => s + r.valor, 0);

  return (
    <>
      <Card className="p-5 bg-card border-border">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Importar Extrato/Fatura com IA
              </h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                Envie um PDF ou foto do extrato bancário ou fatura de cartão. A IA
                lê o documento, extrai data, descrição, valor e tipo, e você
                revisa antes de salvar nos seus lançamentos.
              </p>
            </div>
            <Button onClick={() => setOpen(true)}>
              <Upload className="w-4 h-4 mr-1" />
              Enviar documento
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase text-muted-foreground">Formatos</div>
              <div className="text-sm font-medium mt-1">PDF, PNG, JPG, WEBP</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase text-muted-foreground">Tamanho máx.</div>
              <div className="text-sm font-medium mt-1">15 MB</div>
            </div>
            <div className="rounded-lg border border-border p-4">
              <div className="text-xs uppercase text-muted-foreground">IA usada</div>
              <div className="text-sm font-medium mt-1">GPT-4o (visão)</div>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Extrato/Fatura com IA</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Upload area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer ${
                dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="w-10 h-10 text-primary" />
                  <div className="font-medium text-sm">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(0)} KB · {file.type}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-10 h-10 text-muted-foreground" />
                  <div className="font-medium text-sm">
                    Arraste um arquivo ou clique para selecionar
                  </div>
                  <div className="text-xs text-muted-foreground">
                    PDF, PNG, JPG ou WEBP — até 15 MB
                  </div>
                </div>
              )}
            </div>

            {file && rows.length === 0 && (
              <div className="flex justify-center gap-2">
                <Button onClick={extrair} disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Lendo documento...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1" />
                      Extrair transações
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setFile(null)} disabled={loading}>
                  Trocar arquivo
                </Button>
              </div>
            )}

            {rows.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="text-sm font-medium">
                    {rows.length} transação(ões) encontrada(s) — revise e selecione
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => toggleAll(true)}>
                      Selecionar todas
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => toggleAll(false)}>
                      Limpar seleção
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="p-2 w-8"></th>
                        <th className="p-2 text-left">Data</th>
                        <th className="p-2 text-left">Descrição</th>
                        <th className="p-2 text-left">Tipo</th>
                        <th className="p-2 text-left">Categoria</th>
                        <th className="p-2 text-left">Status</th>
                        <th className="p-2 text-right">Valor</th>
                        <th className="p-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r._id} className="border-t border-border">
                          <td className="p-2">
                            <Checkbox
                              checked={r._selected}
                              onCheckedChange={(v) => updateRow(r._id, { _selected: !!v })}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="date"
                              value={r.data}
                              onChange={(e) => updateRow(r._id, { data: e.target.value })}
                              className="h-8 w-36 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              value={r.descricao}
                              onChange={(e) => updateRow(r._id, { descricao: e.target.value })}
                              className="h-8 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Badge
                              variant={r.tipo === "receita" ? "secondary" : "outline"}
                              className={
                                r.tipo === "receita"
                                  ? "bg-success/15 text-success border-success/30"
                                  : "bg-warning/15 text-warning border-warning/30"
                              }
                            >
                              {r.tipo}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Select
                              value={r.categoria}
                              onValueChange={(v) => updateRow(r._id, { categoria: v })}
                            >
                              <SelectTrigger className="h-8 w-36 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIAS.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {c}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2">
                            <Select
                              value={r._status}
                              onValueChange={(v) =>
                                updateRow(r._id, { _status: v as RowItem["_status"] })
                              }
                            >
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {r.tipo === "receita" ? (
                                  <>
                                    <SelectItem value="PREVISTO">PREVISTO</SelectItem>
                                    <SelectItem value="RECEBIDO">RECEBIDO</SelectItem>
                                  </>
                                ) : (
                                  <>
                                    <SelectItem value="PENDENTE">PENDENTE</SelectItem>
                                    <SelectItem value="PAGO">PAGO</SelectItem>
                                  </>
                                )}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              value={r.valor}
                              onChange={(e) =>
                                updateRow(r._id, { valor: Number(e.target.value) || 0 })
                              }
                              className={`h-8 w-24 text-xs text-right tabular ${
                                r.tipo === "receita" ? "text-success" : "text-warning"
                              }`}
                            />
                          </td>
                          <td className="p-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => removeRow(r._id)}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-muted/30 font-medium">
                        <td colSpan={6} className="p-2 text-right text-xs">
                          Selecionadas ({selecionados.length}):
                        </td>
                        <td className="p-2 text-right tabular text-sm" colSpan={2}>
                          <span className="text-success">+{BRL(totalRec)}</span>
                          {"  "}
                          <span className="text-warning">-{BRL(totalDesp)}</span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" onClick={() => { reset(); }} disabled={saving}>
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Recomeçar
                  </Button>
                  <div className="flex items-center gap-2">
                    {selecionados.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                        {selecionados.length} prontas para salvar em {comp.slice(0, 7)}
                      </div>
                    )}
                    <Button onClick={salvar} disabled={saving || selecionados.length === 0}>
                      {saving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-1" />
                          Salvar {selecionados.length} lançamento(s)
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {rows.length === 0 && !file && (
              <div className="flex items-start gap-2 p-3 rounded-md bg-info/10 border border-info/30 text-xs text-muted-foreground">
                <AlertTriangle className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <div>
                  <strong>Dica:</strong> para melhor precisão, use extratos em PDF
                  gerados pelo app do banco ou fotos nítidas e bem iluminadas da
                  tela/fatura impressa. A IA pode cometer erros — sempre revise os
                  dados antes de salvar.
                </div>
              </div>
            )}
          </div>

          {rows.length === 0 && (
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }}>
                Cancelar
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
