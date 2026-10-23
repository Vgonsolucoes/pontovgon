"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AttendanceOptions, displayDate, downloadCsv } from "@/lib/attendance-display";
import { formatMinutes, formatMinutesSigned } from "@/lib/utils";
import type { buildSheet } from "@/server/lib/attendance";
import { printTimeSheet } from "@/lib/print-time-sheet";
type Report = ReturnType<typeof buildSheet> & { employee: { id: string; name: string; registration: string; department: string | null; schedule: string | null } };
const weekdayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export function TimeSheetManager() {
  const [options, setOptions] = useState<AttendanceOptions | null>(null), [employeeId, setEmployeeId] = useState(""), [month, setMonth] = useState("");
  const [report, setReport] = useState<Report | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const load = useCallback(async (employee: string, selectedMonth: string) => {
    setBusy(true); setError(""); setReport(null);
    try {
      const response = await fetch(`/api/people/time-sheet?${new URLSearchParams({ employeeId: employee, month: selectedMonth })}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.fields || {}).join(". ") || result.error || "Não foi possível gerar o espelho");
      setReport(result);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha de conexão"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/people/attendance-options", { cache: "no-store" }); const result: AttendanceOptions & { error?: string } = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os funcionários");
        if (!alive) return;
        setOptions(result);
        const query = new URLSearchParams(window.location.search);
        const selected = result.employees.find(employee => employee.id === query.get("employeeId"))?.id || (result.employees.length === 1 ? result.employees[0].id : "");
        const selectedMonth = /^20\d{2}-(0[1-9]|1[0-2])$/.test(query.get("month") || "") ? query.get("month")! : result.today.slice(0, 7);
        setEmployeeId(selected); setMonth(selectedMonth);
        if (selected) await load(selected, selectedMonth); else setBusy(false);
      } catch (failure) { if (alive) { setError(failure instanceof Error ? failure.message : "Falha de conexão"); setBusy(false); } }
    })();
    return () => { alive = false; };
  }, [load]);
  function submit(event: FormEvent) { event.preventDefault(); if (!busy && employeeId) void load(employeeId, month); }
  function exportReport() {
    if (!report) return;
    downloadCsv(`espelho-${report.employee.registration.replace(/[^a-zA-Z0-9_-]/g, "_")}-${report.start.slice(0, 7)}.csv`, [
      ["Espelho de ponto — conferência", report.employee.name, "Matrícula", report.employee.registration],
      ["Período", displayDate(report.start), displayDate(report.end), "Jornada atual", report.employee.schedule || "Sem jornada"],
      ["Horário de Brasília", "Gerado em", report.generatedAt],
      ["Data", "Dia", "Batidas", "Previstas", "Trabalhadas (pares completos)", "Saldo diário", "Situação", "Observações"],
      ...report.rows.map(row => [displayDate(row.date), weekdayLabels[row.weekday], row.punches.map(punch => punch.time + (punch.nextDay ? " (+1 dia)" : "")).join(" / "), formatMinutes(row.expectedMinutes), formatMinutes(row.workedMinutes), formatMinutesSigned(row.balanceMinutes), row.status, row.notes.join("; ")]),
      ["Totais", "", "", formatMinutes(report.totals.expectedMinutes), formatMinutes(report.totals.workedMinutes), formatMinutesSigned(report.totals.balanceMinutes)], ["Regras", report.rules],
    ]);
  }
  return <div className="attendance-report space-y-6">
    <div><h1 className="text-2xl font-bold">Espelho de Ponto</h1><p className="mt-1 text-sm text-slate-500">Conferência mensal das marcações reais e da jornada vinculada ao funcionário.</p></div>
    <Card className="no-print"><CardHeader><CardTitle>Consultar espelho mensal</CardTitle></CardHeader><CardContent><form onSubmit={submit}><fieldset disabled={busy || !options} className="grid gap-4 md:grid-cols-3 disabled:opacity-70">
      <label className="space-y-1 text-sm">Funcionário<select required className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm" value={employeeId} onChange={e => setEmployeeId(e.target.value)}><option value="">Selecione o funcionário</option>{options?.employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.registration}</option>)}</select></label>
      <label className="space-y-1 text-sm">Mês de referência<Input required type="month" min="2000-01" max="2099-12" value={month} onChange={e => setMonth(e.target.value)} /></label>
      <div className="self-end"><Button type="submit" disabled={!employeeId}>{busy ? "Gerando…" : "Gerar / atualizar espelho"}</Button></div>
    </fieldset></form></CardContent></Card>
    {error && <div role="alert" className="no-print rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}{!options && <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>}</div>}
    {busy && <p role="status">Carregando espelho…</p>}
    {options && !options.employees.length && <p className="rounded-lg border bg-white p-5 text-sm">Nenhum funcionário disponível para sua conta. Confira o cadastro e o vínculo do usuário com o funcionário.</p>}
    {options && options.employees.length > 0 && !report && !busy && !error && <p className="text-sm text-slate-500">Selecione o funcionário e o mês para consultar o espelho.</p>}
    {report && <>
      <Card><CardHeader><div className="flex flex-wrap justify-between gap-3"><div><CardTitle>{report.employee.name}</CardTitle><p className="mt-2 text-sm text-slate-500">Matrícula {report.employee.registration} · {displayDate(report.start)} a {displayDate(report.end)}</p></div><div className="no-print flex gap-2"><Button variant="outline" onClick={exportReport}>Exportar CSV</Button><Button variant="outline" onClick={() => void printTimeSheet(report).catch(failure => setError(failure instanceof Error ? failure.message : "Falha ao imprimir"))}>Imprimir / PDF</Button></div></div></CardHeader><CardContent><p className="text-sm">Setor: {report.employee.department || "Não informado"} · Jornada: {report.employee.schedule || "Não vinculada"}</p><p className="mt-1 text-xs text-slate-500">Horário de Brasília · Gerado em {new Date(report.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
        {!report.employee.schedule && <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">Vincule uma jornada no cadastro do funcionário para calcular horas previstas e saldo. As marcações existentes continuam visíveis.</p>}
      </CardContent></Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["Previstas no mês", formatMinutes(report.totals.expectedMinutes)], ["Trabalhadas (dias com pares completos)", formatMinutes(report.totals.workedMinutes)], ["Saldo dos dias encerrados", formatMinutesSigned(report.totals.balanceMinutes)], ["Dias encerrados pendentes de apuração", String(report.totals.pendingDays)]].map(([label, value]) => <Card key={label}><CardContent className="pt-5"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></CardContent></Card>)}</div>
      <Card><CardHeader><CardTitle>Batidas e apuração diária</CardTitle></CardHeader><CardContent><div className="overflow-x-auto print:overflow-visible"><table className="w-full text-sm"><thead><tr className="border-b text-left">{["Data", "Batidas", "Previstas", "Trabalhadas", "Saldo", "Situação / observações"].map(label => <th className="p-2" key={label}>{label}</th>)}</tr></thead><tbody>{report.rows.map(row => <tr key={row.date} className={`border-b ${row.status === "Folga" || row.status === "Feriado" ? "bg-slate-50" : ""}`}><td className="whitespace-nowrap p-2">{displayDate(row.date)}<p className="text-xs text-slate-500">{weekdayLabels[row.weekday]}</p></td><td className="p-2"><div className="flex max-w-sm flex-wrap gap-1">{row.punches.length ? row.punches.map(punch => <span key={punch.id} className="rounded bg-slate-100 px-2 py-1 text-xs" title={punch.origin}>{punch.time}{punch.nextDay ? " (+1)" : ""}</span>) : "—"}</div></td><td className="p-2">{formatMinutes(row.expectedMinutes)}</td><td className="p-2">{formatMinutes(row.workedMinutes)}</td><td className={`p-2 ${row.balanceMinutes && row.balanceMinutes < 0 ? "text-red-700" : ""}`}>{formatMinutesSigned(row.balanceMinutes)}</td><td className="p-2"><span className="font-medium">{row.status}</span>{row.notes.map(note => <p key={note} className="mt-1 max-w-xs text-xs text-slate-500">{note}</p>)}</td></tr>)}</tbody></table></div>
        <div className="mt-4 space-y-2 text-xs text-slate-500"><p>{report.totals.punches} marcações utilizadas. Registros excluídos ficam fora do cálculo. “(+1)” indica batida no dia seguinte. “--:--” indica valor não apurado.</p><p>{report.rules}</p>{report.totals.pendingDays > 0 && <p>O saldo total fica indisponível enquanto houver dias encerrados sem apuração. Dias atuais e futuros não geram débito automático.</p>}</div>
      </CardContent></Card>
    </>}
  </div>;
}
