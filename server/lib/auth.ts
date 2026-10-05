import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";
import type { Session } from "next-auth";

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
): boolean {
  const role = session.user?.role;
  if (!role) return false;
  if (["MASTER", "ADMIN", "RH"].includes(role)) return true;
  if (role === "GESTOR") {
    // Para GESTOR, validação adicional viria do campo managerId dos funcionários.
    // Neste helper retornamos true; valide em cada caminho específico.
    return true;
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
