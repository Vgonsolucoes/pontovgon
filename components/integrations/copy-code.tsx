"use client";

import { useState } from "react";
import { Copy as CopyIcon, Check } from "lucide-react";

// Componentes de copiar para area de transferencia.
// PRECISAM ser Client Components: a pagina /integracoes/agents e um
// async Server Component e event handlers (onClick) nao sao serializaveis
// em RSC — era a causa do "Application error" (Digest 1607689344).

export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponivel (permissao negada / contexto nao seguro) — ignora
    }
  }

  return (
    <div className="relative group">
      <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap break-words border border-slate-800">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="hidden sm:flex absolute right-2 top-2 items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
      >
        {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <CopyIcon className="w-3 h-3" />}
        {copied ? "Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

export function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignora
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-[11px] mt-1 text-sky-700 hover:underline inline-flex items-center gap-1"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <CopyIcon className="w-3 h-3" />}
      {copied ? "Copiado!" : "Copiar token"}
    </button>
  );
}
