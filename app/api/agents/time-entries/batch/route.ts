import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentFromRequest } from "@/server/lib/agentAuth";
import { prisma } from "@/server/db";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const timeEntrySchema = z.object({
  externalEventId: z.string().min(1).max(120),
  deviceId: z.string().min(1).max(120).optional(),
  employeeExternalId: z.string().max(120).optional(),
  employeeId: z.string().max(60).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{1,2}:\d{2}(:\d{2})?$/),
  timestamp: z.coerce.date().optional(),
  kind: z.string().max(40).optional(),
  origin: z.enum(["IDFACE", "MANUAL", "ADMINISTRATIVO", "WEB"]).default("IDFACE"),
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

export async function POST(req: NextRequest) {
  const auth = await authenticateAgentFromRequest(req);
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

    const deviceCode = body.deviceUniqueId ?? body.deviceSerialNumber ?? "iDFace-" + auth.agent.id;
    const where = body.deviceUniqueId
      ? { deviceUniqueId: body.deviceUniqueId }
      : body.deviceSerialNumber
        ? { serialNumber: body.deviceSerialNumber }
        : { id: "default-device-id" };
    const upsertById = !body.deviceUniqueId && !body.deviceSerialNumber;

    const deviceRecord = upsertById
      ? await prisma.devices.upsert({
          where: { id: (await prisma.devices.findFirst({ where: { agentId: auth.agent.id }, take: 1, select: { id: true } }))?.id ?? "000000000000000000000000000000000001" },
          create: {
            deviceUniqueId: deviceCode,
            serialNumber: deviceCode.slice(0, 100),
            name: `Device ${deviceCode.slice(0, 40)}`,
            manufacturer: "Control ID",
            model: "iDFace",
            status: "ONLINE",
            agentId: auth.agent.id,
          },
          update: {
            lastCommunication: startedAt,
          },
          select: { id: true, deviceUniqueId: true, serialNumber: true },
        })
      : await prisma.devices.upsert({
          where,
          create: {
            deviceUniqueId: body.deviceUniqueId ?? deviceCode,
            serialNumber: body.deviceSerialNumber ?? deviceCode.slice(0, 100),
            name: `Device ${deviceCode.slice(0, 40)}`,
            manufacturer: "Control ID",
            model: "iDFace",
            status: "ONLINE",
            agentId: auth.agent.id,
          },
          update: {
            lastCommunication: startedAt,
            agentId: auth.agent.id,
          },
          select: { id: true, deviceUniqueId: true, serialNumber: true },
        });

    let created = 0;
    let duplicated = 0;
    let failed = 0;
    const failedItems: Array<{ idx: number; externalEventId: string; error: string }> = [];

    const results = await Promise.allSettled(
      body.items.map(async (item, idx) => {
        const data: Prisma.time_entriesCreateInput = {
          externalEventId: item.externalEventId,
          date: new Date(item.date + "T00:00:00Z"),
          time: item.time.length === 5 ? item.time : item.time.slice(0, 5),
          timestamp: item.timestamp,
          kind: item.kind,
          origin: item.origin,
          originalEventRef: item.originalEventRef ?? item.externalEventId,
          note: item.note,
          device: { connect: { id: deviceRecord.id } },
        };
        if (item.employeeId) {
          data.employee = { connect: { id: item.employeeId } };
        }
        try {
          await prisma.time_entries.create({ data, select: { id: true } });
          created += 1;
        } catch (err) {
          const code = (err as { code?: string })?.code;
          if (code === "P2002") {
            duplicated += 1;
          } else {
            failed += 1;
            failedItems.push({
              idx,
              externalEventId: item.externalEventId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }),
    );
    void results;

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
      failedItems: failedItems.slice(0, 50),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to import batch", detail: message }, { status: 500 });
  }
}
