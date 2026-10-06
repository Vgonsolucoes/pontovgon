import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentFromRequest } from "@/server/lib/agentAuth";
import { prisma } from "@/server/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const heartbeatSchema = z.object({
  version: z.string().min(1).max(50).optional(),
  computerName: z.string().max(150).optional(),
  localIp: z.string().max(80).optional(),
  osVersion: z.string().max(150).optional(),
  deviceStatus: z.enum(["ONLINE", "OFFLINE", "MANUTENCAO", "DESATIVADO"]).optional(),
  deviceLastComm: z.coerce.date().optional(),
  deviceLastSync: z.coerce.date().optional(),
  pendingEvents: z.number().int().nonnegative().default(0),
  agentStatus: z.enum(["ONLINE", "OFFLINE", "SYNCING", "AUTH_ERROR", "API_OFFLINE"]).optional(),
  raw: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authenticateAgentFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const rawBody = await req.json();
    const parsed = heartbeatSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const body = parsed.data;
    const now = new Date();

    const [, heartbeat] = await Promise.all([
      prisma.agents.update({
        where: { id: auth.agent.id },
        data: {
          lastHeartbeatAt: now,
          status: body.agentStatus ?? "ONLINE",
          version: body.version ?? auth.agent.version,
          computerName: body.computerName ?? auth.agent.computerName,
          localIp: body.localIp ?? auth.agent.localIp,
          osVersion: body.osVersion ?? auth.agent.osVersion,
          lastSyncAt: body.deviceLastSync ?? auth.agent.lastSyncAt,
        },
      }),
      prisma.agent_heartbeats.create({
        data: {
          agentId: auth.agent.id,
          version: body.version,
          computerName: body.computerName,
          localIp: body.localIp,
          osVersion: body.osVersion,
          deviceStatus: body.deviceStatus,
          deviceLastComm: body.deviceLastComm,
          deviceLastSync: body.deviceLastSync,
          pendingEvents: body.pendingEvents,
          agentStatus: body.agentStatus,
          raw: (body.raw ?? null) as any,
        },
        select: { id: true, sentAt: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      serverNow: now.toISOString(),
      agentId: auth.agent.id,
      heartbeatId: heartbeat.id,
      nextHeartbeatSec: auth.agent.syncIntervalSec,
      commands: { pollIntervalSec: auth.agent.syncIntervalSec },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to process heartbeat", detail: message }, { status: 500 });
  }
}
