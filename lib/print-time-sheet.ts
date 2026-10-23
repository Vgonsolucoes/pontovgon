import { displayDate } from "./attendance-display";
import { formatMinutes, formatMinutesSigned } from "./utils";
import type { buildSheet } from "../server/lib/attendance";
type Report = ReturnType<typeof buildSheet> & { employee: { name: string; registration: string; department: string | null; schedule: string | null } };
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export function timeSheetPrintHtml(report: Report) {
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Espelho de Ponto</title><style>
    @page { size: A4 portrait; margin: 8mm; }
    * { box-sizing: border-box; } html,body { margin:0; padding:0; background:white; color:#111; font-family:Arial,sans-serif; }
    #sheet { width:194mm; font-size:8pt; line-height:1.15; }
    h1 { font-size:13pt; margin:0 0 2mm; } p { margin:0 0 1mm; overflow-wrap:anywhere; }
    header { border-bottom:1px solid #333; padding-bottom:2mm; margin-bottom:2mm; }
    .totals { display:flex; gap:3mm; margin:2mm 0; } .totals div { flex:1; border:1px solid #ccc; padding:1.5mm; } .totals strong { display:block; margin-top:1mm; font-size:10pt; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; } th,td { text-align:left; border:1px solid #bbb; padding:1mm; vertical-align:top; overflow-wrap:anywhere; } th { background:#eee; }
    th:nth-child(1){width:15%} th:nth-child(2){width:28%} th:nth-child(3),th:nth-child(4),th:nth-child(5){width:10%} th:nth-child(6){width:27%}
    tr { break-inside:avoid; } .notes { font-size:6.5pt; margin-top:.5mm; } footer { font-size:6.5pt; margin-top:2mm; } .muted { color:#444; }
    @media print { body { width:194mm; } }
  </style></head><body><article id="sheet"><header><h1>VGON PONTO · Espelho de Ponto</h1><p><b>${escape(report.employee.name)}</b> · Matrícula ${escape(report.employee.registration)}</p><p>${escape(displayDate(report.start))} a ${escape(displayDate(report.end))} · Setor: ${escape(report.employee.department || "Não informado")} · Jornada: ${escape(report.employee.schedule || "Não vinculada")}</p><p class="muted">Horário de Brasília · Gerado em ${escape(new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }))}</p></header>
  <section class="totals">${[["Previstas no mês", formatMinutes(report.totals.expectedMinutes)], ["Trabalhadas (pares completos)", formatMinutes(report.totals.workedMinutes)], ["Saldo dos dias encerrados", formatMinutesSigned(report.totals.balanceMinutes)], ["Dias pendentes", report.totals.pendingDays]].map(([label,value])=>`<div>${escape(label)}<strong>${escape(value)}</strong></div>`).join("")}</section>
  <table><thead><tr>${["Data / dia", "Batidas", "Previstas", "Trabalhadas", "Saldo", "Situação / observações"].map(label=>`<th>${label}</th>`).join("")}</tr></thead><tbody>${report.rows.map(row=>`<tr><td>${escape(displayDate(row.date))} ${days[row.weekday]}</td><td>${row.punches.map(punch=>escape(punch.time)+(punch.nextDay?" (+1)":"")).join(" · ") || "—"}</td><td>${formatMinutes(row.expectedMinutes)}</td><td>${formatMinutes(row.workedMinutes)}</td><td>${formatMinutesSigned(row.balanceMinutes)}</td><td>${escape(row.status)}${row.notes.length?`<div class="notes">${row.notes.map(escape).join("; ")}</div>`:""}</td></tr>`).join("")}</tbody></table>
  <footer><p>${report.totals.punches} marcações utilizadas. (+1): dia seguinte. --:--: não apurado. Excluídas e repetidas classificadas não entram no cálculo.</p><p>${escape(report.rules)}</p>${report.totals.pendingDays?"<p>Saldo total indisponível enquanto houver dias encerrados pendentes. Dias atuais e futuros não geram débito automático.</p>":""}</footer></article></body></html>`;
}
export async function printTimeSheet(report: Report) {
  const frame = document.createElement("iframe");
  frame.title = "Impressão do espelho de ponto";
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:800px;height:1120px;border:0";
  document.body.appendChild(frame);
  frame.srcdoc = timeSheetPrintHtml(report);
  await new Promise<void>(resolve => { frame.onload = () => resolve(); });
  await frame.contentDocument?.fonts.ready;
  const sheet = frame.contentDocument?.getElementById("sheet");
  if (!sheet || !frame.contentWindow) { frame.remove(); throw new Error("Não foi possível preparar a impressão"); }
  // 279 mm úteis deixa 2 mm de reserva contra arredondamentos do motor de impressão.
  sheet.style.zoom = String(Math.min(1, (279 * 96 / 25.4) / sheet.scrollHeight));
  frame.contentWindow.addEventListener("afterprint", () => setTimeout(() => frame.remove(), 0), { once: true });
  frame.contentWindow.focus(); frame.contentWindow.print();
}
