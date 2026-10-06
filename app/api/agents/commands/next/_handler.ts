import { authenticateAgentFromRequest } from "@/server/lib/agentAuth";
import { prisma } from "@/server/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = await authenticateAgentFromRequest(req as any);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const now = new Date();
    const command = await prisma.$transaction(async (tx) => {
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
    });

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
