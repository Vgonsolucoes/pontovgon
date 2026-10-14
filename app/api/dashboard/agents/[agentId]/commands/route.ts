import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { audit } from "@/server/lib/audit";

/**
 * Fila de comandos para um VGON PONTO Agent (disparo manual pelo dashboard).
 * O Agent faz poll em /api/agents/commands/next a cada 15s, executa no
 * equipamento/local e devolve o resultado via PATCH — o servidor NUNCA abre
 * conexão com a LAN do cliente (MODELO B).
 */
const commandSchema = z.object({
  commandType: z.enum([
    "SYNC_NOW",
    "TEST_DEVICE",
    "REBOOT_DEVICE",
    "SET_DEVICE_TIME",
    "PULL_ALL_EVENTS",
  ]),
  payload: z.record(z.unknown()).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { agentId: string } },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const role = session.user.role;
  if (!role || !["MASTER", "ADMIN"].includes(role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const agent = await prisma.agents.findFirst({
    where: { id: params.agentId, deletedAt: null },
    select: { id: true, name: true, enabled: true },
  });
  if (!agent) {
    return NextResponse.json({ error: "Agent não encontrado" }, { status: 404 });
  }
  if (!agent.enabled) {
    return NextResponse.json({ error: "Agent desabilitado" }, { status: 409 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = commandSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "payload inválido", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const payload =
    parsed.data.payload ??
    (parsed.data.commandType === "TEST_DEVICE" ? { ping: true } : {});

  const command = await prisma.commands.create({
    data: {
      agentId: agent.id,
      commandType: parsed.data.commandType,
      payload,
      status: "PENDING",
    },
    select: { id: true, commandType: true, status: true, createdAt: true },
  });

  await audit({
    session,
    action: "SYNC",
    entity: "commands",
    entityId: command.id,
    after: {
      agentId: agent.id,
      agentName: agent.name,
      commandType: command.commandType,
      origin: "dashboard-button",
    },
    ip: req.headers.get("x-forwarded-for"),
    userAgent: req.headers.get("user-agent"),
  });

  return NextResponse.json({ ok: true, command });
}
