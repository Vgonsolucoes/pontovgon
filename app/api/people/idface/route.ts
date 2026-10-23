import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/server/db";
import { peopleActor, peopleError, PeopleError, auditJson, validationError } from "@/server/lib/people-api";
import { facePhoto } from "@/server/lib/face-photo";
import { supportsFaceSync, positiveDeviceUserId } from "@/server/lib/face-sync";
import { isRecentCommunication } from "@/server/lib/operational";
const schema = z.object({ deviceId: z.string().cuid(), employeeIds: z.array(z.string().cuid()).min(1).max(20) }).strict();

export async function GET() {
  try {
    await peopleActor(["MASTER", "ADMIN", "RH"]);
    const [devices, commands] = await Promise.all([
      prisma.devices.findMany({ where: { deletedAt: null }, select: { id: true, name: true, deviceUniqueId: true, serialNumber: true, agent: { select: { enabled: true, deletedAt: true, version: true, lastHeartbeatAt: true } } }, orderBy: { name: "asc" } }),
      prisma.commands.findMany({ where: { commandType: "SYNC_EMPLOYEE" }, select: { id: true, status: true, error: true, createdAt: true, finishedAt: true, payload: true }, orderBy: { createdAt: "desc" }, take: 30 }),
    ]);
    return NextResponse.json({ devices: devices.map(({ agent, ...device }) => ({ ...device, ready: !!agent?.enabled && !agent.deletedAt && supportsFaceSync(agent.version), online: !!agent?.enabled && isRecentCommunication(agent.lastHeartbeatAt), version: agent?.version ?? null })), commands: commands.map(({ payload, ...command }) => { const p = payload as Record<string, unknown> | null; return { ...command, employeeName: typeof p?.name === "string" ? p.name : "Funcionário", deviceId: p?.deviceId }; }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peopleError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const { deviceId, employeeIds } = parsed.data;
    const ids = [...new Set(employeeIds)];
    const queued = await prisma.$transaction(async tx => {
      const device = await tx.devices.findFirst({ where: { id: deviceId, deletedAt: null }, include: { agent: true } });
      if (!device?.deviceUniqueId || !device.agentId || !device.agent?.enabled || device.agent.deletedAt) throw new PeopleError("Vincule este equipamento a um Agent ativo na página Agents");
      if (!supportsFaceSync(device.agent.version)) throw new PeopleError("Atualize o Agent para 1.0.4 ou superior e aguarde o primeiro heartbeat");
      const commands = [];
      for (const employeeId of ids) {
        const employee = await tx.employees.findFirst({ where: { id: employeeId, deletedAt: null } });
        if (!employee || employee.status !== "ATIVO") throw new PeopleError("Somente funcionários ativos podem ser enviados");
        if (!employee.photoUrl) throw new PeopleError(`Cadastre uma foto para ${employee.name} antes de enviar`);
        let photo;
        try { photo = facePhoto(employee.photoUrl); } catch { throw new PeopleError(`Selecione novamente a foto de ${employee.name}`); }
        const links = await tx.device_users.findMany({ where: { deviceId, employeeId, active: true } });
        if (links.length > 1) throw new PeopleError("Há múltiplos vínculos deste funcionário no equipamento; confira o cadastro");
        let expectedUserId;
        try { expectedUserId = positiveDeviceUserId(links[0]?.externalId ?? employee.externalIdDevice); } catch (error) { throw new PeopleError((error as Error).message); }
        const pending = await tx.commands.findFirst({ where: { agentId: device.agentId, commandType: "SYNC_EMPLOYEE", status: { in: ["PENDING", "PROCESSING"] }, AND: [{ payload: { path: ["employeeId"], equals: employeeId } }, { payload: { path: ["deviceId"], equals: deviceId } }] }, select: { id: true, payload: true } });
        if (pending) {
          const snapshot = pending.payload as Record<string, unknown>;
          if (snapshot.imageHash !== photo.hash || snapshot.name !== employee.name || snapshot.registration !== employee.registration) throw new PeopleError("Existe um envio anterior em andamento. Aguarde a conclusão para enviar as alterações.", 409);
          commands.push({ id: pending.id }); continue;
        }
        const payload = { employeeId, deviceId, deviceUniqueId: device.deviceUniqueId, deviceSerialNumber: device.serialNumber, name: employee.name, registration: employee.registration, expectedUserId, imageBase64: photo.base64, imageHash: photo.hash, timestamp: Math.floor(Date.now() / 1000) };
        const command = await tx.commands.create({ data: { agentId: device.agentId, commandType: "SYNC_EMPLOYEE", payload, status: "PENDING" }, select: { id: true } });
        commands.push(command);
      }
      await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "SYNC", entity: "device_users", entityId: deviceId, after: auditJson({ direction: "SYSTEM_TO_IDFACE", employeeIds: ids, commandIds: commands.map(command => command.id) }) } });
      return commands;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    return NextResponse.json({ ok: true, queued: queued.length, message: "Envio enfileirado. Aguarde a confirmação do iDFace no histórico abaixo." });
  } catch (error) { return peopleError(error); }
}
