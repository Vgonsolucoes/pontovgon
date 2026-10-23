import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { peopleActor, peopleError } from "@/server/lib/people-api";
import { employeeScope, localToday } from "@/server/lib/attendance";
export async function GET() {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]);
    const privileged = ["MASTER", "ADMIN", "RH"].includes(actor.role);
    const [employees, devices] = await Promise.all([
      prisma.employees.findMany({ where: { deletedAt: null, ...employeeScope(actor) }, select: { id: true, name: true, registration: true, workSchedule: { select: { name: true } } }, orderBy: { name: "asc" } }),
      privileged ? prisma.devices.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    ]);
    return NextResponse.json({ employees, devices, canSeeUnlinked: privileged, canManageTime: privileged, canManagePolicies: ["MASTER", "ADMIN"].includes(actor.role), today: localToday() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return peopleError(error); }
}
