"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttendanceSelection } from "@/components/attendance-selection";
import { useAttendanceSelection } from "@/components/use-attendance-selection";
import { displayDate, downloadCsv } from "@/lib/attendance-display";
import { formatMinutes, formatMinutesSigned } from "@/lib/utils";
import type { bankLedger } from "@/server/lib/hour-bank";
type Result = ReturnType<typeof bankLedger> & { employee: { name: string; registration: string }; start: string; end: string; generatedAt: string };
const origins: Record<string, string> = { DAILY_CALC: "Apuração diária", MANUAL_ADJUST: "Movimentação manual", REVERSAL: "Estorno", REQUEST_APPROVED: "Ajuste aprovado" };
export function HourBankManager() {
  const selection = useAttendanceSelection(), { options, employeeId, month, optionError } = selection;
  const [data, setData] = useState<Result | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [refresh, setRefresh] = useState(0);
  const [manual, setManual] = useState({ date: "", direction: "credit", hours: "0", minutes: "0", reason: "" });
  const [reverse, setReverse] = useState<{ id: string; reason: string } | null>(null);
  const submissionKey = useRef("");
  useEffect(() => {
    setData(null); setReverse(null); setError("");
    if (!employeeId || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return;
    const controller = new AbortController(); setBusy(true);
    void (async () => { try {
      const response = await fetch(`/api/people/hour-bank?${new URLSearchParams({ employeeId, month })}`, { cache: "no-store", signal: controller.signal }); const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.fields || {}).join(". ") || result.error);
      if (!controller.signal.aborted) setData(result);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Falha de conexão"); } finally { if (!controller.signal.aborted) setBusy(false); } })();
    return () => controller.abort();
  }, [employeeId, month, refresh]);
  useEffect(() => { submissionKey.current = ""; setManual({ date: options?.today.startsWith(month) ? options.today : month ? month + "-01" : "", direction: "credit", hours: "0", minutes: "0", reason: "" }); setMessage(""); }, [employeeId, month, options]);
  function changeManual(key: keyof typeof manual, value: string) { submissionKey.current = ""; setManual(previous => ({ ...previous, [key]: value })); }
  async function send(payload: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/people/hour-bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.fields || {}).join(". ") || result.error);
      setMessage(result.message); setReverse(null); submissionKey.current = ""; setManual(previous => ({ ...previous, hours: "0", minutes: "0", reason: "" })); setRefresh(previous => previous + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha de conexão"); } finally { setBusy(false); }
  }
  function submitManual(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    if (!submissionKey.current) submissionKey.current = crypto.randomUUID();
    void send({ operation: "manual", employeeId, date: manual.date, minutes: (Number(manual.hours) * 60 + Number(manual.minutes)) * (manual.direction === "credit" ? 1 : -1), reason: manual.reason, submissionKey: submissionKey.current });
  }
  function exportCsv() {
    if (!data) return;
    downloadCsv(`banco-horas-${data.employee.registration.replace(/[^a-zA-Z0-9_-]/g, "_")}-${data.start.slice(0, 7)}.csv`, [["Banco de horas", data.employee.name, "Matrícula", data.employee.registration], ["Período", displayDate(data.start), displayDate(data.end)], ["Saldo anterior", formatMinutesSigned(data.openingBalance)], ["Data", "Origem", "Movimentação", "Saldo acumulado", "Justificativa", "Reapuração pendente"], ...data.rows.map(row => [displayDate(row.date), origins[row.origin] || row.origin, formatMinutesSigned(row.deltaMinutes), formatMinutesSigned(row.balanceMinutes), row.note, row.needsRecalculation ? "Sim" : "Não"]), ["Saldo no fim do mês", formatMinutesSigned(data.closingBalance)]]);
  }
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Banco de Horas</h1><p className="mt-1 text-sm text-slate-500">Extrato de créditos, débitos, apurações diárias e estornos.</p></div>
    <Card className="no-print"><CardContent className="pt-6"><AttendanceSelection {...selection} disabled={busy} /><div className="mt-4 flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !employeeId} onClick={() => setRefresh(value => value + 1)}>Atualizar extrato</Button>{options?.canManageTime && <Button disabled={busy || !data} onClick={() => void send({ operation: "calculate", employeeId, month })}>Apurar mês selecionado</Button>}</div>{options?.canManageTime && <p className="mt-3 text-xs text-slate-500">A apuração usa a jornada atual e os dias encerrados do espelho; dias previstos sem batidas geram débito. Confira jornada e ausências antes de apurar. Batidas incompletas ou inconsistentes ficam pendentes. Reapurar substitui o cálculo diário anterior, sem somar outra vez.</p>}</CardContent></Card>
    {(error || optionError) && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error || optionError}</p>}{message && <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {!options && !optionError && <p role="status">Carregando funcionários…</p>}{busy && <p role="status">Aguarde…</p>}
    {options && !options.employees.length && <p>Nenhum funcionário disponível para sua conta. Confira o vínculo do usuário com o funcionário.</p>}
    {data && <>
      <Card><CardHeader><div className="flex flex-wrap justify-between gap-3"><div><CardTitle>{data.employee.name}</CardTitle><p className="mt-2 text-sm text-slate-500">Matrícula {data.employee.registration} · {displayDate(data.start)} a {displayDate(data.end)}</p></div><div className="no-print flex gap-2"><Button variant="outline" onClick={exportCsv}>Exportar CSV</Button><Button variant="outline" onClick={() => window.print()}>Imprimir / PDF</Button></div></div></CardHeader><CardContent><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Saldo anterior", formatMinutesSigned(data.openingBalance)], ["Créditos no mês", formatMinutes(data.creditMinutes)], ["Débitos no mês", formatMinutes(Math.abs(data.debitMinutes))], ["Saldo no fim do mês", formatMinutesSigned(data.closingBalance)]].map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></div>)}</div>{data.pendingRecalculation > 0 && <p role="status" className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">{data.pendingRecalculation} lançamento(s) aguardando reapuração após alteração de batidas ou jornada. O saldo contabilizado ainda inclui esses valores; confira e reapure os meses afetados.</p>}</CardContent></Card>
      {options?.canManageTime && <Card className="no-print"><CardHeader><CardTitle>Movimentação manual justificada</CardTitle></CardHeader><CardContent><form onSubmit={submitManual}><fieldset disabled={busy} className="space-y-4"><div className="grid gap-4 md:grid-cols-4"><label className="space-y-1 text-sm">Data<Input type="date" required max={options.today} value={manual.date} onChange={e => changeManual("date", e.target.value)} /></label><label className="space-y-1 text-sm">Tipo<select className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={manual.direction} onChange={e => changeManual("direction", e.target.value)}><option value="credit">Crédito</option><option value="debit">Débito</option></select></label><label className="space-y-1 text-sm">Horas<Input type="number" required min={0} max={744} step={1} value={manual.hours} onChange={e => changeManual("hours", e.target.value)} /></label><label className="space-y-1 text-sm">Minutos<Input type="number" required min={0} max={59} step={1} value={manual.minutes} onChange={e => changeManual("minutes", e.target.value)} /></label></div><label className="block space-y-1 text-sm">Justificativa<textarea className="min-h-24 w-full rounded-md border p-3 text-sm" required minLength={10} maxLength={2000} value={manual.reason} onChange={e => changeManual("reason", e.target.value)} /></label><Button type="submit">Registrar movimentação</Button></fieldset></form></CardContent></Card>}
      {reverse && <Card className="no-print"><CardHeader><CardTitle>Estornar movimentação manual</CardTitle></CardHeader><CardContent><p className="mb-3 text-sm">O estorno cria uma movimentação inversa na data de hoje e preserva o lançamento original.</p><form onSubmit={event => { event.preventDefault(); if (!busy) void send({ operation: "reverse", ...reverse }); }}><fieldset disabled={busy} className="space-y-3"><label className="block space-y-1 text-sm">Motivo do estorno<textarea className="min-h-24 w-full rounded-md border p-3 text-sm" required minLength={10} maxLength={2000} value={reverse.reason} onChange={e => setReverse({ ...reverse, reason: e.target.value })} /></label><div className="flex gap-2"><Button type="submit">Confirmar estorno</Button><Button type="button" variant="outline" onClick={() => setReverse(null)}>Cancelar</Button></div></fieldset></form></CardContent></Card>}
      <Card><CardHeader><CardTitle>Movimentações do mês</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{["Data", "Origem", "Movimentação", "Saldo acumulado", "Justificativa", "Ações"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className="border-b"><td className="whitespace-nowrap p-3">{displayDate(row.date)}</td><td className="p-3">{origins[row.origin] || row.origin}{row.needsRecalculation && <p className="text-xs text-amber-800">Reapuração pendente</p>}</td><td className="p-3">{formatMinutesSigned(row.deltaMinutes)}</td><td className="p-3">{formatMinutesSigned(row.balanceMinutes)}</td><td className="max-w-md break-words p-3">{row.note || "—"}</td><td className="no-print p-3">{options?.canManageTime && row.origin === "MANUAL_ADJUST" && !data.rows.some(item => item.reversalOfId === row.id) && <Button disabled={busy} variant="outline" onClick={() => setReverse({ id: row.id, reason: "" })}>Estornar</Button>}</td></tr>)}</tbody></table></div>{!data.rows.length && <p className="py-6 text-sm text-slate-500">Nenhuma movimentação contabilizada neste mês. O saldo anterior, quando existente, é mantido.</p>}</CardContent></Card>
    </>}
    {options && options.employees.length > 0 && !employeeId && <p className="text-sm text-slate-500">Selecione um funcionário para consultar o banco de horas.</p>}
  </div>;
}
