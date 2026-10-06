import { NextRequest, NextResponse } from "next/server";
import { authenticateAgentFromRequest } from "@/server/lib/agentAuth";
import { prisma } from "@/server/db";
import { z } from "zod";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["SUCCESS", "FAILED"]),
  result: z.record(z.string(), z.any()).optional().nullable(),
  error: z.string().max(4000).optional().nullable(),
});

type Params = Promise<{ id: string }>;

export async function PATCH(req: NextRequest, segment: { params: Params }) {
  const auth = await authenticateAgentFromRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  try {
    const { id } = await segment.params;
    const bodyRaw = await req.json();
    const parsed = patchSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const now = new Date();
    const body = parsed.data;
    const existing = await prisma.commands.findUnique({ where: { id } });
    if (!existing || existing.agentId !== auth.agent.id) {
      return NextResponse.json({ error: "Command not found or not owned by this agent" }, { status: 404 });
    }
    const final = await prisma.commands.update({
      where: { id },
      data: {
        status: body.status,
        result: body.result ?? Prisma.JsonNull,
        error: body.error ?? null,
        finishedAt: now,
      },
      select: { id: true, status: true, finishedAt: true },
    });
    return NextResponse.json({ ok: true, command: final });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Failed to update command", detail: message }, { status: 500 });
  }
}
