import Link from "next/link";
import { prisma } from "@/server/db";
import { requireRole } from "@/server/lib/auth";
import { isRecentCommunication } from "@/server/lib/operational";
import { formatInTimeZone } from "date-fns-tz";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DashboardRefresh } from "@/components/dashboard-refresh";
import { formatMinutesSigned } from "@/lib/utils";

export const dynamic = "force-dynamic";
export default async function DashboardPage() {
  const session = await requireRole(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]);
  if (!["MASTER", "ADMIN", "RH"].includes(session.user.role ?? "")) return <Card><CardHeader><CardTitle>VGON PONTO</CardTitle></CardHeader><CardContent>Os indicadores gerais são restritos ao RH e à administração.</CardContent></Card>;
  const today = formatInTimeZone(new Date(), "America/Sao_Paulo", "yyyy-MM-dd");
  const date = new Date(today + "T00:00:00Z");
  const month = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  const [active, vacations, days, overtime, bank, agents, devices, entries] = await prisma.$transaction([
    prisma.employees.count({ where: { status: "ATIVO", deletedAt: null } }),
    prisma.vacations.findMany({ where: { status: "APROVADO", startDate: { lte: date }, endDate: { gte: date }, employee: { deletedAt: null } }, distinct: ["employeeId"], select: { employeeId: true } }),
    prisma.work_days.findMany({ where: { date, employee: { deletedAt: null } }, select: { lateMinutes: true, recalculatedAt: true } }),
    prisma.work_days.aggregate({ where: { date: { gte: month, lte: date }, employee: { deletedAt: null } }, _sum: { overtimeMinutes: true } }),
    prisma.hour_bank.aggregate({ where: { date: { lte: date }, employee: { deletedAt: null } }, _sum: { deltaMinutes: true } }),
    prisma.agents.findMany({ where: { deletedAt: null }, select: { id: true, name: true, enabled: true, status: true, lastHeartbeatAt: true } }),
    prisma.devices.findMany({ where: { deletedAt: null }, select: { id: true, name: true, status: true, lastCommunication: true } }),
    prisma.time_entries.findMany({ where: { date, status: { not: "EXCLUIDO_LOGICAMENTE" } }, orderBy: [{ time: "desc" }, { id: "desc" }], take: 25, include: { employee: true, device: true } }),
  ]);
  return <div className="space-y-6"><DashboardRefresh />
    <h1 className="text-2xl font-bold">Dashboard</h1><p className="text-sm text-slate-500">{today} · America/Sao_Paulo · atualização a cada 30 segundos</p>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Funcionários ativos", active], ["Em férias", vacations.length], ["Atrasados (dias calculados)", days.filter(d => d.recalculatedAt && d.lateMinutes > 0).length],
      ["Horas extras do mês (calculadas)", formatMinutesSigned(overtime._sum.overtimeMinutes ?? 0)], ["Banco de horas (lançamentos)", formatMinutesSigned(bank._sum.deltaMinutes ?? 0)],
    ].map(([label, value]) => <Card key={label}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{value}</CardContent></Card>)}</section>
    <p className="text-sm text-slate-500">{days.filter(d => d.recalculatedAt).length} dia(s) com cálculo persistido hoje. Presença e ausência aguardam implementação e validação das regras de jornada.</p>
    <section className="grid gap-4 md:grid-cols-2"><Card><CardHeader><CardTitle>Agents</CardTitle></CardHeader><CardContent>{!agents.length && <p>Nenhum Agent cadastrado.</p>}{agents.map(a => <p key={a.id}>{a.name}: {a.enabled && a.status === "ONLINE" && isRecentCommunication(a.lastHeartbeatAt) ? "Online — heartbeat recente" : "Sem heartbeat online recente"}</p>)}</CardContent></Card>
    <Card><CardHeader><CardTitle>iDFace</CardTitle></CardHeader><CardContent>{!devices.length && <p>Nenhum dispositivo cadastrado.</p>}{devices.map(d => <p key={d.id}>{d.name}: {d.status === "ONLINE" && isRecentCommunication(d.lastCommunication) ? "Online — comunicação recente" : "Sem comunicação online recente"}</p>)}</CardContent></Card></section>
    <Card><CardHeader><CardTitle>Últimas marcações de hoje</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{["Funcionário", "Hora", "Equipamento", "Origem", "Evento"].map(h => <th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{entries.map(e => <tr key={e.id} className="border-t"><td className="p-2">{e.employee?.name ?? "Aguardando conciliação"}</td><td>{e.time}</td><td>{e.device?.name ?? "—"}</td><td>{e.origin}</td><td>{e.externalEventId ?? "—"}</td></tr>)}</tbody></table>{!entries.length && <p className="py-6 text-slate-500">Nenhuma marcação encontrada para este período.</p>}<Link className="text-blue-700" href="/ponto/marcacoes">Consultar marcações</Link></CardContent></Card>
  </div>;
}
