import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { peopleActor, peopleError, validationError } from "@/server/lib/people-api";
import { sheetFilters } from "@/server/lib/attendance";
import { loadTimeSheet } from "@/server/lib/time-sheet";
export async function GET(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"]);
    const parsed = sheetFilters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const report = await prisma.$transaction(tx => loadTimeSheet(tx, actor, parsed.data.employeeId, parsed.data.month), { isolationLevel: "RepeatableRead", timeout: 15000 });
    return NextResponse.json(report, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return peopleError(error); }
}
