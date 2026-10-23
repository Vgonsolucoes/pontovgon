import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { peopleActor, peopleError, PeopleError, validationError } from "@/server/lib/people-api";
import { employeeScope, entryFilters } from "@/server/lib/attendance";
export async function GET(request: Request) {
  try {
    const actor = await peopleActor(["MASTER", "ADMIN", "RH", "GESTOR"]);
    const parsed = entryFilters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return validationError(parsed.error);
    const filters = parsed.data, privileged = ["MASTER", "ADMIN", "RH"].includes(actor.role);
    if (filters.employeeId === "unlinked" && !privileged) throw new PeopleError("Sem permissão para consultar marcações sem vínculo", 403);
    const where: Prisma.time_entriesWhereInput = {
      date: { gte: new Date(filters.start + "T00:00:00Z"), lte: new Date(filters.end + "T00:00:00Z") },
      ...(!privileged ? { employee: { is: { deletedAt: null, ...employeeScope(actor) } } } : {}),
      ...(filters.employeeId ? { employeeId: filters.employeeId === "unlinked" ? null : filters.employeeId } : {}),
      ...(filters.deviceId ? { deviceId: filters.deviceId } : {}),
      ...(filters.origin ? { origin: filters.origin } : {}), ...(filters.status ? { status: filters.status } : {}),
    };
    const pageSize = 50;
    const [total, rows] = await prisma.$transaction([
      prisma.time_entries.count({ where }),
      prisma.time_entries.findMany({ where, orderBy: [{ date: "desc" }, { time: "desc" }, { id: "desc" }], take: pageSize, skip: (filters.page - 1) * pageSize,
        select: { id: true, date: true, time: true, timestamp: true, kind: true, origin: true, status: true, reviewFlags: true, duplicateOfId: true, importedAt: true, externalEventId: true, originalEventRef: privileged, employee: { select: { id: true, name: true, registration: true } }, device: { select: { name: true } } },
      }),
    ]);
    return NextResponse.json({ total, page: filters.page, pageSize, rows: rows.map(({ originalEventRef, ...row }) => {
      let deviceUserId: string | null = null;
      if (!row.employee && originalEventRef) { try { const value = JSON.parse(originalEventRef).employeeExternalId; if (typeof value === "string") deviceUserId = value.slice(0, 120); } catch {} }
      return { ...row, date: row.date.toISOString().slice(0, 10), deviceUserId };
    }) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return peopleError(error); }
}
