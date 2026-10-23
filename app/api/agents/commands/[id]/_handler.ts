import { authenticateAgentFromRequest } from "@/server/lib/agentAuth";
import { prisma } from "@/server/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { confirmedEnrollment, enrollmentMetadata } from "@/server/lib/face-sync";

const patchSchema = z.object({
  status: z.enum(["SUCCESS", "FAILED"]),
  result: z.record(z.string(), z.any()).optional().nullable(),
  error: z.string().max(4000).optional().nullable(),
});

export async function PATCH(
  req: Request,
  segment: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateAgentFromRequest(req as any);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await segment.params;
    const bodyRaw = await req.json();
    const parsed = patchSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const now = new Date();
    const body = parsed.data;
    const existing = await prisma.commands.findUnique({ where: { id } });
    if (!existing || existing.agentId !== auth.agent.id) {
      return Response.json(
        { error: "Command not found or not owned by this agent" },
        { status: 404 },
      );
    }
    const final = await prisma.$transaction(async tx => {
      const command = await tx.commands.findUnique({ where: { id } });
      if (!command || command.agentId !== auth.agent.id) throw new Error("Comando não encontrado");
      if (command.status === "SUCCESS" || command.status === "FAILED") return { id: command.id, status: command.status, finishedAt: command.finishedAt };
      let status = body.status;
      let error = body.error ?? null;
      let payload = command.payload;
      let result = (body.result ?? null) as Prisma.InputJsonValue | null;
      if (command.commandType === "SYNC_EMPLOYEE") {
        const p = command.payload as Record<string, unknown>;
        const valid = confirmedEnrollment(p, body.result, body.status === "SUCCESS");
        const device = typeof p.deviceId === "string" ? await tx.devices.findFirst({ where: { id: p.deviceId, agentId: auth.agent.id, deviceUniqueId: String(p.deviceUniqueId), serialNumber: String(p.deviceSerialNumber), deletedAt: null } }) : null;
        const employee = typeof p.employeeId === "string" ? await tx.employees.findFirst({ where: { id: p.employeeId, deletedAt: null } }) : null;
        if (valid && device && employee) {
          const externalId = String(body.result!.userId);
          const link = await tx.device_users.findUnique({ where: { deviceId_externalId: { deviceId: device.id, externalId } } });
          const other = await tx.device_users.findFirst({ where: { deviceId: device.id, employeeId: employee.id, active: true, externalId: { not: externalId } } });
          if ((link?.employeeId && link.employeeId !== employee.id) || other) {
            status = "FAILED"; error = "ID do equipamento já vinculado a outro cadastro; confira os vínculos";
          } else {
            const photoRegistered = body.result!.photoRegistered === true;
            await tx.device_users.upsert({ where: { deviceId_externalId: { deviceId: device.id, externalId } }, create: { deviceId: device.id, externalId, employeeId: employee.id, active: true, biometricsRegistered: photoRegistered, lastSyncAt: photoRegistered ? now : null }, update: { employeeId: employee.id, active: true, ...(photoRegistered ? { biometricsRegistered: true, lastSyncAt: now } : {}) } });
            if (!employee.externalIdDevice) await tx.employees.update({ where: { id: employee.id }, data: { externalIdDevice: externalId } });
          }
        } else if (status === "SUCCESS") { status = "FAILED"; error = "O resultado não confirma o funcionário, a foto e o equipamento esperados"; }
        payload = enrollmentMetadata(p) as Prisma.JsonObject;
        result = body.result ? { userConfirmed: valid, photoRegistered: valid && body.result.photoRegistered === true, userId: valid ? String(body.result.userId) : null, imageHash: String(p.imageHash ?? "") } : null;
      }
      return tx.commands.update({
      where: { id },
      data: {
        status,
        payload: payload ?? Prisma.JsonNull,
        result: result ?? Prisma.JsonNull,
        error,
        finishedAt: now,
      },
      select: { id: true, status: true, finishedAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return Response.json({ ok: true, command: final });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      { error: "Failed to update command", detail: message },
      { status: 500 },
    );
  }
}
