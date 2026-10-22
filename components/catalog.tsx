"use client";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export function Catalog({ module, title }: { module: string; title: string }) {
  const [rows, setRows] = useState<Array<{ id: string; name: string; active: boolean; description: string | null }>>([]);
  const [q, setQ] = useState(""); const [id, setId] = useState(""); const [name, setName] = useState(""); const [description, setDescription] = useState("");
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function load() {
    try { const res = await fetch(`/api/catalog/${module}`, { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setRows(data); }
    catch { setMessage("Falha ao consultar registros. Tente novamente."); }
  }
  useEffect(() => { void load(); }, [module]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(body: object) {
    setBusy(true); setMessage("");
    try { const res = await fetch(`/api/catalog/${module}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setId(""); setName(""); setDescription(""); await load(); setMessage("Alteração salva."); }
    catch (e) { setMessage(e instanceof Error ? e.message : "Falha ao salvar"); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><h1 className="text-2xl font-bold">{title}</h1><p role="status">{message}</p>
    <Card><CardHeader><CardTitle>{id ? "Editar" : "Novo registro"}</CardTitle></CardHeader><CardContent><form className="flex flex-wrap gap-3" onSubmit={e => { e.preventDefault(); void save({ id: id || undefined, name, description }); }}><label>Nome<Input required maxLength={150} value={name} onChange={e => setName(e.target.value)} /></label><label>Descrição<Input maxLength={500} value={description} onChange={e => setDescription(e.target.value)} /></label><Button disabled={busy} type="submit">{busy ? "Salvando…" : "Salvar"}</Button>{id && <Button type="button" variant="outline" onClick={() => { setId(""); setName(""); setDescription(""); }}>Cancelar</Button>}</form></CardContent></Card>
    <Card><CardHeader><CardTitle>Registros</CardTitle></CardHeader><CardContent><Input aria-label="Pesquisar" placeholder="Pesquisar por nome" value={q} onChange={e => setQ(e.target.value)} /><table className="w-full text-sm"><thead><tr><th>Nome</th><th>Status</th><th>Ações</th></tr></thead><tbody>{rows.filter(r => r.name.toLowerCase().includes(q.toLowerCase())).map(r => <tr key={r.id} className="border-t"><td className="p-3">{r.name}</td><td>{r.active ? "Ativo" : "Inativo"}</td><td className="flex gap-2 p-2"><Button disabled={busy} variant="outline" onClick={() => { setId(r.id); setName(r.name); setDescription(r.description ?? ""); }}>Editar</Button><Button disabled={busy} variant="outline" onClick={() => void save({ id: r.id, active: !r.active })}>{r.active ? "Desativar" : "Ativar"}</Button></td></tr>)}</tbody></table>{!rows.length && <p className="py-4">Nenhum registro cadastrado.</p>}</CardContent></Card>
  </div>;
}
