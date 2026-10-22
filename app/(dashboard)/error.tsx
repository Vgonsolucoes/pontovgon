"use client";
export default function OperationalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div role="alert" className="rounded border bg-white p-6 space-y-4"><h2 className="text-lg font-semibold">Não foi possível carregar os dados</h2><p>A consulta falhou. Isso não significa que não existem registros.</p><button className="rounded bg-blue-700 text-white px-4 py-2" onClick={reset}>Tentar novamente</button></div>;
}
