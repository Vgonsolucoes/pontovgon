import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { holidayInput } from "@/server/lib/catalog-input";
import { attendanceTransaction } from "@/server/lib/attendance-transaction";
import { auditJson, peopleActor, peopleError, PeopleError, validationError } from "@/server/lib/people-api";
export async function GET(request: Request) { try {
  await peopleActor(["MASTER", "ADMIN", "RH"]);
  const year = new URL(request.url).searchParams.get("year") || "2026";
  if (!/^20\d{2}$/.test(year)) throw new PeopleError("Ano inválido");
  const rows = await prisma.holidays.findMany({ where: { OR: [{ recurring: true }, { date: { gte: new Date(`${year}-01-01T00:00:00Z`), lt: new Date(`${Number(year)+1}-01-01T00:00:00Z`) } }] }, orderBy: { date: "asc" } });
  return NextResponse.json({ rows: rows.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10), observedDate: year + row.date.toISOString().slice(4, 10) })).filter(row => !isNaN(Date.parse(row.observedDate)) && new Date(row.observedDate).toISOString().slice(0, 10) === row.observedDate).sort((a,b) => a.observedDate.localeCompare(b.observedDate)) }, { headers: { "Cache-Control": "private, no-store" } });
} catch (error) { return peopleError(error); } }
export async function POST(request: Request) { try {
  const actor = await peopleActor(["MASTER", "ADMIN", "RH"]), parsed = holidayInput.safeParse(await request.json());
  if (!parsed.success) return validationError(parsed.error);
  const { id, date, ...data } = parsed.data;
  const result = await attendanceTransaction(async tx => {
    const before = id ? await tx.holidays.findUnique({ where: { id } }) : null;
    if (id && !before) throw new PeopleError("Feriado não encontrado", 404);
    const rows = await tx.holidays.findMany({ where: { ...(id ? { id: { not: id } } : {}), active: true } });
    if (data.active && rows.some(row => row.date.toISOString().slice(0,10) === date || ((row.recurring || data.recurring) && row.date.toISOString().slice(5,10) === date.slice(5)))) throw new PeopleError("Já existe um feriado ativo nessa data", 409);
    const write = { ...data, date: new Date(date + "T00:00:00Z") };
    const after = id ? await tx.holidays.update({ where: { id }, data: write }) : await tx.holidays.create({ data: write });
    await tx.hour_bank.updateMany({ where: { origin: "DAILY_CALC" }, data: { needsRecalculation: true } });
    await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: id ? "UPDATE" : "CREATE", entity: "holidays", entityId: after.id, before: auditJson(before), after: auditJson(after) } });
    return after;
  });
  return NextResponse.json(result);
} catch (error) { return peopleError(error); } }
