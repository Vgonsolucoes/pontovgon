"use client";
import React from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { AppShell, type UserShell } from "@/components/layout/AppShell";

const FALLBACK_USER: UserShell = {
  id: "u-fallback",
  name: "Usuário",
  email: "voce@vgon.com.br",
  role: "FUNCIONARIO",
  employeeId: null,
};

function mapRoleFromAuth(role: string | null | undefined): UserShell["role"] {
  if (role === "MASTER" || role === "ADMIN" || role === "RH" || role === "GESTOR" || role === "FUNCIONARIO") return role;
  return "FUNCIONARIO";
}

function ShellInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading" || !session?.user?.email) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin mr-3" /> Carregando sessão…
      </div>
    );
  }

  const user: UserShell = {
    id: session.user.id ?? FALLBACK_USER.id,
    name: session.user.name ?? FALLBACK_USER.name,
    email: session.user.email,
    role: mapRoleFromAuth(session.user.role as string | null),
    employeeId: session.user.employeeId ?? null,
  };

  return (
    <AppShell
      user={user}
      title="Painel de controle"
      subtitle="Visão geral da jornada e integrações"
      onSignOut={async () => {
        await signOut({ redirect: false });
        router.push("/login");
        router.refresh();
      }}
    >
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ShellInner>{children}</ShellInner>
    </SessionProvider>
  );
}
