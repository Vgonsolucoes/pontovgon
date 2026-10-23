import { authenticateAgentFromRequest } from "@/server/lib/agentAuth";
import { prisma } from "@/server/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { attendanceTransaction } from "@/server/lib/attendance-transaction";
import { loadPolicy, insideWindow, nearbyEntry, invalidateBank } from "@/server/lib/attendance-policy";

const timeEntrySchema = z.object({
  externalEventId: z.string().min(1).max(120),
  deviceId: z.string().min(1).max(120).optional(),
  employeeExternalId: z.string().max(120).optional(),
  employeeId: z.string().max(60).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/),
  timestamp: z.coerce.date().optional(),
  kind: z.string().max(40).optional(),
  origin: z.literal("IDFACE").default("IDFACE"),
  originalEventRef: z.string().max(255).optional(),
  note: z.string().max(500).optional(),
});

const batchSchema = z.object({
  deviceUniqueId: z.string().min(1).max(120).optional(),
  deviceSerialNumber: z.string().min(1).max(120).optional(),
  syncId: z.string().max(80).optional(),
  startedAt: z.coerce.date().optional(),
  items: z.array(timeEntrySchema).min(1).max(1000),
});

export async function POST(req: Request) {
  const auth = await authenticateAgentFromRequest(req as any);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const rawBody = await req.json();
    const parsed = batchSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const startedAt = body.startedAt ?? new Date();

    if (!body.deviceUniqueId && !body.deviceSerialNumber) return NextResponse.json({ error: "Identificação do equipamento obrigatória" }, { status: 400 });
    const deviceRecord = await prisma.devices.findFirst({ where: {
      agentId: auth.agent.id, deletedAt: null,
      ...(body.deviceUniqueId ? { deviceUniqueId: body.deviceUniqueId } : {}),
      ...(body.deviceSerialNumber ? { serialNumber: body.deviceSerialNumber } : {}),
    }, select: { id: true, deviceUniqueId: true, serialNumber: true } });
    if (!deviceRecord) return NextResponse.json({ error: "Equipamento não cadastrado ou não vinculado a este Agent" }, { status: 403 });

    let created = 0;
    let duplicated = 0;
    let failed = 0;
    const failedItems: Array<{
      idx: number;
      externalEventId: string;
      error: string;
    }> = [];

    for (const [idx, item] of body.items.entries()) {
        const data = {
          externalEventId: item.externalEventId,
          date: new Date(item.date + "T00:00:00Z"),
          time: item.time.length === 5 ? item.time : item.time.slice(0, 5),
          timestamp: item.timestamp,
          kind: item.kind,
          origin: item.origin,
          originalEventRef: item.originalEventRef ?? item.externalEventId,
          note: item.note,
          device: { connect: { id: deviceRecord.id } },
        } as any;
        try {
          if (item.externalEventId.startsWith("MOCK-")) throw new Error("Evento simulado não permitido");
          if (new Date(item.date + "T00:00:00Z").toISOString().slice(0, 10) !== item.date) throw new Error("Data inválida");
          // Resolve identity from the registered device mapping, never trust a caller-supplied employee UUID.
          await attendanceTransaction(async tx => {
            const existing = await tx.time_entries.findUnique({ where: { deviceId_externalEventId: { deviceId: deviceRecord.id, externalEventId: item.externalEventId } }, select: { id: true } });
            if (existing) return false;
            const link = item.employeeExternalId ? await tx.device_users.findUnique({ where: { deviceId_externalId: { deviceId: deviceRecord.id, externalId: item.employeeExternalId } }, include: { employee: { include: { workSchedule: { include: { days: true } } } } } }) : null;
            const employee = link?.employee && !link.employee.deletedAt ? link.employee : null;
            const policy = await loadPolicy(tx), flags: string[] = [];
            const duplicate = employee ? await nearbyEntry(tx, employee.id, item.date, data.time, policy.duplicateMinutes) : null;
            if (duplicate) flags.push("DUPLICATE");
            if (!employee) flags.push("UNLINKED");
            else if (!insideWindow(item.date, data.time, employee.workSchedule?.deletedAt ? null : employee.workSchedule, policy)) flags.push("OUTSIDE_WINDOW");
            await tx.time_entries.create({ data: { ...data, ...(employee ? { employee: { connect: { id: employee.id } } } : {}), originalEventRef: JSON.stringify({ employeeExternalId: item.employeeExternalId ?? null, eventRef: item.originalEventRef ?? item.externalEventId }), reviewFlags: flags, duplicateOfId: duplicate?.id ?? null, status: flags.length ? "INCONSISTENTE" : "VALIDO" }, select: { id: true } });
            if (employee) await invalidateBank(tx, employee.id, [item.date]);
            return true;
          }).then(inserted => { if (!inserted) duplicated += 1; else created += 1; });
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === "P2002") {
            const original = await prisma.time_entries.findUnique({ where: { deviceId_externalEventId: { deviceId: deviceRecord.id, externalEventId: item.externalEventId } }, select: { id: true } });
            if (original) duplicated += 1;
            else {
              failed += 1;
              failedItems.push({ idx, externalEventId: item.externalEventId, error: "Conflito de unicidade sem evento correspondente; preservado na fila para conciliação" });
            }
          } else {
            failed += 1;
            failedItems.push({
              idx,
              externalEventId: item.externalEventId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
    }

    const finishedAt = new Date();
    const status = failed > 0 ? (created > 0 || duplicated > 0 ? "PARTIAL" : "FAILED") : "SUCCESS";
    const syncLog = await prisma.device_sync_logs.create({
      data: {
        agentId: auth.agent.id,
        deviceId: deviceRecord.id,
        startedAt,
        finishedAt,
        eventsCount: body.items.length,
        newEvents: created,
        duplicate: duplicated,
        failed,
        status,
        error: failedItems.length > 0 ? JSON.stringify(failedItems).slice(0, 10000) : null,
      },
      select: { id: true },
    });

    await prisma.agents.update({
      where: { id: auth.agent.id },
      data: { lastSyncAt: finishedAt },
    });

    return NextResponse.json({
      ok: true,
      syncLogId: syncLog.id,
      serverNow: finishedAt.toISOString(),
      received: body.items.length,
      created,
      duplicated,
      failed,
      failedItems,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to import batch", detail: message },
      { status: 500 },
    );
  }
}
