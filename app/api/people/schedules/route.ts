import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { scheduleInput, scheduleLoads } from "@/server/lib/work-schedules";
import { auditJson, peopleActor, PeopleError, peopleError, validationError } from "@/server/lib/people-api";
const include = { days: { orderBy: { weekday: "asc" as const } }, _count: { select: { employees: { where: { deletedAt: null } } } } };
export async function GET() {
  try {
    await peopleActor(["MASTER", "ADMIN", "RH"]);
    const rows = await prisma.work_schedules.findMany({ where: { deletedAt: null }, include, orderBy: { name: "asc" } });
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peopleError(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH"]);
    const parsed = scheduleInput.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const { id, days, observations, ...data } = parsed.data;
    const result = await prisma.$transaction(async tx => {
      const before = id ? await tx.work_schedules.findFirst({ where: { id, deletedAt: null }, include: { days: true } }) : null;
      if (id && !before) throw new PeopleError("Jornada não encontrada", 404);
      if (await tx.work_schedules.findFirst({ where: { name: { equals: data.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) } })) throw new PeopleError("Já existe uma jornada com esse nome", 409);
      const write = { ...data, observations: observations || null, ...scheduleLoads(days) };
      const after = id
        ? await tx.work_schedules.update({ where: { id }, data: { ...write, days: { deleteMany: {}, create: days } }, include })
        : await tx.work_schedules.create({ data: { ...write, days: { create: days } }, include });
      if (id) await tx.hour_bank.updateMany({ where: { origin: "DAILY_CALC", employee: { workScheduleId: id } }, data: { needsRecalculation: true } });
      await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: id ? "UPDATE" : "CREATE", entity: "work_schedules", entityId: after.id, before: auditJson(before), after: auditJson(after) } });
      return after;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result, { status: id ? 200 : 201 });
  } catch (error) { return peopleError(error); }
}
