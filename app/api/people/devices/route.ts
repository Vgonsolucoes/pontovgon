import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { deviceInput } from "@/server/lib/catalog-input";
import { attendanceTransaction } from "@/server/lib/attendance-transaction";
import { isRecentCommunication } from "@/server/lib/operational";
import { auditJson, peopleActor, peopleError, PeopleError, validationError } from "@/server/lib/people-api";
const select = { id: true, name: true, serialNumber: true, deviceUniqueId: true, manufacturer: true, model: true, location: true, enabled: true, lastCommunication: true, lastEntryAt: true, firmwareVersion: true, agentId: true, agent: { select: { name: true, enabled: true, lastHeartbeatAt: true } } };
export async function GET() { try {
  await peopleActor(["MASTER", "ADMIN"]);
  const rows = await prisma.devices.findMany({ where: { deletedAt: null }, select, orderBy: { name: "asc" } });
  return NextResponse.json({ rows: rows.map(row => ({ ...row, online: row.enabled && !!row.agent?.enabled && isRecentCommunication(row.lastCommunication) && isRecentCommunication(row.agent?.lastHeartbeatAt ?? null) })) }, { headers: { "Cache-Control": "private, no-store" } });
} catch (error) { return peopleError(error); } }
export async function POST(request: Request) { try {
  const actor = await peopleActor(["MASTER", "ADMIN"]), parsed = deviceInput.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  const { id, ...data } = parsed.data;
  const result = await attendanceTransaction(async tx => {
    const before = id ? await tx.devices.findFirst({ where: { id, deletedAt: null }, select }) : null;
    if (id && !before) throw new PeopleError("Dispositivo não encontrado", 404);
    if (before?.agentId && !data.enabled && await tx.commands.count({ where: { agentId: before.agentId, status: { in: ["PENDING", "PROCESSING"] } } })) throw new PeopleError("Aguarde a conclusão dos comandos do Agent antes de desativar o equipamento", 409);
    if (before && (before.serialNumber !== data.serialNumber || before.deviceUniqueId !== data.deviceUniqueId)) {
      const [events, links, commands] = await Promise.all([tx.time_entries.count({ where: { deviceId: id } }), tx.device_users.count({ where: { deviceId: id } }), before.agentId ? tx.commands.count({ where: { agentId: before.agentId } }) : 0]);
      if (before.agentId || events || links || commands) throw new PeopleError("A identificação de um equipamento vinculado ou com histórico não pode ser alterada. Cadastre o novo equipamento separadamente.", 409);
    }
    const write = { ...data, location: data.location || null };
    const after = id ? await tx.devices.update({ where: { id }, data: write, select }) : await tx.devices.create({ data: { ...write, status: "OFFLINE" }, select });
    await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: id ? "UPDATE" : "CREATE", entity: "devices", entityId: after.id, before: auditJson(before), after: auditJson(after) } });
    return after;
  });
  return NextResponse.json(result);
} catch (error) { return peopleError(error); } }
