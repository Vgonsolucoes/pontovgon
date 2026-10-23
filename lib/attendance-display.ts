export const originLabels: Record<string, string> = { IDFACE: "iDFace / Agent", MANUAL: "Manual", ADMINISTRATIVO: "Administrativo", WEB: "Web", APP: "Aplicativo" };
export const entryStatusLabels: Record<string, string> = { VALIDO: "Válida", AJUSTADO: "Ajustada", INCONSISTENTE: "Inconsistente", EXCLUIDO_LOGICAMENTE: "Excluída" };
export const punchLabels: Record<string, string> = { MARK: "Batida", IN: "Entrada", ENTRY: "Entrada", OUT: "Saída", EXIT: "Saída", BREAK_OUT: "Saída intervalo", BREAK_IN: "Retorno intervalo" };
export const displayDate = (date: string) => date.split("-").reverse().join("/");
export function csvContent(rows: unknown[][]) {
  return "\uFEFF" + rows.map(row => row.map(value => {
    let text = value == null ? "" : String(value);
    if (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }).join(";")).join("\r\n");
}
export function downloadCsv(name: string, rows: unknown[][]) {
  const url = URL.createObjectURL(new Blob([csvContent(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export type AttendanceOptions = { employees: { id: string; name: string; registration: string; workSchedule: { name: string } | null }[]; devices: { id: string; name: string }[]; canSeeUnlinked: boolean; canManageTime: boolean; canManagePolicies: boolean; today: string };
