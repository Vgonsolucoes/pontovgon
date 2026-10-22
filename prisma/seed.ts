import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  const email = process.env.SEED_MASTER_EMAIL?.trim().toLowerCase();
  const name = process.env.SEED_MASTER_NAME?.trim();
  const password = process.env.SEED_MASTER_PASSWORD;
  if (!email || !name || !password || password.length < 12) throw new Error("Bootstrap exige email, nome e senha explícitos (mínimo 12 caracteres).");
  // Never modify existing credentials, roles, activation or operational records.
  await prisma.users.upsert({ where: { email }, update: {}, create: {
    email, name, passwordHash: await bcrypt.hash(password, 12), role: "MASTER", active: true,
  } });
}
main().catch(error => { console.error("Bootstrap falhou:", error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
