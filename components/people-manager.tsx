"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = Record<string, string | boolean | null> & { id: string; name: string };
type Option = { id: string; name: string; active?: boolean; registration?: string; departmentId?: string | null };
type Payload = { rows: Row[]; options: Record<string, Option[]>; canWrite: boolean; actor: { id: string; role: string } };
const roleLabels: Record<string, string> = { MASTER: "Master", ADMIN: "Administrador", RH: "Recursos Humanos", GESTOR: "Gestor", FUNCIONARIO: "Funcionário" };
const statusLabels: Record<string, string> = { ATIVO: "Ativo", FERIAS: "Férias", AFASTADO: "Afastado", DESLIGADO: "Desligado" };
const selectClass = "flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
function blank(users: boolean): Record<string, string | boolean | null> {
  return users ? { name: "", email: "", password: "", role: "FUNCIONARIO", active: true, employeeId: "" } : { name: "", cpf: "", registration: "", email: "", phone: "", departmentId: "", positionId: "", workScheduleId: "", managerId: "", admissionDate: "", status: "ATIVO", externalIdDevice: "", observations: "" };
}
export function PeopleManager({ module }: { module: "users" | "employees" }) {
  const users = module === "users", title = users ? "Usuários" : "Funcionários";
  const [data, setData] = useState<Payload | null>(null);
  const [draft, setDraft] = useState(blank(users));
  const [id, setId] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    setLoading(true); setLoadError("");
    try {
      const response = await fetch(`/api/people/${module}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Não foi possível consultar os cadastros");
      setData(result);
    } catch (error) { setLoadError(error instanceof Error ? error.message : "Falha de conexão"); }
    finally { setLoading(false); }
  }, [module]);
  useEffect(() => { void load(); }, [load]);
  function reset() { setId(""); setDraft(blank(users)); setErrors({}); }
  function change(key: string, value: string | boolean) {
    setDraft(previous => ({ ...previous, [key]: value, ...(key === "departmentId" ? { positionId: "" } : {}) }));
    setErrors(previous => ({ ...previous, [key]: "" }));
  }
  function edit(row: Row) {
    setId(row.id); setMessage(""); setErrors({});
    const values = blank(users);
    for (const key of Object.keys(values)) if (key !== "password") values[key] = row[key] ?? "";
    if (!users && typeof values.admissionDate === "string") values.admissionDate = values.admissionDate.slice(0, 10);
    setDraft(values);
    document.getElementById("people-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(""); setErrors({});
    const body: Record<string, string | boolean | null> = { ...draft, ...(id ? { id } : {}) };
    for (const key of ["employeeId", "departmentId", "positionId", "workScheduleId", "managerId"]) if (key in body && !body[key]) body[key] = null;
    try {
      const response = await fetch(`/api/people/${module}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) { setErrors(result.fields || {}); throw new Error(result.error || "Não foi possível salvar"); }
      reset(); setMessage(users ? "Usuário salvo com sucesso." : "Funcionário salvo com sucesso."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha de conexão ao salvar. Tente novamente."); }
    finally { setBusy(false); }
  }
  function field(key: string, label: string, required = false, type = "text", maxLength = 160) {
    return <div key={key} className="space-y-1"><label htmlFor={`people-${key}`} className="text-sm font-medium">{label}{required ? " *" : ""}</label><Input id={`people-${key}`} name={key} type={type} required={required} maxLength={maxLength} value={String(draft[key] ?? "")} autoComplete={key === "password" ? "new-password" : undefined} minLength={key === "password" ? 8 : undefined} aria-invalid={!!errors[key]} aria-describedby={errors[key] ? `error-${key}` : undefined} onChange={event => change(key, event.target.value)} />{errors[key] && <p id={`error-${key}`} className="text-sm text-red-700">{errors[key]}</p>}</div>;
  }
  function select(key: string, label: string, choices: Array<{ id: string; name: string; disabled?: boolean }>, optional = true, disabled = false) {
    return <div key={key} className="space-y-1"><label htmlFor={`people-${key}`} className="text-sm font-medium">{label}</label><select id={`people-${key}`} name={key} className={selectClass} value={String(draft[key] ?? "")} disabled={disabled} onChange={event => change(key, event.target.value)}>{optional && <option value="">Não informado</option>}{choices.map(option => <option key={option.id} value={option.id} disabled={option.disabled}>{option.name}</option>)}</select>{errors[key] && <p className="text-sm text-red-700">{errors[key]}</p>}</div>;
  }
  function options(key: string, fieldKey: string) {
    return (data?.options[key] ?? []).filter(option => option.id !== (fieldKey === "managerId" ? id : "")).map(option => ({ id: option.id, name: `${option.name}${option.registration ? ` · ${option.registration}` : ""}${option.active === false ? " (inativo)" : ""}`, disabled: option.active === false && draft[fieldKey] !== option.id }));
  }
  const visible = data?.rows.filter(row => [row.name, row.email, row.registration].some(value => typeof value === "string" && value.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")))) ?? [];
  const editingSelf = data?.actor.id === id;
  const editable = (row: Row) => !users || data?.actor.role === "MASTER" || !["MASTER", "ADMIN"].includes(String(row.role)) || row.id === data?.actor.id;
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-slate-900">{title}</h1><p className="mt-1 text-sm text-slate-500">{users ? "Cadastre contas de acesso, escolha o perfil e vincule o funcionário." : "Cadastre colaboradores e vincule setor, cargo, jornada e ID no iDFace."}</p></div>
    {message && <p role="status" className="rounded-lg border bg-white p-3 text-sm">{message}</p>}
    {loadError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">{loadError} <Button type="button" variant="outline" onClick={() => void load()}>Tentar novamente</Button></div>}
    {loading && !data && <p role="status">Carregando cadastros…</p>}
    {data?.canWrite && <Card id="people-form"><CardHeader><CardTitle>{id ? (users ? "Editar usuário" : "Editar funcionário") : (users ? "Novo usuário" : "Novo funcionário")}</CardTitle></CardHeader><CardContent>
      <form onSubmit={save} className="space-y-5"><fieldset disabled={busy} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {field("name", "Nome completo", true)}
        {users ? <>
          {field("email", "E-mail", true, "email")}
          {field("password", id ? "Nova senha (deixe em branco para manter)" : "Senha", !id, "password", 72)}
          {select("role", "Perfil", Object.entries(roleLabels).filter(([key]) => data.actor.role === "MASTER" || !["MASTER", "ADMIN"].includes(key) || (editingSelf && key === data.actor.role)).map(([key, name]) => ({ id: key, name })), false, editingSelf)}
          {select("employeeId", "Funcionário vinculado", options("employees", "employeeId").filter(option => option.id === draft.employeeId || !data.rows.some(row => row.employeeId === option.id && row.id !== id)))}
          <label className="flex items-center gap-2 self-end py-2"><input type="checkbox" checked={!!draft.active} disabled={editingSelf} onChange={event => change("active", event.target.checked)} /> Acesso ativo</label>
        </> : <>
          {field("cpf", "CPF", true, "text", 14)}{field("registration", "Matrícula", true, "text", 80)}{field("email", "E-mail", false, "email")}{field("phone", "Telefone", false, "tel", 40)}{field("admissionDate", "Data de admissão", false, "date")}
          {select("departmentId", "Setor", options("departments", "departmentId"))}
          {select("positionId", "Cargo", options("positions", "positionId").filter(option => { const position = data.options.positions.find(item => item.id === option.id); return !position?.departmentId || position.departmentId === draft.departmentId; }))}
          {select("workScheduleId", "Jornada", options("schedules", "workScheduleId"))}{select("managerId", "Gestor responsável", options("managers", "managerId"))}
          {select("status", "Situação", Object.entries(statusLabels).map(([key, name]) => ({ id: key, name })), false)}
          <div>{field("externalIdDevice", "ID do usuário no iDFace", false, "text", 120)}<p className="mt-1 text-xs text-slate-500">Use o ID individual do colaborador no equipamento.</p></div>
          <div className="md:col-span-2 lg:col-span-3"><label htmlFor="people-observations" className="text-sm font-medium">Observações</label><textarea id="people-observations" className={`${selectClass} h-24`} maxLength={2000} value={String(draft.observations ?? "")} onChange={event => change("observations", event.target.value)} />{errors.observations && <p className="text-sm text-red-700">{errors.observations}</p>}</div>
        </>}
      </fieldset><p className="text-xs text-slate-500">* Campos obrigatórios.{users && " A senha deve ter pelo menos 8 caracteres."}</p><div className="flex gap-3"><Button disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar cadastro"}</Button>{id && <Button disabled={busy} type="button" variant="outline" onClick={reset}>Cancelar edição</Button>}</div></form>
    </CardContent></Card>}
    <Card><CardHeader><CardTitle>{title} cadastrados</CardTitle></CardHeader><CardContent className="space-y-4"><Input aria-label={`Pesquisar ${title.toLowerCase()}`} placeholder={users ? "Pesquisar nome ou e-mail" : "Pesquisar nome, matrícula ou e-mail"} value={query} onChange={event => setQuery(event.target.value)} />
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="p-3">Nome</th><th className="p-3">{users ? "E-mail" : "Matrícula"}</th><th className="p-3">{users ? "Perfil" : "ID no iDFace"}</th><th className="p-3">Status</th>{data?.canWrite && <th className="p-3">Ações</th>}</tr></thead><tbody>{visible.map(row => <tr key={row.id} className="border-b"><td className="p-3 font-medium">{row.name}</td><td className="p-3">{String((users ? row.email : row.registration) ?? "—")}</td><td className="p-3">{users ? roleLabels[String(row.role)] : String(row.externalIdDevice ?? "—")}</td><td className="p-3">{users ? (row.active ? "Ativo" : "Inativo") : statusLabels[String(row.status)]}</td>{data?.canWrite && <td className="p-3">{editable(row) && <Button variant="outline" size="sm" disabled={busy} onClick={() => edit(row)}>Editar</Button>}</td>}</tr>)}</tbody></table></div>
      {data && !visible.length && <p className="py-3 text-sm text-slate-500">{data.rows.length ? "Nenhum cadastro corresponde à pesquisa." : `Nenhum ${users ? "usuário" : "funcionário"} cadastrado.`}</p>}
      {data && !data.canWrite && <p className="text-sm text-slate-500">Você pode consultar os funcionários da sua equipe. Alterações são feitas pelo RH ou administrador.</p>}
    </CardContent></Card>
  </div>;
}
