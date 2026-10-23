"use client";
import { FormEvent, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AttendanceSelection } from "@/components/attendance-selection";
import { useAttendanceSelection } from "@/components/use-attendance-selection";
import { displayDate } from "@/lib/attendance-display";
const selectClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";
const labels: Record<string, string> = { INSERT: "Incluir batida", REPLACE: "Corrigir batida", EXCLUDE: "Desconsiderar batida" };
type Entry = { id: string; date: string; time: string; origin: string; status: string };
type RequestRow = { id: string; date: string; time: string | null; type: string; justification: string | null; status: string; evaluatorNote: string | null; createdBy: { name: string }; evaluatedBy: { name: string } | null };
type Result = { entries: Entry[]; requests: RequestRow[] };
export function AdjustmentsManager() {
  const selection = useAttendanceSelection(), { options, employeeId, month, optionError } = selection;
  const [data, setData] = useState<Result | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState(""), [refresh, setRefresh] = useState(0);
  const [draft, setDraft] = useState({ type: "INSERT", date: "", time: "", targetEntryId: "", justification: "" });
  const [review, setReview] = useState<{ id: string; decision: "APPROVE" | "REJECT"; note: string } | null>(null);
  useEffect(() => {
    setData(null); setReview(null); setError("");
    if (!employeeId || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return;
    const controller = new AbortController(); setBusy(true);
    void (async () => { try {
      const response = await fetch(`/api/people/adjustments?${new URLSearchParams({ employeeId, month })}`, { cache: "no-store", signal: controller.signal }); const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.fields || {}).join(". ") || result.error);
      if (!controller.signal.aborted) setData(result);
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "Falha de conexão"); } finally { if (!controller.signal.aborted) setBusy(false); } })();
    return () => controller.abort();
  }, [employeeId, month, refresh]);
  useEffect(() => { setDraft({ type: "INSERT", date: options?.today.startsWith(month) ? options.today : month ? month + "-01" : "", time: "", targetEntryId: "", justification: "" }); setMessage(""); }, [employeeId, month, options]);
  async function send(payload: unknown) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/people/adjustments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.fields || {}).join(". ") || result.error);
      setMessage(result.message); setReview(null); setDraft(previous => ({ ...previous, targetEntryId: "", time: "", justification: "", type: "INSERT" })); setRefresh(previous => previous + 1);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha de conexão"); } finally { setBusy(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); if (!busy) void send({ ...draft, operation: "request", employeeId, targetEntryId: draft.targetEntryId || null, time: draft.time || null }); }
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Ajustes de ponto</h1><p className="mt-1 text-sm text-slate-500">Solicite inclusão, correção ou desconsideração de batidas, sempre com justificativa. Originais e decisões ficam registrados.</p></div>
    <Card><CardContent className="pt-6"><AttendanceSelection {...selection} disabled={busy} /><Button className="mt-4" variant="outline" disabled={busy || !employeeId} onClick={() => setRefresh(value => value + 1)}>Atualizar solicitações</Button></CardContent></Card>
    {(error || optionError) && <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error || optionError}</p>}{message && <p role="status" className="rounded-lg bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    {!options && !optionError && <p role="status">Carregando funcionários…</p>}{busy && <p role="status">Aguarde…</p>}
    {options && !options.employees.length && <p>Nenhum funcionário disponível para sua conta. Confira o vínculo do usuário com o funcionário.</p>}
    {data && <>
      <Card><CardHeader><CardTitle>Nova solicitação</CardTitle></CardHeader><CardContent><form onSubmit={submit}><fieldset disabled={busy} className="space-y-4"><div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">Operação<select className={selectClass} value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value, targetEntryId: "", time: "" })}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        {draft.type !== "INSERT" && <label className="space-y-1 text-sm">Batida original<select className={selectClass} required value={draft.targetEntryId} onChange={e => { const entry = data.entries.find(row => row.id === e.target.value); setDraft({ ...draft, targetEntryId: e.target.value, ...(entry ? { date: entry.date, time: entry.time } : {}) }); }}><option value="">Selecione a batida</option>{data.entries.map(entry => <option key={entry.id} value={entry.id}>{displayDate(entry.date)} {entry.time} · {entry.origin} · {entry.status}</option>)}</select></label>}
        <label className="space-y-1 text-sm">Data da batida<Input required type="date" disabled={draft.type === "EXCLUDE"} value={draft.date} max={options?.today} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
        <label className="space-y-1 text-sm">{draft.type === "REPLACE" ? "Novo horário" : "Horário"}<Input type="time" step={60} required={draft.type !== "EXCLUDE"} disabled={draft.type === "EXCLUDE"} value={draft.time} onChange={e => setDraft({ ...draft, time: e.target.value })} /></label>
      </div><label className="block space-y-1 text-sm">Justificativa<textarea className="min-h-24 w-full rounded-md border p-3 text-sm" required minLength={10} maxLength={2000} value={draft.justification} onChange={e => setDraft({ ...draft, justification: e.target.value })} /></label><p className="text-xs text-slate-500">Inclusões e correções devem respeitar a janela da jornada e o intervalo de duplicidade. A solicitação precisa ser aprovada por RH ou administração para alterar o espelho.</p><Button type="submit">Enviar solicitação</Button></fieldset></form></CardContent></Card>
      {review && <Card><CardHeader><CardTitle>Avaliar solicitação</CardTitle></CardHeader><CardContent><p className="mb-4 text-sm">{data.requests.find(row => row.id === review.id)?.justification}</p><form onSubmit={event => { event.preventDefault(); if (!busy) void send({ ...review, operation: "review" }); }}><fieldset disabled={busy} className="space-y-4"><label className="block space-y-1 text-sm">Decisão<select className={selectClass} value={review.decision} onChange={event => setReview({ ...review, decision: event.target.value as "APPROVE" | "REJECT" })}><option value="APPROVE">Aprovar</option><option value="REJECT">Rejeitar</option></select></label><label className="block space-y-1 text-sm">Parecer {review.decision === "REJECT" ? "(obrigatório)" : "(opcional)"}<textarea className="min-h-24 w-full rounded-md border p-3 text-sm" required={review.decision === "REJECT"} minLength={review.decision === "REJECT" ? 10 : undefined} maxLength={2000} value={review.note} onChange={event => setReview({ ...review, note: event.target.value })} /></label><div className="flex gap-2"><Button type="submit">{review.decision === "APPROVE" ? "Confirmar aprovação" : "Confirmar rejeição"}</Button><Button type="button" variant="outline" onClick={() => setReview(null)}>Cancelar avaliação</Button></div></fieldset></form></CardContent></Card>}
      <Card><CardHeader><CardTitle>Histórico de solicitações</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{["Data / horário", "Operação", "Justificativa / solicitante", "Situação / avaliação", "Ações"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{data.requests.map(row => <tr key={row.id} className="border-b"><td className="whitespace-nowrap p-3">{displayDate(row.date.slice(0, 10))}<br />{row.time || "—"}</td><td className="p-3">{labels[row.type] || row.type}</td><td className="max-w-md break-words p-3">{row.justification}<p className="mt-1 text-xs text-slate-500">{row.createdBy.name}</p></td><td className="max-w-md break-words p-3">{row.status}<p className="mt-1 text-xs text-slate-500">{row.evaluatedBy?.name}{row.evaluatorNote ? ` · ${row.evaluatorNote}` : ""}</p></td><td className="p-3">{row.status === "PENDENTE" && options?.canManageTime && <Button variant="outline" disabled={busy} onClick={() => setReview({ id: row.id, decision: "APPROVE", note: "" })}>Avaliar</Button>}</td></tr>)}</tbody></table></div>{!data.requests.length && <p className="py-6 text-sm text-slate-500">Nenhuma solicitação neste mês.</p>}</CardContent></Card>
    </>}
    {options && options.employees.length > 0 && !employeeId && <p className="text-sm text-slate-500">Selecione um funcionário para consultar e solicitar ajustes.</p>}
  </div>;
}
