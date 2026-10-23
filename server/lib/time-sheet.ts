import type { Prisma } from "@prisma/client";
import type { PeopleActor } from "./people";
import { PeopleError } from "./people-api";
import { addDays, buildSheet, dateKey, employeeScope } from "./attendance";
export async function loadTimeSheet(tx: Prisma.TransactionClient, actor: PeopleActor, employeeId: string, month: string) {
  const start = month + "-01", end = dateKey(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)));

      const employee = await tx.employees.findFirst({ where: { AND: [{ id: employeeId, deletedAt: null }, employeeScope(actor)] }, select: {
        id: true, name: true, registration: true, admissionDate: true, department: { select: { name: true } },
        workSchedule: { select: { name: true, model: true, deletedAt: true, toleranceMinutes: true, days: { select: { weekday: true, isDayOff: true, entryTime: true, breakStartTime: true, breakEndTime: true, departureTime: true } } } },
      } });
      if (!employee) throw new PeopleError("Funcionário não encontrado ou fora da sua permissão", 404);
      const range = { gte: new Date(addDays(start, -1) + "T00:00:00Z"), lte: new Date(addDays(end, 1) + "T00:00:00Z") };
      const [entries, holidays, vacations, leaves] = await Promise.all([
        tx.time_entries.findMany({ where: { employeeId, date: range, status: { not: "EXCLUIDO_LOGICAMENTE" } }, select: { id: true, date: true, time: true, timestamp: true, kind: true, status: true, origin: true, reviewFlags: true }, take: 10001 }),
        tx.holidays.findMany({ where: { OR: [{ date: range }, { recurring: true }] }, select: { date: true, recurring: true } }),
        tx.vacations.findMany({ where: { employeeId, status: "APROVADO", startDate: { lte: range.lte }, endDate: { gte: range.gte } }, select: { startDate: true, endDate: true } }),
        tx.leaves.findMany({ where: { employeeId, status: "APROVADO", startDate: { lte: range.lte }, endDate: { gte: range.gte } }, select: { startDate: true, endDate: true, hoursCount: true } }),
      ]);
      if (entries.length > 10000) throw new PeopleError("Há mais de 10 mil batidas no mês. Confira a importação antes de gerar o espelho.", 422);

    const schedule = employee.workSchedule?.deletedAt ? null : employee.workSchedule;
    const report = buildSheet({ month, schedule, admissionDate: employee.admissionDate ? dateKey(employee.admissionDate) : null,
      entries: entries.map(entry => ({ ...entry, date: dateKey(entry.date), timestamp: entry.timestamp?.toISOString() ?? null })),
      holidays: holidays.map(holiday => holiday.recurring ? month.slice(0, 4) + dateKey(holiday.date).slice(4) : dateKey(holiday.date)),
      absences: [...vacations.map(item => ({ start: dateKey(item.startDate), end: dateKey(item.endDate), label: "Férias aprovadas", partial: false })), ...leaves.map(item => ({ start: dateKey(item.startDate), end: dateKey(item.endDate), label: "Afastamento aprovado", partial: item.hoursCount > 0 }))],
    });
return { ...report, employee: { id: employee.id, name: employee.name, registration: employee.registration, department: employee.department?.name ?? null, schedule: schedule?.name ?? null } };
}
