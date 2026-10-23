import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { adjustmentInput } from "@/server/lib/adjustment-input";
import { employeeScope, dateKey, localToday, sheetFilters, addDays } from "@/server/lib/attendance";
import { insideWindow, invalidateBank, loadPolicy, localInstant, nearbyEntry } from "@/server/lib/attendance-policy";
import { attendanceTransaction } from "@/server/lib/attendance-transaction";
import { auditJson, peopleActor, peopleError, PeopleError, validationError } from "@/server/lib/people-api";
export async function GET(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]);
    const parsed = sheetFilters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const { employeeId, month } = parsed.data;
    const employee = await prisma.employees.findFirst({ where: { AND: [{ id: employeeId, deletedAt: null }, employeeScope(actor)] }, select: { id: true } });
    if (!employee) throw new PeopleError("Funcionário fora da sua permissão", 404);
    const start = new Date(month + "-01T00:00:00Z"), end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1));
    const [requests, entries] = await prisma.$transaction([
      prisma.time_entry_requests.findMany({ where: { employeeId, date: { gte: start, lt: end } }, select: { id: true, date: true, time: true, type: true, targetEntryId: true, justification: true, status: true, evaluatorNote: true, createdAt: true, evaluatedAt: true, createdBy: { select: { name: true } }, evaluatedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 501 }),
      prisma.time_entries.findMany({ where: { employeeId, date: { gte: start, lt: end }, status: { not: "EXCLUIDO_LOGICAMENTE" } }, select: { id: true, date: true, time: true, origin: true, status: true, reviewFlags: true }, orderBy: [{ date: "desc" }, { time: "asc" }], take: 10001 }),
    ]);
    if (requests.length > 500 || entries.length > 10000) throw new PeopleError("Volume muito alto no mês. Confira os registros antes de ajustar.", 422);
    return NextResponse.json({ requests, entries: entries.map(entry => ({ ...entry, date: dateKey(entry.date) })) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return peopleError(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]), parsed = adjustmentInput.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const value = parsed.data;
    const result = await attendanceTransaction(async tx => {
      if (value.operation === "request") {
        const employee = await tx.employees.findFirst({ where: { AND: [{ id: value.employeeId, deletedAt: null }, employeeScope(actor)] }, include: { workSchedule: { include: { days: true } } } });
        if (!employee) throw new PeopleError("Funcionário fora da sua permissão", 404);
        const target = value.targetEntryId ? await tx.time_entries.findFirst({ where: { id: value.targetEntryId, employeeId: employee.id, status: { not: "EXCLUIDO_LOGICAMENTE" } } }) : null;
        if (value.targetEntryId && !target) throw new PeopleError("A batida original mudou ou não está disponível", 409);
        const date = value.type === "EXCLUDE" ? dateKey(target!.date) : value.date, time = value.type === "EXCLUDE" ? target!.time : value.time!;
        if (value.type !== "EXCLUDE") {
          if (date > localToday() || localInstant(date, time).getTime() > Date.now()) throw new PeopleError("Não é permitido lançar batidas futuras");
          const policy = await loadPolicy(tx);
          if (!insideWindow(date, time, employee.workSchedule?.deletedAt ? null : employee.workSchedule, policy)) throw new PeopleError("Fora da janela permitida. Confira a jornada vinculada e os minutos antes/depois em Marcações.");
          if (await nearbyEntry(tx, employee.id, date, time, policy.duplicateMinutes, target?.id)) throw new PeopleError("Já existe uma batida nesse horário ou dentro do intervalo de duplicidade", 409);
        }
        const existing = await tx.time_entry_requests.findFirst({ where: { employeeId: employee.id, status: "PENDENTE", type: value.type, date: new Date(date + "T00:00:00Z"), time, targetEntryId: value.targetEntryId } });
        if (existing) return { id: existing.id, message: "Já existe uma solicitação pendente para esse ajuste." };
        const after = await tx.time_entry_requests.create({ data: { employeeId: employee.id, createdById: actor.id, date: new Date(date + "T00:00:00Z"), time, type: value.type, targetEntryId: value.targetEntryId, justification: value.justification } });
        await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "CREATE", entity: "time_entry_requests", entityId: after.id, after: auditJson(after) } });
        return { id: after.id, message: "Solicitação registrada. A batida só muda após aprovação do RH ou da administração." };
      }
      if (!["MASTER", "ADMIN", "RH"].includes(actor.role)) throw new PeopleError("Somente RH e administração podem avaliar ajustes", 403);
      const before = await tx.time_entry_requests.findUnique({ where: { id: value.id } });
      if (!before) throw new PeopleError("Solicitação não encontrada", 404);
      const finalStatus = value.decision === "APPROVE" ? "APROVADO" : "REPROVADO";
      if (before.status !== "PENDENTE") {
        if (before.status === finalStatus) return { id: before.id, message: "Esta solicitação já foi avaliada." };
        throw new PeopleError("A solicitação já recebeu outra decisão", 409);
      }
      if (value.decision === "APPROVE") {
        if (!["INSERT", "REPLACE", "EXCLUDE"].includes(before.type)) throw new PeopleError("Tipo antigo de solicitação: cadastre uma nova solicitação nesta tela");
        const employee = await tx.employees.findFirst({ where: { id: before.employeeId, deletedAt: null }, include: { workSchedule: { include: { days: true } } } });
        if (!employee) throw new PeopleError("Funcionário indisponível", 409);
        const target = before.targetEntryId ? await tx.time_entries.findFirst({ where: { id: before.targetEntryId, employeeId: employee.id, status: { not: "EXCLUIDO_LOGICAMENTE" } } }) : null;
        if (before.type !== "INSERT" && !target) throw new PeopleError("A batida original mudou. Rejeite esta solicitação e confira os registros.", 409);
        const date = dateKey(before.date), time = before.time!;
        if (before.type !== "EXCLUDE") {
          const policy = await loadPolicy(tx);
          if (!time || localInstant(date, time).getTime() > Date.now() || !insideWindow(date, time, employee.workSchedule?.deletedAt ? null : employee.workSchedule, policy)) throw new PeopleError("O horário solicitado não atende à janela atual ou está no futuro. Confira a jornada e a configuração.");
          if (await nearbyEntry(tx, employee.id, date, time, policy.duplicateMinutes, target?.id)) throw new PeopleError("Outra batida já ocupa o horário solicitado", 409);
        }
        const adjustment = await tx.time_entry_adjustments.create({ data: { employeeId: employee.id, requestId: before.id, createdById: before.createdById, approvedById: actor.id, approvedAt: new Date(), date: before.date, target: before.type, previousTime: target?.time ?? null, newTime: time, note: before.justification } });
        if (target) {
          await tx.time_entries.update({ where: { id: target.id }, data: { status: "EXCLUIDO_LOGICAMENTE", adjustments: { connect: { id: adjustment.id } } } });
          await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "ADJUST", entity: "time_entries", entityId: target.id, before: auditJson(target), after: auditJson({ status: "EXCLUIDO_LOGICAMENTE", requestId: before.id, adjustmentId: adjustment.id }) } });
        }
        if (before.type !== "EXCLUDE") await tx.time_entries.create({ data: { employeeId: employee.id, date: before.date, time, timestamp: localInstant(date, time), kind: target?.kind ?? "MARK", origin: "MANUAL", status: "AJUSTADO", note: before.justification, adjustments: { connect: { id: adjustment.id } } } });
        await invalidateBank(tx, employee.id, [date, ...(target ? [dateKey(target.date)] : [])]);
      }
      const after = await tx.time_entry_requests.update({ where: { id: before.id }, data: { status: finalStatus, evaluatedById: actor.id, evaluatedAt: new Date(), evaluatorNote: value.note || null } });
      await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: value.decision === "APPROVE" ? "APPROVE" : "REJECT", entity: "time_entry_requests", entityId: before.id, before: auditJson(before), after: auditJson(after) } });
      return { id: after.id, message: value.decision === "APPROVE" ? "Ajuste aprovado. Espelho atualizado; reapure o banco de horas se houver lançamentos anteriores." : "Solicitação rejeitada; as marcações foram preservadas." };
    });
    return NextResponse.json(result);
  } catch (error) { return peopleError(error); }
}
