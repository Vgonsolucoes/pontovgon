import { auth } from "@/auth";
import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
const schema = z.object({ id: z.string().min(1).optional(), name: z.string().trim().min(2).max(150).optional(), description: z.string().trim().max(500).optional(), active: z.boolean().optional() }).strict();
async function authorized() { const session = await auth(); return session?.user && ["MASTER", "ADMIN", "RH"].includes(session.user.role ?? "") ? session : null; }
export async function GET(_req: Request, { params }: { params: { module: string } }) {
  if (!await authorized()) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  try {
    if (params.module === "departments") return NextResponse.json(await prisma.departments.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }));
    if (params.module === "positions") return NextResponse.json(await prisma.positions.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }));
    return NextResponse.json({ error: "Módulo inválido" }, { status: 404 });
  } catch { return NextResponse.json({ error: "Consulta indisponível" }, { status: 503 }); }
}
export async function POST(req: Request, { params }: { params: { module: string } }) {
  const session = await authorized();
  if (!session) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  if (!["departments", "positions"].includes(params.module)) return NextResponse.json({ error: "Módulo inválido" }, { status: 404 });
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || (!parsed.data.id && !parsed.data.name)) return NextResponse.json({ error: "Preencha os campos obrigatórios" }, { status: 400 });
    const { id, ...data } = parsed.data;
    const result = await prisma.$transaction(async tx => {
      const before = id ? (params.module === "departments" ? await tx.departments.findUnique({ where: { id } }) : await tx.positions.findUnique({ where: { id } })) : null;
      if (id && (!before || before.deletedAt)) throw new Error("Registro não encontrado");
      const after = params.module === "departments"
        ? id ? await tx.departments.update({ where: { id }, data }) : await tx.departments.create({ data: { ...data, name: data.name! } })
        : id ? await tx.positions.update({ where: { id }, data }) : await tx.positions.create({ data: { ...data, name: data.name! } });
      await tx.audit_logs.create({ data: { userId: session.user.id, actorEmail: session.user.email, action: id ? "UPDATE" : "CREATE", entity: params.module, entityId: after.id, before: before ? JSON.parse(JSON.stringify(before)) : Prisma.JsonNull, after: JSON.parse(JSON.stringify(after)) } });
      return after;
    });
    return NextResponse.json(result);
  } catch (e) {
    const code = (e as { code?: string }).code;
    return NextResponse.json({ error: code === "P2002" ? "Já existe um registro com esse nome" : "Não foi possível salvar o registro" }, { status: code === "P2002" ? 409 : 400 });
  }
}
