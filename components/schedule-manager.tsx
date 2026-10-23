"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { dayLoad, scheduleModels, weekdays } from "@/server/lib/work-schedules";

type Day = { weekday: number; isDayOff: boolean; entryTime: string | null; breakStartTime: string | null; breakEndTime: string | null; departureTime: string | null };
type Draft = { name: string; model: keyof typeof scheduleModels; toleranceMinutes: string; active: boolean; observations: string; days: Day[] };
type Row = Omit<Draft, "toleranceMinutes"> & { id: string; toleranceMinutes: number; weeklyLoadMinutes: number; _count: { employees: number } };
const blank = (): Draft => ({ name: "", model: "CINCOXDOIS", toleranceMinutes: "5", active: true, observations: "", days: weekdays.map((_, weekday) => ({ weekday, isDayOff: weekday === 0 || weekday === 6, entryTime: null, breakStartTime: null, breakEndTime: null, departureTime: null })) });
const duration = (value: number) => `${Math.floor(value / 60)}h${String(value % 60).padStart(2, "0")}`;
const selectClass = "h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm";

export function ScheduleManager() {
  const [rows, setRows] = useState<Row[]>([]), [draft, setDraft] = useState<Draft>(blank), [id, setId] = useState("");
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState(""), [errors, setErrors] = useState<Record<string, string>>({}), [query, setQuery] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch("/api/people/schedules", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível carregar as jornadas");
      setRows(result.rows);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Falha de conexão"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  function reset() { setDraft(blank()); setId(""); setErrors({}); }
  function changeDay(weekday: number, patch: Partial<Day>) {
    setDraft(value => ({ ...value, days: value.days.map(day => day.weekday === weekday ? { ...day, ...patch } : day) }));
    setErrors({}); setMessage("");
  }
  function edit(row: Row, clone = false) {
    const byDay = new Map(row.days.map(day => [day.weekday, day]));
    setId(clone ? "" : row.id); setErrors({}); setMessage(clone ? "Horários copiados. Altere o nome e salve para criar outra jornada." : "");
    setDraft({ name: clone ? row.name.slice(0, 110) + " (cópia)" : row.name, model: row.model, toleranceMinutes: String(row.toleranceMinutes), active: row.active, observations: row.observations || "", days: blank().days.map(day => { const saved = byDay.get(day.weekday); return saved ? { weekday: saved.weekday, isDayOff: saved.isDayOff, entryTime: saved.entryTime, breakStartTime: saved.breakStartTime, breakEndTime: saved.breakEndTime, departureTime: saved.departureTime } : day; }) });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setErrors({}); setMessage("");
    try {
      const response = await fetch("/api/people/schedules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...(id ? { id } : {}), toleranceMinutes: draft.toleranceMinutes === "" ? null : Number(draft.toleranceMinutes) }) });
      const result = await response.json();
      if (!response.ok) { setErrors(result.fields || {}); throw new Error(result.error || "Não foi possível salvar a jornada"); }
      reset(); setMessage("Jornada salva. Ela está disponível no campo Jornada do cadastro de funcionários."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de conexão"); }
    finally { setBusy(false); }
  }
  const total = draft.days.reduce((sum, day) => sum + Math.max(0, dayLoad(day)), 0);
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold">Jornadas</h1><p className="mt-1 text-sm text-slate-500">Cadastre os horários semanais e depois vincule a jornada no cadastro do funcionário.</p></div>
    {loadError && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-700">{loadError} <Button variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>}
    <Card><CardHeader><CardTitle>{id ? "Editar jornada" : "Nova jornada"}</CardTitle></CardHeader><CardContent>
      <form ref={formRef} onSubmit={save} className="space-y-5">
        <fieldset disabled={busy || loading || !!loadError} className="space-y-5 disabled:opacity-70">
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1 text-sm">Nome da jornada *<Input required maxLength={120} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="space-y-1 text-sm">Modelo<select className={selectClass} value={draft.model} onChange={e => { setDraft({ ...draft, model: e.target.value as Draft["model"] }); setErrors({}); }}><option value="CINCOXDOIS">5x2</option><option value="SEISXUM">6x1</option><option value="PERSONALIZADA">Personalizada</option><option value="DOZEXTRINTASEIS" disabled>12x36 — exige escala alternada</option></select></label>
            <label className="space-y-1 text-sm">Tolerância (minutos)<Input required type="number" min={0} max={120} step={1} value={draft.toleranceMinutes} onChange={e => setDraft({ ...draft, toleranceMinutes: e.target.value })} /></label>
          </div>
          <p className="text-sm text-slate-500">Preencha entrada e saída nos dias de trabalho. Para um turno que cruza a meia-noite, informe a saída do dia seguinte. Deixe os dois campos do intervalo vazios quando não houver intervalo. O ciclo 12x36 depende do módulo de escalas e ainda não pode ser configurado aqui.</p>
          <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Dia</th><th className="p-2">Folga</th><th className="p-2">Entrada</th><th className="p-2">Início intervalo</th><th className="p-2">Fim intervalo</th><th className="p-2">Saída</th><th className="p-2">Carga</th></tr></thead><tbody>{draft.days.map(day => <tr key={day.weekday} className="border-b"><th scope="row" className="p-2 text-left font-normal">{weekdays[day.weekday]}</th><td className="p-2"><input aria-label={`Folga ${weekdays[day.weekday]}`} type="checkbox" checked={day.isDayOff} onChange={e => changeDay(day.weekday, { isDayOff: e.target.checked })} /></td>{([['entryTime', 'Entrada'], ['breakStartTime', 'Início intervalo'], ['breakEndTime', 'Fim intervalo'], ['departureTime', 'Saída']] as const).map(([key, label]) => <td key={key} className="p-2"><Input type="time" step={60} aria-label={`${label} ${weekdays[day.weekday]}`} disabled={day.isDayOff} required={!day.isDayOff && (key === "entryTime" || key === "departureTime")} value={day[key] || ""} onChange={e => changeDay(day.weekday, { [key]: e.target.value || null })} /></td>)}<td className="p-2">{day.isDayOff ? "Folga" : duration(Math.max(0, dayLoad(day)))}</td></tr>)}</tbody></table></div>
          <p className="text-sm font-medium">Carga semanal prevista: {duration(total)}</p>
          <label className="block space-y-1 text-sm">Observações<Input maxLength={2000} value={draft.observations} onChange={e => setDraft({ ...draft, observations: e.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={e => setDraft({ ...draft, active: e.target.checked })} /> Jornada ativa para novos vínculos</label>
          {id && <p className="text-sm text-slate-500">Alterações afetam a jornada vinculada aos funcionários. Desativar impede novos vínculos e mantém os vínculos existentes.</p>}
          <div className="flex gap-2"><Button type="submit">{busy ? "Salvando…" : "Salvar jornada"}</Button><Button type="button" variant="outline" onClick={() => { reset(); setMessage(""); }}>Cancelar / nova jornada</Button></div>
        </fieldset>
        {message && <p role="status" className="text-sm">{message}</p>}
        {Object.keys(errors).length > 0 && <ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-red-700">{Object.entries(errors).map(([key, text]) => { const day = /^days\.(\d+)/.exec(key); return <li key={key}>{day ? `${weekdays[draft.days[Number(day[1])]?.weekday]}: ` : ""}{text}</li>; })}</ul>}
      </form>
    </CardContent></Card>
    <Card><CardHeader><CardTitle>Jornadas cadastradas</CardTitle></CardHeader><CardContent className="space-y-4">
      <Input aria-label="Pesquisar jornadas" placeholder="Pesquisar por nome" value={query} onChange={e => setQuery(e.target.value)} />
      {loading ? <p role="status">Carregando jornadas…</p> : !loadError && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{["Nome", "Modelo", "Carga semanal", "Tolerância", "Funcionários", "Situação", "Ações"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{rows.filter(row => row.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))).map(row => <tr key={row.id} className="border-b"><td className="p-2">{row.name}</td><td className="p-2">{scheduleModels[row.model]}</td><td className="p-2">{duration(row.weeklyLoadMinutes)}</td><td className="p-2">{row.toleranceMinutes} min</td><td className="p-2">{row._count.employees}</td><td className="p-2">{row.active ? "Ativa" : "Inativa"}</td><td className="p-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => edit(row)} aria-label={`Editar ${row.name}`}>Editar</Button><Button className="ml-2" variant="outline" size="sm" disabled={busy} onClick={() => edit(row, true)} aria-label={`Clonar ${row.name}`}>Clonar</Button></td></tr>)}</tbody></table>{!rows.length && <p className="py-4 text-sm text-slate-500">Nenhuma jornada cadastrada. Preencha os horários acima para criar a primeira.</p>}</div>}
    </CardContent></Card>
  </div>;
}
