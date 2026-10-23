import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
export async function attendanceTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(work, { isolationLevel: "Serializable", timeout: 30000 }); }
    catch (error) { if ((error as { code?: string })?.code !== "P2034" || attempt >= 3) throw error; }
  }
}
