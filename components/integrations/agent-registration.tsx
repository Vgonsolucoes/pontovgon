"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
export function AgentRegistration() {
  const router = useRouter();
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(""), [token, setToken] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setToken("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/people/idface/setup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setToken(result.agentToken); setMessage("Vínculo cadastrado. Copie o token para a configuração local do Agent e reinicie o serviço."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Não foi possível cadastrar o vínculo"); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>Vincular computador e iDFace</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-slate-500">Use os identificadores reais exibidos no equipamento e na configuração local do Agent. Este cadastro gera o token de comunicação com o servidor.</p><form onSubmit={save} className="space-y-4"><fieldset disabled={busy} className="grid gap-3 md:grid-cols-2">{[["agentName", "Nome do computador / Agent"], ["deviceName", "Nome do equipamento"], ["deviceUniqueId", "Device ID do equipamento"], ["serialNumber", "Número de série do equipamento"]].map(([name, label]) => <label key={name} className="text-sm font-medium">{label}<Input required name={name} maxLength={120} /></label>)}</fieldset><Button type="submit" disabled={busy}>{busy ? "Cadastrando…" : "Cadastrar vínculo e gerar token"}</Button></form>{message && <p role="status" className="text-sm">{message}</p>}{token && <div className="space-y-2 rounded border p-3"><label className="block text-sm">Token do Agent<Input type="password" readOnly value={token} autoComplete="off" /></label><Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(token).then(() => setMessage("Token copiado. Cole no campo Token do Agent da tela local, salve e reinicie o serviço.")).catch(() => setMessage("Selecione e copie o token manualmente."))}>Copiar token para configurar o Agent</Button></div>}</CardContent></Card>;
}
