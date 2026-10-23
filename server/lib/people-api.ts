import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { PeopleActor } from "./people";

export class PeopleError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function peopleActor(allowed: string[]): Promise<PeopleActor & { email: string }> {
  const session = await auth();
  if (!session?.user?.id) throw new PeopleError("Sua sessão expirou. Entre novamente.", 401);
  const actor = await prisma.users.findFirst({ where: { id: session.user.id, active: true, deletedAt: null }, select: { id: true, role: true, employeeId: true, email: true } });
  if (!actor || !allowed.includes(actor.role)) throw new PeopleError("Sem permissão para esta operação", 403);
  return actor;
}
export function peopleError(error: unknown) {
  if (error instanceof PeopleError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Envie um formulário válido" }, { status: 400 });
  const code = (error as { code?: string })?.code;
  if (code === "P2002") {
    const target = (error as { meta?: { target?: unknown } }).meta?.target;
    const names: Record<string, string> = { email: "E-mail", cpf: "CPF", registration: "Matrícula", employeeId: "Funcionário vinculado" };
    const field = Array.isArray(target) ? target.find(key => typeof key === "string" && names[key]) as string | undefined : undefined;
    const message = field ? `${names[field]} já utilizado em outro cadastro` : "Já existe um cadastro com esses dados";
    return NextResponse.json({ error: message, fields: field ? { [field]: message } : {} }, { status: 409 });
  }
  if (code === "P2034") return NextResponse.json({ error: "Outro cadastro mudou durante a gravação. Tente salvar novamente." }, { status: 409 });
  return NextResponse.json({ error: "Não foi possível acessar os cadastros. Tente novamente." }, { status: 503 });
}
export function validationError(error: { issues: Array<{ path: PropertyKey[]; message: string }> }) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) fields[issue.path.join(".")] ??= issue.message;
  return NextResponse.json({ error: "Confira os campos indicados", fields }, { status: 400 });
}
export function auditJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value == null ? Prisma.JsonNull : JSON.parse(JSON.stringify(value));
}
export const userSelect = { id: true, name: true, email: true, role: true, active: true, employeeId: true, createdAt: true, lastLoginAt: true } as const;
