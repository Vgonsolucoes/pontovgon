import { authenticateAgentFromRequest } from "@/server/lib/agentAuth";
import { prisma } from "@/server/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { enrollmentMetadata } from "@/server/lib/face-sync";

export async function GET(req: Request) {
  const auth = await authenticateAgentFromRequest(req as any);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const now = new Date();
    const command = await prisma.$transaction(async tx => {
      await tx.commands.updateMany({ where: { agentId: auth.agent.id, commandType: "SYNC_EMPLOYEE", status: "PROCESSING", pickedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) }, attempts: { lt: 5 } }, data: { status: "PENDING", pickedAt: null } });
      const expired = await tx.commands.findMany({ where: { agentId: auth.agent.id, commandType: "SYNC_EMPLOYEE", status: "PROCESSING", pickedAt: { lt: new Date(now.getTime() - 10 * 60 * 1000) }, attempts: { gte: 5 } }, take: 20 });
      for (const item of expired) await tx.commands.update({ where: { id: item.id }, data: { status: "FAILED", error: "Tempo de execução excedido após cinco tentativas", finishedAt: now, payload: enrollmentMetadata(item.payload as Record<string, unknown>) as Prisma.JsonObject } });
      const pending = await tx.commands.findFirst({
        where: { agentId: auth.agent.id, status: "PENDING" },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
      });
      if (!pending) return null;
      return tx.commands.update({
        where: { id: pending.id },
        data: {
          status: "PROCESSING",
          pickedAt: now,
          attempts: { increment: 1 },
        },
        select: {
          id: true,
          commandType: true,
          payload: true,
          createdAt: true,
          attempts: true,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      ok: true,
      command,
      serverNow: now.toISOString(),
      pollIntervalSec: auth.agent.syncIntervalSec,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to poll commands", detail: message },
      { status: 500 },
    );
  }
}
