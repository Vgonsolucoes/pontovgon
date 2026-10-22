import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Session } from "next-auth";

export type UserRole = "MASTER" | "ADMIN" | "RH" | "GESTOR" | "FUNCIONARIO";

export async function getSessionOrLogin(): Promise<NonNullable<Session>> {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");
  return session;
}

export async function requireRole(roles: UserRole[]): Promise<NonNullable<Session>> {
  const session = await getSessionOrLogin();
  if (!session.user.role || !roles.includes(session.user.role)) {
    redirect("/dashboard");
  }
  return session;
}

export function canAccessEmployee(
  session: { user?: { id?: string; role?: UserRole | null; employeeId?: string | null } },
  targetEmployeeId: string,
  targetManagerId?: string | null,
): boolean {
  const role = session.user?.role;
  if (!role) return false;
  if (["MASTER", "ADMIN", "RH"].includes(role)) return true;
  if (role === "GESTOR") {
    return !!session.user?.employeeId && targetManagerId === session.user.employeeId;
  }
  if (role === "FUNCIONARIO") {
    return !!session.user?.employeeId && session.user.employeeId === targetEmployeeId;
  }
  return false;
}

export function roleToLabel(role?: UserRole | null): string {
  switch (role) {
    case "MASTER": return "Master";
    case "ADMIN": return "Administrador";
    case "RH": return "Recursos Humanos";
    case "GESTOR": return "Gestor";
    case "FUNCIONARIO": return "Funcionário";
    default: return "—";
  }
}

export function hasAnyRole(session: { user?: { role?: UserRole | null } }, roles: UserRole[]): boolean {
  return !!session.user?.role && roles.includes(session.user.role);
}
