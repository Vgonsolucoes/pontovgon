"use client";
import * as React from "react";
import { Sidebar, type Role } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export type UserShell = {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId?: string | null;
};

export function AppShell({
  children,
  title,
  subtitle,
  user,
  onSignOut,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  user?: UserShell;
  onSignOut?: () => Promise<void> | void;
}) {
  const [collapsed, setCollapsed] = React.useState(false);
  const role: Role = user?.role ?? "ADMIN";

  return (
    <div className="flex min-h-screen bg-slate-50/80 text-slate-900">
      <Sidebar role={role} collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar title={title} subtitle={subtitle} user={user} onSignOut={onSignOut} />
        <main className="flex-1 px-3 py-5 md:px-6 md:py-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
