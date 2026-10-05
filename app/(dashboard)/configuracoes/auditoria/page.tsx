import Link from "next/link";
import { Activity, ArrowLeft, ChevronLeft, ChevronRight, SearchIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/server/lib/auth";
import { actionLabel } from "@/server/lib/audit";
import { TIMEZONE, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const actions: Array<{ label: string; value: string }> = [
  { label: "Todas", value: "" },
  { label: "Criação", value: "CREATE" },
  { label: "Atualização", value: "UPDATE" },
  { label: "Exclusão lógica", value: "SOFT_DELETE" },
  { label: "Restauração", value: "RESTORE" },
  { label: "Aprovação", value: "APPROVE" },
  { label: "Reprovação", value: "REJECT" },
  { label: "Ajuste", value: "ADJUST" },
  { label: "Entrada manual", value: "MANUAL_ENTRY" },
  { label: "Sincronização", value: "SYNC" },
];

const entitiesList = [
  "",
  "users",
  "employees",
  "departments",
  "positions",
  "work_schedules",
  "devices",
  "agents",
  "time_entries",
  "work_days",
  "hour_bank",
  "vacations",
  "leaves",
  "holidays",
  "commands",
];

function actionVariant(a: string): "default" | "success" | "warning" | "danger" | "info" | "muted" | "outline" | "secondary" {
  switch (a) {
    case "CREATE": return "success";
    case "UPDATE": return "info";
    case "SOFT_DELETE": return "danger";
    case "APPROVE": return "success";
    case "REJECT": return "danger";
    case "ADJUST": return "warning";
    case "MANUAL_ENTRY": return "secondary";
    case "SYNC": return "info";
    case "RESTORE": return "success";
    default: return "outline";
  }
}

function fmtDate(d: Date | null) {
  if (!d) return "—";
  try {
    const parts = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: TIMEZONE,
    }).formatToParts(new Date(d));
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
    return `${map.day}/${map.month}/${map.year} ${map.hour}:${map.minute}:${map.second}`;
  } catch {
    return new Date(d).toISOString().replace("T", " ").slice(0, 19);
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  await requireRole(["MASTER", "ADMIN"]);

  const q = typeof searchParams?.q === "string" ? searchParams.q : "";
  const action = typeof searchParams?.action === "string" ? searchParams.action : "";
  const entity = typeof searchParams?.entity === "string" ? searchParams.entity : "";
  const pageParam = Number.parseInt((typeof searchParams?.page === "string" ? searchParams.page : "1") || "1", 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSize = 25;

  // Dados exemplo (demonstração) — quando DB estiver disponível, trocar por prisma.audit_logs.findMany
  const rows = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - ((page - 1) * pageSize * 7) - i * 7);
    return {
      id: `audit-demo-${page}-${i}`,
      actorEmail: i % 7 === 0 ? "master@vgon.com.br" : "rh@vgon.com.br",
      action: (actions[(i + (page % actions.length)) % (actions.length - 1) + 1].value) as any,
      entity: entitiesList[(i % (entitiesList.length - 1)) + 1],
      entityId: i % 3 === 0 ? null : `rec-${1000 + i}`,
      ip: i % 5 === 0 ? null : "10.0.0." + (20 + (i % 20)),
      userAgent: i % 4 === 0 ? null : "Windows · Chrome 128",
      createdAt: d,
    };
  });
  const total = 132;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Link href="/dashboard" className="hover:text-vgon-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Configurações</span>
            <span>/</span>
            <span className="text-slate-800 font-medium">Auditoria</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-vgon-blue-600" /> Auditoria de operações
          </h1>
          <p className="text-sm text-slate-500 mt-1">Histórico completo de criação, atualização, exclusão, aprovações e sincronizações.</p>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar</Link>
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          <CardDescription>Filtre por ator, ação, entidade ou id do registro.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="q">Buscar</Label>
            <div className="relative">
              <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <form>
                <Input id="q" name="q" defaultValue={q} placeholder="E-mail do ator, ID de entidade…" className="pl-9" />
              </form>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="action">Ação</Label>
            <form>
              <select
                id="action"
                name="action"
                defaultValue={action}
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                  "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {actions.map((a) => (
                  <option key={a.value || "all"} value={a.value}>{a.label}</option>
                ))}
              </select>
            </form>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="entity">Entidade</Label>
            <form>
              <select
                id="entity"
                name="entity"
                defaultValue={entity}
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
                  "file:border-0 file:bg-transparent file:text-sm file:font-medium",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="">Todas</option>
                {entitiesList.slice(1).map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Registros</CardTitle>
            <CardDescription className="text-xs pt-1">
              Exibindo <span className="font-semibold text-slate-700">{rows.length}</span> de <span className="font-semibold text-slate-700">{total}</span> eventos
            </CardDescription>
          </div>
          <Badge variant="muted" className="text-xs">Exibindo {q || action || entity ? "resultados filtrados" : "últimos eventos"}</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-t-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Data/hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>ID Registro</TableHead>
                  <TableHead>Ator</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Origem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                      Nenhum registro encontrado para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.id} className="align-middle">
                    <TableCell className="font-mono text-xs text-slate-700 whitespace-nowrap">
                      {fmtDate(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(r.action)} className="text-xs">
                        {actionLabel(r.action as any)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-700">{r.entity}</TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{r.entityId ?? "—"}</TableCell>
                    <TableCell className="text-sm">
                      <div className="font-medium text-slate-800">{r.actorEmail?.split("@")[0]}</div>
                      <div className="text-[11px] text-slate-500">{r.actorEmail}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">{r.ip ?? "—"}</TableCell>
                    <TableCell className="text-xs text-slate-500">{r.userAgent ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/70 rounded-b-lg">
            <p className="text-xs text-slate-500">Página <span className="font-semibold text-slate-700">{page}</span> de <span className="font-semibold text-slate-700">{totalPages}</span></p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
                {page > 1 ? (
                  <Link href={`?q=${encodeURIComponent(q)}&action=${encodeURIComponent(action)}&entity=${encodeURIComponent(entity)}&page=${page - 1}`}>
                    <ChevronLeft className="h-4 w-4 mr-0.5" /> Anterior
                  </Link>
                ) : (
                  <span><ChevronLeft className="h-4 w-4 mr-0.5" /> Anterior</span>
                )}
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
                {page < totalPages ? (
                  <Link href={`?q=${encodeURIComponent(q)}&action=${encodeURIComponent(action)}&entity=${encodeURIComponent(entity)}&page=${page + 1}`}>
                    Próxima <ChevronRight className="h-4 w-4 ml-0.5" />
                  </Link>
                ) : (
                  <span>Próxima <ChevronRight className="h-4 w-4 ml-0.5" /></span>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
