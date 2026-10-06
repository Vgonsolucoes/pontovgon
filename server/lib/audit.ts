import { prisma } from "@/server/db";
import { Prisma } from "@prisma/client";
import type { AuditAction } from "@prisma/client";
import type { Session } from "next-auth";

export type AuditInput = {
  session?: { user?: { id?: string; email?: string } } | Session | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown | null;
  after?: unknown | null;
  ip?: string | null;
  userAgent?: string | null;
  note?: string | null;
};

function toJson(v: unknown | null | undefined): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null as unknown as Prisma.NullableJsonNullValueInput;
  try {
    if (typeof v === "object") return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v as any;
    return String(v);
  } catch {
    return String(v);
  }
}

export async function audit(input: AuditInput) {
  try {
    const { session, action, entity, entityId, before, after, ip, userAgent } = input;
    await prisma.audit_logs.create({
      data: {
        userId: session?.user?.id ?? null,
        actorEmail: session?.user?.email ?? null,
        action,
        entity,
        entityId: entityId ?? null,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        before: toJson(before),
        after: toJson(after),
      },
    });
  } catch (err) {
    // Nunca deixar auditoria quebrar fluxo principal
    if (process.env.NODE_ENV !== "production") {
      console.error("[audit] falhou:", err);
    }
  }
}

export function actionLabel(a: AuditAction): string {
  switch (a) {
    case "CREATE": return "Criação";
    case "UPDATE": return "Atualização";
    case "SOFT_DELETE": return "Exclusão lógica";
    case "RESTORE": return "Restauração";
    case "APPROVE": return "Aprovação";
    case "REJECT": return "Reprovação";
    case "ADJUST": return "Ajuste";
    case "MANUAL_ENTRY": return "Entrada manual";
    case "SYNC": return "Sincronização";
    default: return String(a);
  }
}

export type ActorInfo = { ip?: string | null; userAgent?: string | null };
