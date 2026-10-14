import type { NextApiRequest, NextApiResponse } from "next";

// ENDPOINT TEMPORARIO DE DIAGNOSTICO — REMOVER APOS RESOLVER O 500 DO LOGIN.
// Protegido por header x-debug-token = AUTH_SECRET (nao expor publicamente).
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = req.headers["x-debug-token"];
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret || token !== secret) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const info: Record<string, unknown> = {
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    databaseUrlHost: (() => {
      try {
        return new URL(process.env.DATABASE_URL ?? "").hostname;
      } catch (e) {
        return `URL_PARSE_ERROR: ${e instanceof Error ? e.message : String(e)}`;
      }
    })(),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    seedEmail: process.env.SEED_MASTER_EMAIL ?? null,
  };

  try {
    const { prisma } = await import("@/server/db");
    const ping = await prisma.$queryRaw`SELECT 1 AS ok`;
    const users = await prisma.users.count();
    const master = await prisma.users.findUnique({
      where: { email: (process.env.SEED_MASTER_EMAIL ?? "master@vgon.com.br").toLowerCase() },
      select: { id: true, email: true, active: true, role: true, passwordHash: true },
    });
    res.status(200).json({
      ok: true,
      ...info,
      ping,
      usersCount: users,
      master: master
        ? { id: master.id, email: master.email, active: master.active, role: master.role, hashPrefix: master.passwordHash?.slice(0, 7) }
        : null,
    });
  } catch (err) {
    res.status(200).json({
      ok: false,
      ...info,
      errorName: err instanceof Error ? err.name : typeof err,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack?.slice(0, 1500) : undefined,
    });
  }
}
