"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AttendanceOptions, displayDate, downloadCsv, entryStatusLabels, originLabels, punchLabels } from "@/lib/attendance-display";
import { AttendancePolicyCard } from "@/components/attendance-policy-card";
type Filters = { start: string; end: string; employeeId: string; deviceId: string; origin: string; status: string };
type Row = { id: string; date: string; time: string; reviewFlags: string[]; duplicateOfId: string | null; kind: string | null; status: string; origin: string; externalEventId: string | null; deviceUserId: string | null; employee: { id: string; name: string; registration: string } | null; device: { name: string } | null };
type Result = { rows: Row[]; total: number; page: number; pageSize: number };
const selectClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";
export function TimeEntriesManager() {
  const [options, setOptions] = useState<AttendanceOptions | null>(null), [filters, setFilters] = useState<Filters>({ start: "", end: "", employeeId: "", deviceId: "", origin: "", status: "" });
  const [applied, setApplied] = useState<Filters | null>(null), [data, setData] = useState<Result | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const load = useCallback(async (value: Filters, page = 1) => {
    setBusy(true); setError(""); setData(null);
    try {
      const response = await fetch(`/api/people/time-entries?${new URLSearchParams({ ...value, page: String(page) })}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.fields || {}).join(". ") || result.error || "Não foi possível consultar as marcações");
      setData(result); setApplied(value);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha de conexão"); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const response = await fetch("/api/people/attendance-options", { cache: "no-store" }); const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Não foi possível carregar os filtros");
        if (!alive) return;
        setOptions(result);
        const initial = { start: result.today.slice(0, 7) + "-01", end: result.today, employeeId: "", deviceId: "", origin: "", status: "" };
        setFilters(initial); await load(initial);
      } catch (failure) { if (alive) { setError(failure instanceof Error ? failure.message : "Falha de conexão"); setBusy(false); } }
    })();
    return () => { alive = false; };
  }, [load]);
  function change(key: keyof Filters, value: string) { setFilters(previous => ({ ...previous, [key]: value })); }
  function submit(event: FormEvent) { event.preventDefault(); if (!busy) void load(filters); }
  function exportPage() {
    if (!data || !applied) return;
    downloadCsv(`marcacoes-${applied.start}-${applied.end}-pagina-${data.page}.csv`, [["Marcações de " + displayDate(applied.start) + " a " + displayDate(applied.end), "Horário de Brasília"], ["Data", "Hora", "Funcionário", "Matrícula", "Origem", "Equipamento", "Tipo informado", "Situação", "Evento", "ID sem vínculo no equipamento"], ...data.rows.map(row => [displayDate(row.date), row.time, row.employee?.name ?? "Sem vínculo", row.employee?.registration, originLabels[row.origin], row.device?.name, punchLabels[row.kind ?? ""] || row.kind || "Não informado", entryStatusLabels[row.status], row.externalEventId, row.deviceUserId])]);
  }
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Marcações</h1><p className="mt-1 text-sm text-slate-500">Registros reais recebidos pelo sistema. Datas e horários em Brasília.</p></div>
    <Card><CardHeader><CardTitle>Consultar marcações</CardTitle></CardHeader><CardContent><form onSubmit={submit}>
      <fieldset disabled={busy || !options} className="grid gap-4 md:grid-cols-3 disabled:opacity-70">
        <label className="space-y-1 text-sm">Data inicial<Input type="date" required value={filters.start} onChange={e => change("start", e.target.value)} /></label>
        <label className="space-y-1 text-sm">Data final<Input type="date" required value={filters.end} onChange={e => change("end", e.target.value)} /></label>
        <label className="space-y-1 text-sm">Funcionário<select className={selectClass} value={filters.employeeId} onChange={e => change("employeeId", e.target.value)}><option value="">Todos os permitidos</option>{options?.canSeeUnlinked && <option value="unlinked">Sem vínculo com funcionário</option>}{options?.employees.map(employee => <option key={employee.id} value={employee.id}>{employee.name} · {employee.registration}</option>)}</select></label>
        <label className="space-y-1 text-sm">Equipamento<select className={selectClass} value={filters.deviceId} onChange={e => change("deviceId", e.target.value)}><option value="">Todos</option>{options?.devices.map(device => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
        <label className="space-y-1 text-sm">Origem<select className={selectClass} value={filters.origin} onChange={e => change("origin", e.target.value)}><option value="">Todas</option>{Object.entries(originLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm">Situação<select className={selectClass} value={filters.status} onChange={e => change("status", e.target.value)}><option value="">Todas</option>{Object.entries(entryStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <div><Button type="submit">{busy ? "Consultando…" : "Consultar / atualizar"}</Button></div>
      </fieldset>
      <p className="mt-3 text-xs text-slate-500">Consulte até 62 dias por vez. Os registros originais são preservados; esta tela não cria nem altera batidas.</p>
    </form></CardContent></Card>
    {error && <div role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}{!options && <Button variant="outline" onClick={() => window.location.reload()}>Tentar novamente</Button>}</div>}
    {busy && <p role="status">Carregando marcações…</p>}
    {data && applied && <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Marcações encontradas: {data.total}</CardTitle><Button variant="outline" onClick={exportPage} disabled={!data.rows.length}>Exportar página CSV</Button></div><p className="text-sm text-slate-500">Período consultado: {displayDate(applied.start)} a {displayDate(applied.end)}.</p></CardHeader><CardContent>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{["Data / hora", "Funcionário", "Origem / equipamento", "Tipo informado", "Situação", "Evento"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr className="border-b" key={row.id}>
        <td className="whitespace-nowrap p-3">{displayDate(row.date)}<br /><strong>{row.time}</strong></td>
        <td className="p-3">{row.employee ? <><Link className="text-blue-700 underline" href={`/ponto/espelho?employeeId=${row.employee.id}&month=${row.date.slice(0, 7)}`}>{row.employee.name}</Link><p className="text-xs text-slate-500">Matrícula {row.employee.registration}</p></> : <><span className="font-medium text-amber-800">Sem vínculo</span><p className="text-xs text-slate-500">{row.deviceUserId ? `ID no equipamento: ${row.deviceUserId}` : "Conferir vínculo no equipamento"}</p></>}</td>
        <td className="p-3">{originLabels[row.origin] || row.origin}<p className="text-xs text-slate-500">{row.device?.name || "Sem equipamento"}</p></td><td className="p-3">{punchLabels[row.kind ?? ""] || row.kind || "Não informado"}</td><td className="p-3">{entryStatusLabels[row.status] || row.status}{row.reviewFlags.map(flag => <p key={flag} className="mt-1 text-xs text-amber-800">{({ DUPLICATE: "Repetida — não conta na apuração", OUTSIDE_WINDOW: "Fora da janela / conferir jornada", UNLINKED: "Sem funcionário vinculado" } as Record<string, string>)[flag] || flag}</p>)}</td><td className="max-w-40 break-all p-3 text-xs text-slate-500">{row.externalEventId || "—"}</td>
      </tr>)}</tbody></table></div>
      {!data.rows.length && <p className="py-6 text-sm text-slate-500">Nenhuma marcação encontrada para os filtros consultados.</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"><span>Página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))} · até {data.pageSize} registros por página</span><div className="flex gap-2"><Button variant="outline" disabled={busy || data.page <= 1} onClick={() => void load(applied, data.page - 1)}>Anterior</Button><Button variant="outline" disabled={busy || data.page * data.pageSize >= data.total} onClick={() => void load(applied, data.page + 1)}>Próxima</Button></div></div>
    </CardContent></Card>}
    {options?.canManagePolicies && <AttendancePolicyCard />}
  </div>;
}
