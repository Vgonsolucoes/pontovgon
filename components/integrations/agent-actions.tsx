"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RefreshCcw, Wifi, Settings2, Loader2 } from "lucide-react";

type ActionResult = { ok: boolean; message: string } | null;

async function sendCommand(agentId: string, commandType: string): Promise<ActionResult> {
  try {
    const res = await fetch(`/api/dashboard/agents/${agentId}/commands`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commandType }),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, message: "Comando enfileirado — o Agent executa no próximo poll (≤15s)." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Falha de rede" };
  }
}

export function AgentActions({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [busy, setBusy] = useState<"SYNC_NOW" | "TEST_DEVICE" | null>(null);
  const [result, setResult] = useState<ActionResult>(null);

  async function run(kind: "SYNC_NOW" | "TEST_DEVICE") {
    setBusy(kind);
    setResult(null);
    const r = await sendCommand(agentId, kind);
    setResult(r);
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => run("SYNC_NOW")}
          title="Enfileira SYNC_NOW — o Agent envia as marcações pendentes imediatamente"
        >
          {busy === "SYNC_NOW" ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <RefreshCcw className="w-3.5 h-3.5 mr-1" />
          )}
          Sincronizar
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => run("TEST_DEVICE")}
          title="Enfileira TEST_DEVICE — o Agent testa a comunicação com o iDFace"
        >
          {busy === "TEST_DEVICE" ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Wifi className="w-3.5 h-3.5 mr-1" />
          )}
          Testar
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" title="Como configurar este Agent">
              <Settings2 className="w-3.5 h-3.5 mr-1" />
              Configurar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configurar — {agentName}</DialogTitle>
              <DialogDescription>
                A configuração é feita localmente, na máquina onde o Agent está instalado.
              </DialogDescription>
            </DialogHeader>
            <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li>
                Na máquina do Agent, abra o atalho{" "}
                <strong>“VGON PONTO Agent — Configurações”</strong> (menu Iniciar) ou acesse{" "}
                <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">http://127.0.0.1:3737</code> nela.
              </li>
              <li>
                Preencha os dados do <strong>iDFace</strong> (URL da LAN, usuário e senha) e da{" "}
                <strong>API</strong> (URL e o Agent Token exibido nesta tabela).
              </li>
              <li>
                Use <strong>Testar iDFace</strong> e <strong>Testar Servidor</strong> para validar.
              </li>
              <li>
                Clique em <strong>Salvar Configuração</strong> e depois em{" "}
                <strong>Reiniciar Serviço</strong>.
              </li>
            </ol>
            <p className="text-xs text-slate-500">
              As credenciais ficam somente na máquina local (C:\ProgramData\VGON\Ponto Agent) — nunca
              saem da sua rede.
            </p>
          </DialogContent>
        </Dialog>
      </div>
      {result && (
        <p className={`text-[11px] leading-snug ${result.ok ? "text-emerald-600" : "text-rose-600"}`}>
          {result.message}
        </p>
      )}
    </div>
  );
}
