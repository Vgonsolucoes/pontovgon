import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import type { Prisma } from "@prisma/client";
import { addDays, dateKey, zone } from "./attendance";
import { scheduleInput } from "./work-schedules";
export const policyDefaults = { windowEnabled: true, minutesBefore: 30, minutesAfter: 30, duplicateMinutes: 2 };
export const policyInput = z.object({ windowEnabled: z.boolean(), minutesBefore: z.number().int().min(0).max(240), minutesAfter: z.number().int().min(0).max(240), duplicateMinutes: z.number().int().min(0).max(30) }).strict();
export type AttendancePolicy = z.infer<typeof policyInput>;
type PolicySchedule = { name: string; model: string; toleranceMinutes: number; days: { weekday: number; isDayOff: boolean; entryTime: string | null; departureTime: string | null; breakStartTime: string | null; breakEndTime: string | null }[] };
export const localInstant = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, zone);
export function insideWindow(date: string, time: string, schedule: PolicySchedule | null, policy: AttendancePolicy): boolean {
  if (!policy.windowEnabled) return true;
  if (!schedule || !scheduleInput.safeParse({ name: schedule.name, model: schedule.model, toleranceMinutes: schedule.toleranceMinutes, days: schedule.days.map(day => ({ weekday: day.weekday, isDayOff: day.isDayOff, entryTime: day.entryTime, departureTime: day.departureTime, breakStartTime: day.breakStartTime, breakEndTime: day.breakEndTime })), active: true, observations: "" }).success) return false;
  const value = localInstant(date, time).getTime();
  return [-1, 0, 1].some(offset => {
    const anchor = addDays(date, offset), day = schedule.days.find(item => item.weekday === new Date(anchor + "T12:00:00Z").getUTCDay());
    if (!day || day.isDayOff || !day.entryTime || !day.departureTime) return false;
    const start = localInstant(anchor, day.entryTime).getTime() - policy.minutesBefore * 60000;
    const endDate = day.departureTime < day.entryTime ? addDays(anchor, 1) : anchor;
    const end = localInstant(endDate, day.departureTime).getTime() + policy.minutesAfter * 60000;
    return value >= start && value <= end;
  });
}
export async function loadPolicy(tx: Prisma.TransactionClient) { return await tx.attendance_settings.findUnique({ where: { id: "default" } }) ?? policyDefaults; }
export async function nearbyEntry(tx: Prisma.TransactionClient, employeeId: string, date: string, time: string, minutes: number, excludeId?: string) {
  const candidates = await tx.time_entries.findMany({ where: { employeeId, date: { gte: new Date(addDays(date, -1) + "T00:00:00Z"), lte: new Date(addDays(date, 1) + "T00:00:00Z") }, status: { not: "EXCLUIDO_LOGICAMENTE" }, NOT: { reviewFlags: { has: "DUPLICATE" } }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { id: true, date: true, time: true }, orderBy: { importedAt: "asc" } });
  const instant = localInstant(date, time).getTime();
  return candidates.find(entry => Math.abs(localInstant(dateKey(entry.date), entry.time).getTime() - instant) <= minutes * 60000) ?? null;
}
export async function invalidateBank(tx: Prisma.TransactionClient, employeeId: string, dates: string[]) {
  const affected = [...new Set(dates.flatMap(date => [date, addDays(date, -1)]))];
  await tx.hour_bank.updateMany({ where: { employeeId, origin: "DAILY_CALC", date: { in: affected.map(date => new Date(date + "T00:00:00Z")) } }, data: { needsRecalculation: true } });
}
