import type { NextApiRequest, NextApiResponse } from "next";

// ENDPOINT TEMPORARIO DE DIAGNOSTICO — REMOVER APOS RESOLVER O LOGIN.
// Protegido por header x-debug-token = AUTH_SECRET (nao expor publicamente).
const CANDIDATES = [
  "Admin@123",
  "Mudar@123",
  "admin",
  "master",
  "Master@123",
  "Vgon@123",
  "Vgon@2026",
  "Vgon2026",
  "Ponto@123",
  "123456",
  "Vgon2026!Ponto_Seguro#PgF8x4",
];

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
    seedPasswordLen: process.env.SEED_MASTER_PASSWORD ? process.env.SEED_MASTER_PASSWORD.length : null,
  };

  try {
    const { prisma } = await import("@/server/db");
    const bcrypt = (await import("bcryptjs")).default;
    const ping = await prisma.$queryRaw`SELECT 1 AS ok`;
    const users = await prisma.users.count();
    const email = (process.env.SEED_MASTER_EMAIL ?? "master@vgon.com.br").toLowerCase();
    const master = await prisma.users.findUnique({
      where: { email },
      select: { id: true, email: true, active: true, role: true, passwordHash: true },
    });

    // Testa senhas candidatas contra o hash real
    let candidates: Record<string, boolean> | undefined;
    if (master?.passwordHash) {
      candidates = {};
      for (const c of CANDIDATES) {
        candidates[c] = await bcrypt.compare(c, master.passwordHash);
      }
      // Tambem testa o valor literal da env var, se existir
      const envPw = process.env.SEED_MASTER_PASSWORD;
      if (envPw && !(envPw in candidates)) {
        candidates["<ENV_SEED_MASTER_PASSWORD>"] = await bcrypt.compare(envPw, master.passwordHash);
      }
    }

    // Acao de reset: ?action=reset-master&pw=NovaSenha
    let resetResult: Record<string, unknown> | undefined;
    if (req.query.action === "reset-master" && typeof req.query.pw === "string" && req.query.pw.length >= 6) {
      const newHash = await bcrypt.hash(req.query.pw, 10);
      await prisma.users.update({ where: { email }, data: { passwordHash: newHash, active: true, deletedAt: null } });
      const check = await bcrypt.compare(req.query.pw, newHash);
      resetResult = { done: true, verifyCompare: check, newHashPrefix: newHash.slice(0, 7) };
    }

    res.status(200).json({
      ok: true,
      ...info,
      ping,
      usersCount: users,
      master: master
        ? { id: master.id, email: master.email, active: master.active, role: master.role, hashPrefix: master.passwordHash?.slice(0, 7) }
        : null,
      candidates,
      resetResult,
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
