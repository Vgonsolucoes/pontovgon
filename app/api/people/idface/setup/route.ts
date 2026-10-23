import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { peopleActor, peopleError, PeopleError, validationError, auditJson } from "@/server/lib/people-api";
const schema = z.object({ agentName: z.string().trim().min(2).max(120), deviceName: z.string().trim().min(2).max(120), serialNumber: z.string().trim().min(1).max(120), deviceUniqueId: z.string().trim().min(1).max(120) }).strict();
export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN"]);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const data = parsed.data;
    const result = await prisma.$transaction(async tx => {
      const devices = await tx.devices.findMany({ where: { OR: [{ deviceUniqueId: data.deviceUniqueId }, { serialNumber: data.serialNumber }] } });
      if (devices.length > 1 || devices.some(device => device.deletedAt || device.agentId || device.serialNumber !== data.serialNumber || device.deviceUniqueId !== data.deviceUniqueId)) throw new PeopleError("Este equipamento já possui vínculo ou os identificadores não correspondem. Confira os cadastros existentes.", 409);
      const agent = await tx.agents.create({ data: { name: data.agentName, token: randomBytes(32).toString("hex"), status: "OFFLINE" } });
      const device = devices[0] ? await tx.devices.update({ where: { id: devices[0].id }, data: { agentId: agent.id, name: data.deviceName } }) : await tx.devices.create({ data: { name: data.deviceName, deviceUniqueId: data.deviceUniqueId, serialNumber: data.serialNumber, agentId: agent.id, status: "OFFLINE" } });
      await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "CREATE", entity: "agents", entityId: agent.id, after: auditJson({ name: agent.name, deviceId: device.id }) } });
      return { agentId: agent.id, agentToken: agent.token };
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return peopleError(error); }
}
