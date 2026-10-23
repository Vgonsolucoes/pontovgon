"use client";
import { FormEvent, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
export function AttendancePolicyCard() {
  const [draft, setDraft] = useState({ windowEnabled: true, minutesBefore: "30", minutesAfter: "30", duplicateMinutes: "2" });
  const [busy, setBusy] = useState(true), [ready, setReady] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { void (async () => { try {
    const response = await fetch("/api/people/attendance-policy", { cache: "no-store" }); const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setDraft({ windowEnabled: data.windowEnabled, minutesBefore: String(data.minutesBefore), minutesAfter: String(data.minutesAfter), duplicateMinutes: String(data.duplicateMinutes) }); setReady(true);
  } catch { setMessage("Não foi possível carregar a configuração. Atualize a página para tentar novamente."); } finally { setBusy(false); } })(); }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/people/attendance-policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ windowEnabled: draft.windowEnabled, minutesBefore: Number(draft.minutesBefore), minutesAfter: Number(draft.minutesAfter), duplicateMinutes: Number(draft.duplicateMinutes) }) });
      const data = await response.json(); if (!response.ok) throw new Error(Object.values(data.fields || {}).join(". ") || data.error);
      setMessage("Configuração salva. Aplicada aos novos registros e à aprovação de lançamentos manuais.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao salvar"); } finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>Janela da jornada e duplicidade</CardTitle></CardHeader><CardContent><form onSubmit={save} className="space-y-4"><fieldset disabled={busy || !ready} className="space-y-4">
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.windowEnabled} onChange={e => setDraft({ ...draft, windowEnabled: e.target.checked })} /> Aplicar janela da jornada</label>
    <div className="grid gap-4 md:grid-cols-3">{([["minutesBefore", "Minutos antes da entrada", 240], ["minutesAfter", "Minutos depois da saída", 240], ["duplicateMinutes", "Intervalo de duplicidade (minutos)", 30]] as const).map(([key, label, max]) => <label key={key} className="space-y-1 text-sm">{label}<Input type="number" required min={0} max={max} step={1} value={draft[key]} onChange={e => setDraft({ ...draft, [key]: e.target.value })} /></label>)}</div>
    <p className="text-xs text-slate-500">A janela cobre o turno inteiro, incluindo o intervalo. Exemplo: jornada 08h–18h com 30 minutos permite 07h30–18h30. Em folgas ou sem jornada válida, lançamentos manuais são bloqueados quando a janela está ativa. Batidas do iDFace fora da janela são preservadas e sinalizadas. Repetidas no intervalo configurado, inclusive na mesma hora com origens diferentes, ficam no histórico e são desconsideradas na apuração. Zero verifica o mesmo minuto. Não altera as permissões de acesso do equipamento nem reclassifica registros antigos.</p>
    <Button type="submit">{busy ? "Aguarde…" : "Salvar regras de marcação"}</Button>
  </fieldset>{message && <p role="status" className="text-sm">{message}</p>}</form></CardContent></Card>;
}
