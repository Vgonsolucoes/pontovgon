import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { employeeInput } from "@/server/lib/people";
import { auditJson, peopleActor, PeopleError, peopleError, validationError } from "@/server/lib/people-api";

export async function GET() {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR"]);
    const canWrite = actor.role !== "GESTOR";
    const rows = await prisma.employees.findMany({ where: { deletedAt: null, ...(!canWrite ? { managerId: actor.employeeId ?? "unlinked-manager" } : {}) }, orderBy: { name: "asc" } });
    const [departments, positions, schedules, managers] = canWrite ? await Promise.all([
      prisma.departments.findMany({ where: { deletedAt: null }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
      prisma.positions.findMany({ where: { deletedAt: null }, select: { id: true, name: true, active: true, departmentId: true }, orderBy: { name: "asc" } }),
      prisma.work_schedules.findMany({ where: { deletedAt: null }, select: { id: true, name: true, active: true }, orderBy: { name: "asc" } }),
      prisma.employees.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]) : [[], [], [], []];
    return NextResponse.json({ rows, options: { departments, positions, schedules, managers }, actor, canWrite }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peopleError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH"]);
    const parsed = employeeInput.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const { id, admissionDate, ...data } = parsed.data;
    const result = await prisma.$transaction(async tx => {
      const before = id ? await tx.employees.findFirst({ where: { id, deletedAt: null } }) : null;
      if (id && !before) throw new PeopleError("Funcionário não encontrado", 404);
      for (const [key, table] of [["departmentId", "departments"], ["positionId", "positions"], ["workScheduleId", "work_schedules"]] as const) {
        const relationId = data[key];
        if (!relationId) continue;
        const args = { where: { id: relationId, deletedAt: null }, select: { id: true, active: true } } as const;
        const target = table === "departments" ? await tx.departments.findFirst(args) : table === "positions" ? await tx.positions.findFirst(args) : await tx.work_schedules.findFirst(args);
        if (!target || (!target.active && before?.[key] !== relationId)) throw new PeopleError("Selecione um setor, cargo ou jornada ativo e válido");
      }
      if (data.positionId) {
        const position = await tx.positions.findUnique({ where: { id: data.positionId } });
        if (position?.departmentId && position.departmentId !== data.departmentId) throw new PeopleError("O cargo selecionado pertence a outro setor");
      }
      if (data.managerId) {
        const visited = new Set(id ? [id] : []);
        let current: string | null = data.managerId;
        while (current) {
          if (visited.has(current)) throw new PeopleError("O vínculo de gestor criaria uma hierarquia circular");
          visited.add(current);
          const manager: { managerId: string | null } | null = await tx.employees.findFirst({ where: { id: current, deletedAt: null }, select: { managerId: true } });
          if (!manager) throw new PeopleError("Gestor não encontrado");
          current = manager.managerId;
        }
      }
      if (data.externalIdDevice && await tx.employees.findFirst({ where: { externalIdDevice: data.externalIdDevice, deletedAt: null, ...(id ? { id: { not: id } } : {}) } })) throw new PeopleError("O ID no iDFace já está vinculado a outro funcionário", 409);
      const write = { ...data, admissionDate: admissionDate ? new Date(`${admissionDate}T00:00:00.000Z`) : null };
      const after = id ? await tx.employees.update({ where: { id }, data: write }) : await tx.employees.create({ data: write });
      await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: id ? "UPDATE" : "CREATE", entity: "employees", entityId: after.id, before: auditJson(before), after: auditJson(after) } });
      return after;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result, { status: id ? 200 : 201 });
  } catch (error) { return peopleError(error); }
}
