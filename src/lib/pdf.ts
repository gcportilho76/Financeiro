import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRL, formatCompetencia } from "./finance";

// Paleta para fatias da pizza (alinhada com o dashboard)
const PALETA = ["#3b82f6","#f97316","#a855f7","#eab308","#06b6d4","#ef4444","#ec4899","#0ea5e9","#d946ef","#f59e0b","#6366f1","#dc2626","#22c55e"];

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function desenharPizza(doc: jsPDF, cx: number, cy: number, r: number, fatias: { name: string; value: number }[]) {
  const total = fatias.reduce((s, f) => s + f.value, 0);
  if (total <= 0) return;
  let acc = -Math.PI / 2;
  fatias.forEach((f, i) => {
    const ang = (f.value / total) * Math.PI * 2;
    const steps = Math.max(6, Math.ceil((ang / (Math.PI * 2)) * 48));
    const pts: [number, number][] = [[cx, cy]];
    for (let s = 0; s <= steps; s++) {
      const a = acc + (ang * s) / steps;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    const [R, G, B] = hexToRgb(PALETA[i % PALETA.length]);
    doc.setFillColor(R, G, B);
    doc.setDrawColor(R, G, B);
    // Aproximação por polígono
    (doc as any).lines(
      pts.slice(1).map((p, idx) => [p[0] - pts[idx][0], p[1] - pts[idx][1]]),
      pts[0][0], pts[0][1], [1, 1], "F", true
    );
    acc += ang;
  });
}

export function gerarPDF({
  comp, profile, receitas, despesas, cartoes, contratos, insumos = [], eventos = [], calc,
}: any) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório Financeiro — Orçamento Gutê", margin, y);
  y += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Competência: ${formatCompetencia(comp)}`, margin, y);
  doc.text(`Emitido em: ${new Date().toLocaleString("pt-BR")}`, 210 - margin, y, { align: "right" });
  y += 4;

  // ─── Gráfico de pizza (Distribuição da Receita) ───
  // Agrupa despesas em dinheiro por categoria (ignora amortizações e consignados, que já entram em outro bloco)
  const grupos: Record<string, number> = {};
  for (const d of despesas) {
    if (d.tipo === "consignado" || d.tipo === "amortizacao") continue;
    const cat = (d.categoria && String(d.categoria).trim()) || "Outros";
    grupos[cat] = (grupos[cat] ?? 0) + Number(d.valor || 0);
  }
  // Soma TODOS os lançamentos de cartão ativos (ativo !== false cobre registros legados sem o campo)
  const totCartoes = (cartoes || [])
    .filter((c: any) => c.ativo !== false)
    .reduce((s: number, c: any) => s + Number(c.valor || 0), 0);
  if (totCartoes > 0) grupos["Cartões"] = (grupos["Cartões"] ?? 0) + totCartoes;

  const fatias = Object.entries(grupos)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ name: k, value: v }));
  if (calc.resultadoMes > 0) fatias.push({ name: "Sobra Líquida", value: calc.resultadoMes });

  if (fatias.length > 0) {
    const cx = margin + 22, cy = y + 26, r = 22;
    desenharPizza(doc, cx, cy, r, fatias);
    // Legenda — base 100% = Total de Receitas (garante somatório consistente)
    const totRec = calc.totalReceitas || fatias.reduce((s, f) => s + f.value, 0);
    const colW = 70;
    const linhasPorCol = Math.max(6, Math.ceil(fatias.length / 2));
    doc.setFontSize(8);
    fatias.forEach((f, i) => {
      const col = Math.floor(i / linhasPorCol);
      const row = i % linhasPorCol;
      const lx = margin + 50 + col * colW;
      const ly = y + 4 + row * 4;
      const [R, G, B] = hexToRgb(PALETA[i % PALETA.length]);
      doc.setFillColor(R, G, B);
      doc.rect(lx, ly - 2.5, 3, 3, "F");
      doc.setTextColor(60);
      const pct = totRec > 0 ? ((f.value / totRec) * 100).toFixed(1) : "0.0";
      doc.text(`${f.name} — ${BRL(f.value)} (${pct}%)`, lx + 5, ly);
    });
    const legendaH = linhasPorCol * 4 + 4;
    y = Math.max(y + 52, y + 4 + legendaH);
  }

  // ─── Tabela resumo (lógica SIMÉTRICA: previstos + pendentes) ───
  autoTable(doc, {
    startY: y,
    head: [["Indicador", "Valor"]],
    body: [
      ["Saldo Inicial", BRL(Number(profile.saldo_inicial))],
      ["Receitas Recebidas", BRL(calc.recebidos)],
      ["Receitas Previstas", BRL(calc.previstos)],
      ...(calc.receitaProjetada > 0
        ? [["Receita Projetada (Salário Base)", BRL(calc.receitaProjetada)]]
        : []),
      ["Total de Receitas", BRL(calc.totalReceitas)],
      ["Despesas Pagas", BRL(calc.despPagas)],
      ["Despesas Pendentes", BRL(calc.despPendentes)],
      ["Total Despesas (cash)", BRL(calc.totalDespesasCash)],
      ["Cartões Pagos", BRL(calc.cartPagos)],
      ["Cartões Pendentes", BRL(calc.cartPendentes)],
      ["Total Cartões", BRL(calc.totalCartoes)],
      ["Disponibilidade Diária", BRL(calc.dispDiaria)],
      ["Resultado do Mês (previsto + realizado)", BRL(calc.resultadoMes)],
    ],
    headStyles: { fillColor: [40, 60, 80] },
    styles: { fontSize: 9 },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (receitas.length) {
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Receitas (recebidas e previstas)", margin, y); y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["Data", "Descrição", "Categoria", "Status", "Valor"]],
      body: receitas.map((r: any) => [r.data, r.descricao, r.categoria, r.status, BRL(Number(r.valor))]),
      styles: { fontSize: 8 }, theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  const despCash = despesas.filter((d: any) => d.tipo !== "consignado");
  if (despCash.length) {
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Despesas em Dinheiro (pagas e pendentes)", margin, y); y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["Vencimento", "Descrição", "Categoria", "Tipo", "Status", "Valor"]],
      body: despCash.map((d: any) => [d.data_venc, d.descricao, d.categoria, d.tipo, d.status, BRL(Number(d.valor))]),
      styles: { fontSize: 8 }, theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (insumos.length) {
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Insumos", margin, y); y += 2;
    autoTable(doc, {
      startY: y + 2,
      head: [["Nome", "Valor Base", "Fim de Consumo", "Validade"]],
      body: insumos.map((i: any) => [i.nome, BRL(Number(i.valor_base)), i.data_final_consumo ?? "—", i.validade ?? "—"]),
      styles: { fontSize: 8 }, theme: "striped",
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  if (cartoes.length) {
    const grupos: Record<string, any[]> = {};
    for (const c of cartoes) {
      const k = c.cartao || "Geral";
      (grupos[k] ??= []).push(c);
    }
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Despesas de Cartão (por banco/emissor)", margin, y); y += 2;
    for (const [banco, itens] of Object.entries(grupos)) {
      const subtotal = itens.filter((c: any) => c.ativo).reduce((s: number, c: any) => s + Number(c.valor), 0);
      autoTable(doc, {
        startY: y + 2,
        head: [[`${banco} — Subtotal ativo: ${BRL(subtotal)}`, "", "", "", ""]],
        body: [],
        styles: { fontSize: 9 }, theme: "plain",
      });
      y = (doc as any).lastAutoTable.finalY;
      autoTable(doc, {
        startY: y,
        head: [["Descrição", "Categoria", "Fatura", "Parcela", "Valor"]],
        body: itens.map((c: any) => [
          c.descricao + (c.consolidado ? " (mãe)" : ""),
          c.categoria,
          c.fatura === "seguinte" ? "Seguinte" : "Atual",
          c.parcela_total > 1 ? `${c.parcela_num}/${c.parcela_total}` : "—",
          BRL(Number(c.valor)),
        ]),
        styles: { fontSize: 8 }, theme: "striped",
      });
      y = (doc as any).lastAutoTable.finalY + 4;
    }
  }

  if (contratos.length) {
    const evMes = (eventos ?? []).filter((e: any) => e.tipo === "amortizacao" && e.competencia === comp);
    const porContrato: Record<string, { juros: number; pago: number }> = {};
    for (const e of evMes) {
      const k = e.contrato_id;
      porContrato[k] = porContrato[k] ?? { juros: 0, pago: 0 };
      porContrato[k].juros += Number(e.juros_salvos ?? 0);
      porContrato[k].pago += Number(e.valor_extra ?? 0);
    }
    const ativos = contratos.filter((c: any) => (c.parcela_atual ?? 0) < (c.total_parcelas ?? 0));
    const comprometimentoTotal = ativos.reduce((s: number, c: any) => s + Number(c.valor_parcela ?? 0), 0);
    const dividaConsolidada = contratos.reduce((s: number, c: any) => s + Number(c.saldo_devedor ?? 0), 0);
    const jurosMes = Object.values(porContrato).reduce((s, v) => s + v.juros, 0);
    const amortMes = Object.values(porContrato).reduce((s, v) => s + v.pago, 0);

    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Consignados em Folha (status + amortizações do mês)", margin, y); y += 2;

    autoTable(doc, {
      startY: y + 2,
      head: [["Resumo Consolidado dos Consignados", "Valor"]],
      body: [
        ["Comprometimento Total em Folha (parcelas ativas)", BRL(comprometimentoTotal)],
        ["Dívida Consolidada Total (saldo devedor)", BRL(dividaConsolidada)],
        ["Ganhos e Amortizações do Período — Juros Destruídos", BRL(jurosMes)],
        ["Ganhos e Amortizações do Período — Total Amortizado", BRL(amortMes)],
      ],
      headStyles: { fillColor: [20, 83, 45] },
      styles: { fontSize: 9 },
      theme: "grid",
    });
    y = (doc as any).lastAutoTable.finalY + 4;

    autoTable(doc, {
      startY: y,
      head: [["Contrato", "Banco", "Parcela", "Restantes", "Valor Parcela", "Saldo Devedor", "Amortizado no Mês", "Juros Abatidos no Mês"]],
      body: contratos.map((c: any) => {
        const m = porContrato[c.id] ?? { juros: 0, pago: 0 };
        return [
          c.nome, c.banco ?? "—",
          `${c.parcela_atual}/${c.total_parcelas}`,
          Math.max(0, c.total_parcelas - c.parcela_atual),
          BRL(Number(c.valor_parcela)),
          BRL(Number(c.saldo_devedor)),
          BRL(m.pago),
          BRL(m.juros),
        ];
      }),
      styles: { fontSize: 8 }, theme: "striped",
    });
  }

  doc.save(`relatorio-${comp}.pdf`);
}
