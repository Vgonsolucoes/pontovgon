"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
type Employee = { id: string; name: string; status?: unknown; hasPhoto?: unknown };
type Device = { id: string; name: string; ready: boolean; online: boolean; version: string | null; serialNumber: string };
type Command = { id: string; employeeName: string; status: string; error: string | null; createdAt: string };
const labels: Record<string, string> = { PENDING: "Na fila", PROCESSING: "Enviando ao iDFace", SUCCESS: "Cadastro e foto confirmados", FAILED: "Falhou" };
export function FaceSyncPanel({ employees }: { employees: Employee[] }) {
  const [devices, setDevices] = useState<Device[]>([]), [commands, setCommands] = useState<Command[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState(""), [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/people/idface", { cache: "no-store" }); const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setDevices(result.devices); setCommands(result.commands);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao consultar o envio ao iDFace"); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => void load(), 10000); return () => clearInterval(timer); }, [load]);
  async function send() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/people/idface", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceId, employeeIds: selected }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setMessage(result.message); setSelected([]); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao enfileirar o envio"); }
    finally { setBusy(false); }
  }
  const device = devices.find(item => item.id === deviceId);
  return <Card><CardHeader><CardTitle>Enviar cadastros e fotos para o iDFace</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-500">Selecione até 20 funcionários ativos com foto. O Agent envia pela rede local e o histórico mostra a confirmação ou a recusa do equipamento.</p>
    {message && <p role="status" className="rounded border p-3 text-sm">{message}</p>}
    <label className="block text-sm font-medium">Equipamento de destino<select className="mt-1 block w-full rounded border bg-white p-2" value={deviceId} onChange={event => setDeviceId(event.target.value)}><option value="">Selecione o equipamento</option>{devices.map(item => <option key={item.id} value={item.id}>{item.name} · {item.serialNumber} · {item.online ? "Agent online" : "Agent offline"}</option>)}</select></label>
    {!devices.length && <p className="text-sm">Cadastre o vínculo do computador e do equipamento na <Link className="text-blue-700 underline" href="/integracoes/agents">página Agents</Link>.</p>}
    {device && !device.ready && <p className="text-sm text-amber-800">Vincule o Agent, configure seu token real e instale a versão 1.0.4 ou superior. Versão informada: {device.version ?? "sem comunicação"}. <Link className="underline" href="/integracoes/agents">Abrir Agents</Link></p>}
    {device?.ready && !device.online && <p className="text-sm text-amber-800">O Agent está offline. O envio permanecerá na fila até ele se conectar.</p>}
    <div className="max-h-56 space-y-2 overflow-auto rounded border p-3">{employees.map(employee => <label key={employee.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.includes(employee.id)} disabled={busy || employee.status !== "ATIVO" || !employee.hasPhoto || (!selected.includes(employee.id) && selected.length >= 20)} onChange={event => setSelected(previous => event.target.checked ? [...previous, employee.id] : previous.filter(id => id !== employee.id))} />{employee.name}{!employee.hasPhoto ? " — cadastre uma foto" : employee.status !== "ATIVO" ? " — funcionário não ativo" : ""}</label>)}{!employees.length && <p className="text-sm text-slate-500">Cadastre o funcionário e sua foto no formulário acima.</p>}</div>
    <Button type="button" disabled={busy || !selected.length || !device?.ready} onClick={() => void send()}>{busy ? "Enfileirando…" : `Enviar para o iDFace (${selected.length})`}</Button>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Funcionário</th><th className="p-2">Envio</th><th className="p-2">Resultado</th></tr></thead><tbody>{commands.map(command => <tr key={command.id} className="border-t"><td className="p-2">{command.employeeName}</td><td className="p-2">{new Date(command.createdAt).toLocaleString("pt-BR")}</td><td className="p-2">{labels[command.status] ?? command.status}{command.error && <p className="text-red-700">{command.error}</p>}</td></tr>)}</tbody></table>{!commands.length && <p className="py-3 text-sm text-slate-500">Nenhum envio solicitado.</p>}</div>
  </CardContent></Card>;
}
