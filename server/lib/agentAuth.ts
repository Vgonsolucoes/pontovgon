import { NextRequest } from "next/server";
import { prisma } from "@/server/db";
import type { agents } from "@prisma/client";

export type AuthenticatedAgent = agents;

export async function authenticateAgentFromRequest(
  req: NextRequest,
): Promise<{ ok: true; agent: AuthenticatedAgent } | { ok: false; status: number; error: string }> {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return {
      ok: false,
      status: 401,
      error: "Missing or invalid Authorization header. Expected: Bearer <AGENT_TOKEN>",
    };
  }
  const token = match[1].trim();
  if (!token) {
    return { ok: false, status: 401, error: "Empty agent token" };
  }
  const agent = await prisma.agents.findFirst({ where: { token, enabled: true, deletedAt: null } });
  if (!agent) {
    return { ok: false, status: 401, error: "Invalid agent token or agent disabled" };
  }
  return { ok: true, agent };
}
