import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { bankInput, bankLedger, refreshBalances } from "@/server/lib/hour-bank";
import { dateKey, employeeScope, localToday, sheetFilters } from "@/server/lib/attendance";
import { loadTimeSheet } from "@/server/lib/time-sheet";
import { attendanceTransaction } from "@/server/lib/attendance-transaction";
import { auditJson, peopleActor, peopleError, PeopleError, validationError } from "@/server/lib/people-api";
export async function GET(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]), parsed = sheetFilters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const { employeeId, month } = parsed.data, start = month + "-01", end = dateKey(new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)));
    const result = await prisma.$transaction(async tx => {
      const employee = await tx.employees.findFirst({ where: { AND: [{ id: employeeId, deletedAt: null }, employeeScope(actor)] }, select: { name: true, registration: true } });
      if (!employee) throw new PeopleError("Funcionário fora da sua permissão", 404);
      const movements = await tx.hour_bank.findMany({ where: { employeeId, date: { lte: new Date(end + "T00:00:00Z") } }, select: { id: true, date: true, createdAt: true, deltaMinutes: true, origin: true, note: true, needsRecalculation: true, reversalOfId: true }, take: 10001 });
      if (movements.length > 10000) throw new PeopleError("Extrato acima do limite de 10 mil lançamentos; solicite a conferência do histórico.", 422);
      const ledger = bankLedger(movements.map(row => ({ ...row, date: dateKey(row.date), createdAt: row.createdAt.toISOString() })), start, end);
      return { ...ledger, employee, start, end, generatedAt: new Date().toISOString() };
    }, { isolationLevel: "RepeatableRead" });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return peopleError(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH"]), parsed = bankInput.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const value = parsed.data;
    const result = await attendanceTransaction(async tx => {
      let employeeId: string;
      if (value.operation === "calculate") {
        const report = await loadTimeSheet(tx, actor, value.employeeId, value.month);
        if (report.totals.expectedMinutes === null) throw new PeopleError("Vincule uma jornada semanal válida antes de apurar o banco de horas");
        employeeId = value.employeeId;
        let applied = 0, skipped = 0;
        for (const day of report.rows) {
          const calculationKey = `daily:${employeeId}:${day.date}`;
          const before = await tx.hour_bank.findUnique({ where: { calculationKey } });
          if (day.balanceMinutes === null) {
            if (before) await tx.hour_bank.update({ where: { id: before.id }, data: { needsRecalculation: true } });
            if (day.date < localToday()) skipped++;
            continue;
          }
          const workDay = await tx.work_days.upsert({ where: { employeeId_date: { employeeId, date: new Date(day.date + "T00:00:00Z") } }, create: { employeeId, date: new Date(day.date + "T00:00:00Z"), expectedMinutes: day.expectedMinutes!, workedMinutes: day.workedMinutes!, dailyBalanceMinutes: day.balanceMinutes, overtimeMinutes: Math.max(0, day.balanceMinutes), debitMinutes: Math.max(0, -day.balanceMinutes), recalculatedAt: new Date(), note: "Conferência pela jornada atual" }, update: { expectedMinutes: day.expectedMinutes!, workedMinutes: day.workedMinutes!, dailyBalanceMinutes: day.balanceMinutes, overtimeMinutes: Math.max(0, day.balanceMinutes), debitMinutes: Math.max(0, -day.balanceMinutes), hasIncompleteRecords: false, recalculatedAt: new Date(), note: "Conferência pela jornada atual" } });
          if (before || day.balanceMinutes !== 0) {
            const after = await tx.hour_bank.upsert({ where: { calculationKey }, create: { employeeId, date: workDay.date, origin: "DAILY_CALC", calculationKey, workDayId: workDay.id, deltaMinutes: day.balanceMinutes, balanceMinutes: 0, createdById: actor.id, note: `Apuração diária: ${report.employee.schedule}` }, update: { deltaMinutes: day.balanceMinutes, workDayId: workDay.id, needsRecalculation: false, note: `Apuração diária: ${report.employee.schedule}` } });
            if (!before || before.deltaMinutes !== after.deltaMinutes || before.needsRecalculation) await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "ADJUST", entity: "hour_bank", entityId: after.id, before: auditJson(before), after: auditJson(after) } });
          }
          applied++;
        }
        await refreshBalances(tx, employeeId);
        await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "ADJUST", entity: "hour_bank_calculation", entityId: employeeId, after: auditJson({ month: value.month, applied, skipped, schedule: report.employee.schedule }) } });
        return { message: `Apuração concluída: ${applied} dia(s) encerrado(s); ${skipped} dia(s) pendente(s). Reapurar substitui o cálculo diário anterior e não duplica o saldo.` };
      }
      if (value.operation === "manual") {
        employeeId = value.employeeId;
        if (value.date > localToday()) throw new PeopleError("Não é permitido lançar movimentações futuras");
        if (!await tx.employees.findFirst({ where: { id: employeeId, deletedAt: null }, select: { id: true } })) throw new PeopleError("Funcionário não encontrado", 404);
        const calculationKey = `manual:${value.submissionKey}`;
        const existing = await tx.hour_bank.findUnique({ where: { calculationKey } });
        if (existing) {
          if (existing.employeeId !== employeeId || existing.deltaMinutes !== value.minutes || dateKey(existing.date) !== value.date || existing.note !== value.reason) throw new PeopleError("A referência deste lançamento já foi utilizada com outros dados", 409);
          return { message: "Este lançamento já foi registrado." };
        }
        const after = await tx.hour_bank.create({ data: { employeeId, date: new Date(value.date + "T00:00:00Z"), deltaMinutes: value.minutes, balanceMinutes: 0, origin: "MANUAL_ADJUST", calculationKey, createdById: actor.id, note: value.reason } });
        await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "ADJUST", entity: "hour_bank", entityId: after.id, after: auditJson(after) } });
      } else {
        const original = await tx.hour_bank.findUnique({ where: { id: value.id } });
        if (!original || original.origin !== "MANUAL_ADJUST") throw new PeopleError("Somente lançamentos manuais podem ser estornados. Para cálculos diários, ajuste as batidas e reapure o mês.");
        employeeId = original.employeeId;
        if (await tx.hour_bank.findUnique({ where: { reversalOfId: original.id } })) return { message: "Este lançamento já foi estornado." };
        const after = await tx.hour_bank.create({ data: { employeeId, date: new Date(localToday() + "T00:00:00Z"), deltaMinutes: -original.deltaMinutes, balanceMinutes: 0, origin: "REVERSAL", reversalOfId: original.id, note: value.reason, createdById: actor.id } });
        await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "ADJUST", entity: "hour_bank", entityId: after.id, before: auditJson(original), after: auditJson(after) } });
      }
      await refreshBalances(tx, employeeId);
      return { message: value.operation === "manual" ? "Movimentação registrada com justificativa." : "Estorno registrado na data de hoje; o lançamento original foi preservado." };
    });
    return NextResponse.json(result);
  } catch (error) { return peopleError(error); }
}
