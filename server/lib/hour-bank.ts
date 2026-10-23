import { z } from "zod";
import type { Prisma } from "@prisma/client";
export async function refreshBalances(tx: Prisma.TransactionClient, employeeId: string) {
  await tx.$executeRaw`WITH balances AS (SELECT "id", SUM("deltaMinutes") OVER (ORDER BY "date", "createdAt", "id")::integer AS value FROM "hour_bank" WHERE "employeeId" = ${employeeId}) UPDATE "hour_bank" h SET "balanceMinutes" = b.value FROM balances b WHERE h."id" = b."id" AND h."balanceMinutes" <> b.value`;
}
const reason = z.string().trim().min(10, "Informe uma justificativa de pelo menos 10 caracteres").max(2000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => !isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value, "Data inválida");
export const bankInput = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("calculate"), employeeId: z.string().cuid(), month: z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/) }).strict(),
  z.object({ operation: z.literal("manual"), employeeId: z.string().cuid(), date, minutes: z.number().int().min(-44640).max(44640).refine(value => value !== 0, "Informe um crédito ou débito diferente de zero"), reason, submissionKey: z.string().uuid() }).strict(),
  z.object({ operation: z.literal("reverse"), id: z.string().cuid(), reason }).strict(),
]);
export type BankMovement = { id: string; date: string; createdAt: string; deltaMinutes: number; origin: string; note: string | null; needsRecalculation: boolean; reversalOfId: string | null };
export function bankLedger(movements: BankMovement[], start: string, end: string) {
  let balance = 0, opening = 0;
  const rows: (BankMovement & { balanceMinutes: number })[] = [];
  for (const movement of [...movements].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
    if (movement.date > end) continue;
    balance += movement.deltaMinutes;
    if (movement.date < start) opening = balance;
    else rows.push({ ...movement, balanceMinutes: balance });
  }
  return { rows, openingBalance: opening, closingBalance: balance, creditMinutes: rows.reduce((sum, row) => sum + Math.max(0, row.deltaMinutes), 0), debitMinutes: rows.reduce((sum, row) => sum + Math.min(0, row.deltaMinutes), 0), pendingRecalculation: movements.filter(row => row.date <= end && row.needsRecalculation).length };
}
