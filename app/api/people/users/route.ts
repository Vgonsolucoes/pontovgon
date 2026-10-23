import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { userInput, userWriteError } from "@/server/lib/people";
import { auditJson, peopleActor, PeopleError, peopleError, userSelect, validationError } from "@/server/lib/people-api";

export async function GET() {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN"]);
    const [rows, employees] = await Promise.all([
      prisma.users.findMany({ where: { deletedAt: null }, select: userSelect, orderBy: { name: "asc" } }),
      prisma.employees.findMany({ where: { deletedAt: null }, select: { id: true, name: true, registration: true }, orderBy: { name: "asc" } }),
    ]);
    return NextResponse.json({ rows, options: { employees }, actor, canWrite: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return peopleError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN"]);
    const parsed = userInput.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const { id, password, ...data } = parsed.data;
    const passwordHash = password ? await bcrypt.hash(password, 12) : undefined;
    const result = await prisma.$transaction(async tx => {
      const before = id ? await tx.users.findFirst({ where: { id, deletedAt: null }, select: userSelect }) : null;
      if (id && !before) throw new PeopleError("Usuário não encontrado", 404);
      const denied = userWriteError(actor, before, data);
      if (denied) throw new PeopleError(denied, 403);
      if (data.employeeId && !await tx.employees.findFirst({ where: { id: data.employeeId, deletedAt: null } })) throw new PeopleError("Funcionário vinculado não encontrado");
      const write = { ...data, ...(passwordHash ? { passwordHash } : {}) };
      const after = id ? await tx.users.update({ where: { id }, data: write, select: userSelect }) : await tx.users.create({ data: write, select: userSelect });
      await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: id ? "UPDATE" : "CREATE", entity: "users", entityId: after.id, before: auditJson(before), after: auditJson({ ...after, passwordChanged: !!passwordHash }) } });
      return after;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result, { status: id ? 200 : 201 });
  } catch (error) { return peopleError(error); }
}
