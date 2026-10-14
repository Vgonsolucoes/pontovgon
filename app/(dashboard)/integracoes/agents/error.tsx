"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldAlert } from "lucide-react";

// Error boundary da rota /integracoes/agents.
// Garante que NENHUMA falha de renderizacao/consulta derrube a pagina inteira
// com a tela generica "Application error" — exibe mensagem amigavel e permite retry.
export default function AgentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[integracoes/agents] falha de renderizacao:", error);
  }, [error]);

  return (
    <div className="p-4 sm:p-8 max-w-3xl mx-auto">
      <Card className="border-rose-200 dark:border-rose-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
            <ShieldAlert className="w-5 h-5" />
            Não foi possível carregar a página do VGON PONTO Agent
          </CardTitle>
          <CardDescription>
            Ocorreu uma falha ao processar esta página. Os detalhes técnicos foram registrados nos
            logs do servidor. Tente novamente — se o problema persistir, contate o suporte Vgon.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error?.digest ? (
            <p className="text-xs text-slate-500">
              Referência do erro (digest):{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">{error.digest}</code>
            </p>
          ) : null}
          <Button onClick={() => reset()}>Tentar novamente</Button>
        </CardContent>
      </Card>
    </div>
  );
}
