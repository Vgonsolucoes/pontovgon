"use client";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayDate } from "@/lib/attendance-display";
type Row = Record<string, unknown> & { id: string };
type Field = { key: string; label: string; type?: string; max?: number; options?: string[] };
const deviceFields: Field[] = [{ key: "name", label: "Nome do dispositivo", max: 120 }, { key: "serialNumber", label: "Número de série", max: 120 }, { key: "deviceUniqueId", label: "Device ID", max: 120 }, { key: "manufacturer", label: "Fabricante", max: 80 }, { key: "model", label: "Modelo", max: 80 }, { key: "location", label: "Localização", max: 160 }, { key: "enabled", label: "Equipamento habilitado para integração", type: "checkbox" }];
const holidayFields: Field[] = [{ key: "description", label: "Descrição do feriado", max: 200 }, { key: "date", label: "Data", type: "date" }, { key: "scope", label: "Abrangência", options: ["NACIONAL", "ESTADUAL", "MUNICIPAL", "EMPRESARIAL"] }, { key: "recurring", label: "Repetir anualmente na mesma data (não usar para feriados móveis)", type: "checkbox" }, { key: "active", label: "Feriado ativo na apuração", type: "checkbox" }];
function blank(device: boolean): Record<string, string | boolean> { return device ? { name: "", serialNumber: "", deviceUniqueId: "", manufacturer: "Control iD", model: "iDFace", location: "", enabled: true } : { description: "", date: "", scope: "MUNICIPAL", recurring: false, active: true }; }
export function AdminCatalog({ module }: { module: "devices" | "holidays" }) {
  const device = module === "devices", fields = device ? deviceFields : holidayFields;
  const [rows, setRows] = useState<Row[]>([]), [draft, setDraft] = useState(blank(device)), [id, setId] = useState("");
  const [year, setYear] = useState("2026"), [query, setQuery] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(""), [message, setMessage] = useState("");
  const form = useRef<HTMLFormElement>(null), generation = useRef(0);
  const load = useCallback(async () => {
    const serial = ++generation.current; setLoading(true); setError(""); setRows([]);
    try {
      const response = await fetch(`/api/people/${module}${device ? "" : "?year=" + encodeURIComponent(year)}`, { cache: "no-store" }); const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar os cadastros");
      if (serial === generation.current) setRows(result.rows);
    } catch (failure) { if (serial === generation.current) setError(failure instanceof Error ? failure.message : "Falha de conexão"); }
    finally { if (serial === generation.current) setLoading(false); }
  }, [module, device, year]);
  const cancelLoad = useCallback(() => { generation.current++; }, []);
  useEffect(() => { void load(); return cancelLoad; }, [load, cancelLoad]);
  function reset() { setId(""); setDraft(blank(device)); }
  function edit(row: Row) { const next = blank(device); for (const key of Object.keys(next)) next[key] = typeof next[key] === "boolean" ? !!row[key] : String(row[key] ?? ""); setDraft(next); setId(row.id); setMessage(""); setError(""); form.current?.scrollIntoView({ behavior: "smooth" }); }
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/people/${module}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...draft, ...(id ? { id } : {}) }) }); const result = await response.json();
      if (!response.ok) throw new Error(Object.values(result.fields || {}).join(". ") || result.error);
      reset(); await load(); setMessage(device ? "Dispositivo salvo." : "Feriado salvo. Cálculos anteriores do banco foram sinalizados para reapuração.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Falha ao salvar"); } finally { setBusy(false); }
  }
  const visible = rows.filter(row => String(row[device ? "name" : "description"]).toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")));
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">{device ? "Dispositivos" : "Feriados"}</h1><p className="mt-1 text-sm text-slate-500">{device ? "Cadastre e acompanhe os equipamentos reais integrados ao sistema." : "Calendário usado no espelho e no banco de horas. Desative um feriado para deixar de aplicá-lo, preservando o cadastro."}</p></div>
    {device ? <p className="rounded-lg border bg-white p-4 text-sm">Após cadastrar o equipamento, configure o vínculo em <Link className="text-blue-700 underline" href="/integracoes/agents">VGON PONTO Agent</Link>. IP e senha do iDFace são configurados somente no Agent local. Série e Device ID de equipamentos vinculados ou com histórico ficam protegidos contra alteração.</p> : <p className="rounded-lg border bg-white p-4 text-sm">Calendário de 2026: feriados nacionais e municipais de Contagem, sem pontos facultativos, conforme o <a className="text-blue-700 underline" href="https://legislacao.contagem.mg.gov.br/legislacao/view/29675" target="_blank" rel="noreferrer">Decreto municipal 1.829/2026</a>. As datas móveis valem apenas para 2026; não são repetidas automaticamente em outros anos.</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-4 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded bg-green-50 p-4 text-sm text-green-800">{message}</p>}
    <Card><CardHeader><CardTitle>{id ? "Editar cadastro" : device ? "Novo dispositivo" : "Novo feriado"}</CardTitle></CardHeader><CardContent><form ref={form} onSubmit={save}><fieldset disabled={busy || loading} className="grid gap-4 md:grid-cols-2">{fields.map(field => <label key={field.key} className={field.type === "checkbox" ? "flex items-center gap-2 text-sm" : "space-y-1 text-sm"}>{field.type !== "checkbox" && field.label}{field.type === "checkbox" ? <><input type="checkbox" checked={!!draft[field.key]} onChange={e => setDraft({ ...draft, [field.key]: e.target.checked })} />{field.label}</> : field.options ? <select className="h-10 w-full rounded-md border bg-white px-3" value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}>{field.options.map(option => <option key={option}>{option}</option>)}</select> : <Input type={field.type || "text"} required={field.key !== "location"} maxLength={field.max} value={String(draft[field.key])} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })} />}</label>)}<div className="flex gap-2"><Button type="submit">{busy ? "Salvando…" : "Salvar cadastro"}</Button><Button type="button" variant="outline" onClick={reset}>Cancelar / novo</Button></div></fieldset></form></CardContent></Card>
    <Card><CardHeader><CardTitle>{device ? "Equipamentos cadastrados" : "Calendário cadastrado"}</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex flex-wrap items-end gap-3"><label className="text-sm">Pesquisar<Input value={query} onChange={e => setQuery(e.target.value)} /></label>{!device && <label className="text-sm">Ano<select disabled={loading || busy} className="ml-2 h-10 rounded border bg-white px-3" value={year} onChange={e => { setYear(e.target.value); reset(); }}>{Array.from({ length: 11 }, (_, index) => String(2021+index)).map(value => <option key={value}>{value}</option>)}</select></label>}<Button disabled={loading || busy} variant="outline" onClick={() => void load()}>Atualizar</Button></div>
    {loading ? <p role="status">Carregando…</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left">{(device ? ["Equipamento", "Identificação", "Agent / comunicação", "Situação", "Ações"] : ["Data", "Feriado", "Abrangência", "Repetição", "Situação", "Ações"]).map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map(row => <tr key={row.id} className="border-b">{device ? <><td className="p-3">{String(row.name)}<p className="text-xs text-slate-500">{String(row.manufacturer)} {String(row.model)} · {String(row.location || "Local não informado")}</p></td><td className="p-3">Série: {String(row.serialNumber)}<p className="text-xs">Device ID: {String(row.deviceUniqueId || "—")}</p></td><td className="p-3">{String((row.agent as { name?: string } | null)?.name || "Sem vínculo")}<p className="text-xs text-slate-500">{row.lastCommunication ? new Date(String(row.lastCommunication)).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "Sem comunicação registrada"}</p></td><td className="p-3">{!row.enabled ? "Desabilitado" : row.online ? "Online" : "Sem comunicação recente"}</td></> : <><td className="whitespace-nowrap p-3">{displayDate(String(row.observedDate))}</td><td className="p-3">{String(row.description)}</td><td className="p-3">{String(row.scope)}</td><td className="p-3">{row.recurring ? "Anual, mesma data" : "Somente neste ano"}</td><td className="p-3">{row.active ? "Ativo" : "Inativo"}</td></>}<td className="p-3"><Button variant="outline" disabled={busy} onClick={() => edit(row)}>Editar</Button></td></tr>)}</tbody></table>{!visible.length && <p className="py-6 text-sm text-slate-500">Nenhum cadastro encontrado.</p>}</div>}
    </CardContent></Card>
  </div>;
}
