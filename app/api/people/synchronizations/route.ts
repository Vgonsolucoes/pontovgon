import { fromZonedTime } from "date-fns-tz";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { addDays, entryFilters, localToday, zone } from "@/server/lib/attendance";
import { isRecentCommunication } from "@/server/lib/operational";
import { attendanceTransaction } from "@/server/lib/attendance-transaction";
import { auditJson, peopleActor, peopleError, PeopleError, validationError } from "@/server/lib/people-api";
const queryInput = z.object({ start: z.string().optional(), end: z.string().optional(), agentId: z.union([z.string().cuid(), z.literal("")]).default(""), deviceId: z.union([z.string().cuid(), z.literal("")]).default(""), status: z.enum(["", "SUCCESS", "FAILED", "PARTIAL"]).default(""), page: z.coerce.number().int().min(1).max(100000).default(1) }).strict();
function failureDetails(error: string | null) {
  if (!error) return [];
  try {
    const rows: unknown = JSON.parse(error);
    if (Array.isArray(rows)) return rows.slice(0, 50).map(row => ({ event: typeof row.externalEventId === "string" ? row.externalEventId.slice(0, 120) : "Não informado", detail: typeof row.error === "string" && /^(Data inválida|Evento simulado não permitido|Conflito de unicidade)/.test(row.error) ? row.error.slice(0, 200) : "Falha de importação. Confira o log do Agent." }));
  } catch {}
  return [{ event: "—", detail: "A sincronização registrou uma falha. Confira a comunicação e o log do Agent." }];
}
export async function GET(request: Request) { try {
  await peopleActor(["MASTER", "ADMIN"]);
  const parsed = queryInput.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const today = localToday(), filters = { ...parsed.data, start: parsed.data.start || today.slice(0, 7) + "-01", end: parsed.data.end || today };
  const validRange = entryFilters.safeParse({ start: filters.start, end: filters.end, page: filters.page });
  if (!validRange.success) return validationError(validRange.error);
  const period = { gte: fromZonedTime(filters.start + "T00:00:00", zone), lt: fromZonedTime(addDays(filters.end, 1) + "T00:00:00", zone) };
  const where: Prisma.device_sync_logsWhereInput = { startedAt: period, ...(filters.agentId ? { agentId: filters.agentId } : {}), ...(filters.deviceId ? { deviceId: filters.deviceId } : {}), ...(filters.status ? { status: filters.status } : {}) };
  const pageSize = 30;
  const [total, summary, rows, agents, devices, commands] = await prisma.$transaction([
    prisma.device_sync_logs.count({ where }),
    prisma.device_sync_logs.aggregate({ where, _sum: { eventsCount: true, newEvents: true, duplicate: true, failed: true } }),
    prisma.device_sync_logs.findMany({ where, select: { id: true, startedAt: true, finishedAt: true, eventsCount: true, newEvents: true, duplicate: true, failed: true, status: true, error: true, agent: { select: { name: true } }, device: { select: { name: true } } }, orderBy: [{ startedAt: "desc" }, { id: "desc" }], skip: (filters.page-1)*pageSize, take: pageSize }),
    prisma.agents.findMany({ where: { deletedAt: null }, select: { id: true, name: true, enabled: true, status: true, version: true, lastHeartbeatAt: true, lastSyncAt: true, heartbeats: { select: { pendingEvents: true, sentAt: true }, orderBy: { sentAt: "desc" }, take: 1 } }, orderBy: { name: "asc" } }),
    prisma.devices.findMany({ where: { deletedAt: null }, select: { id: true, name: true, agentId: true, enabled: true }, orderBy: { name: "asc" } }),
    prisma.commands.findMany({ where: { commandType: "TEST_DEVICE", ...(filters.agentId ? { agentId: filters.agentId } : {}), ...(filters.deviceId ? { agent: { devices: { some: { id: filters.deviceId } } } } : {}), createdAt: period }, select: { id: true, status: true, createdAt: true, finishedAt: true, agent: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 20 }),
  ], { isolationLevel: "RepeatableRead" });
  return NextResponse.json({ total, filters, pageSize, summary: summary._sum, rows: rows.map(({ error, ...row }) => ({ ...row, failures: failureDetails(error) })), agents: agents.map(({ heartbeats, ...agent }) => ({ ...agent, online: agent.enabled && ["ONLINE", "SYNCING"].includes(agent.status) && isRecentCommunication(agent.lastHeartbeatAt), pendingEvents: heartbeats[0]?.pendingEvents ?? null })), devices, commands }, { headers: { "Cache-Control": "private, no-store" } });
} catch (error) { return peopleError(error); } }
export async function POST(request: Request) { try {
  const actor = await peopleActor(["MASTER", "ADMIN"]), parsed = z.object({ agentId: z.string().cuid() }).strict().safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  const result = await attendanceTransaction(async tx => {
    const agent = await tx.agents.findFirst({ where: { id: parsed.data.agentId, deletedAt: null, enabled: true }, select: { id: true, lastHeartbeatAt: true, status: true } });
    if (!agent || !isRecentCommunication(agent.lastHeartbeatAt) || !["ONLINE", "SYNCING"].includes(agent.status)) throw new PeopleError("O Agent precisa estar habilitado e com comunicação recente para receber o teste", 409);
    if (!await tx.devices.count({ where: { agentId: agent.id, deletedAt: null, enabled: true } })) throw new PeopleError("Vincule e habilite um equipamento antes do teste", 409);
    const existing = await tx.commands.findFirst({ where: { agentId: agent.id, commandType: "TEST_DEVICE", status: { in: ["PENDING", "PROCESSING"] } }, select: { id: true } });
    if (existing) return { id: existing.id, message: "Já existe um teste aguardando execução ou confirmação pelo Agent." };
    const command = await tx.commands.create({ data: { agentId: agent.id, commandType: "TEST_DEVICE", payload: {} }, select: { id: true } });
    await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "SYNC", entity: "commands", entityId: command.id, after: auditJson({ agentId: agent.id, commandType: "TEST_DEVICE" }) } });
    return { id: command.id, message: "Teste enfileirado. Aguarde a execução e a confirmação do Agent no histórico de testes." };
  });
  return NextResponse.json(result);
} catch (error) { return peopleError(error); } }
