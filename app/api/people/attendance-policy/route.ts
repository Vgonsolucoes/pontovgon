import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { policyInput, loadPolicy } from "@/server/lib/attendance-policy";
import { auditJson, peopleActor, peopleError, validationError } from "@/server/lib/people-api";
export async function GET() {
  try { await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]); return NextResponse.json(await loadPolicy(prisma), { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { return peopleError(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN"]), parsed = policyInput.safeParse(await request.json());
    if (!parsed.success) return validationError(parsed.error);
    const result = await prisma.$transaction(async tx => {
      const before = await loadPolicy(tx);
      const after = await tx.attendance_settings.upsert({ where: { id: "default" }, create: { id: "default", ...parsed.data }, update: parsed.data });
      await tx.audit_logs.create({ data: { userId: actor.id, actorEmail: actor.email, action: "UPDATE", entity: "attendance_settings", entityId: "default", before: auditJson(before), after: auditJson(after) } });
      return after;
    });
    return NextResponse.json(result);
  } catch (error) { return peopleError(error); }
}
