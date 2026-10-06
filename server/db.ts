import { PrismaClient } from "@prisma/client";
import { TIMEZONE } from "@/lib/utils";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, p) {
    const client = getPrisma();
    const val = (client as unknown as Record<string | symbol, unknown>)[p];
    return typeof val === "function" ? (val as Function).bind(client) : val;
  },
});

if (process.env.NODE_ENV !== "production") void getPrisma();

export { TIMEZONE };
export type { PrismaClient };

export async function pingDatabase() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
