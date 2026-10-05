"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Clock,
  Copy,
  Landmark,
  Users,
  Building2,
  Briefcase,
  CalendarRange,
  Calendar,
  PartyPopper,
  PlaneTakeoff,
  FileText,
  Activity,
  Fingerprint,
  Server,
  RefreshCcw,
  ScrollText,
  Settings,
  Store,
  Usb,
  UserCog,
  Shield,
  FileSearch,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type Role = "MASTER" | "ADMIN" | "RH" | "GESTOR" | "FUNCIONARIO";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: Role[];
  badge?: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const NAV: NavGroup[] = [
  {
    title: "Principal",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        roles: ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"],
      },
    ],
  },
  {
    title: "Ponto",
    items: [
      { title: "Marcações", href: "/ponto/marcacoes", icon: Clock, roles: ["MASTER", "ADMIN", "RH", "GESTOR"] },
      { title: "Espelho de Ponto", href: "/ponto/espelho", icon: Copy, roles: ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"] },
      { title: "Banco de Horas", href: "/ponto/banco-horas", icon: Landmark, roles: ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"] },
      { title: "Ajustes", href: "/ponto/ajustes", icon: RefreshCcw, roles: ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"] },
    ],
  },
  {
    title: "Funcionários",
    items: [
      { title: "Funcionários", href: "/funcionarios", icon: Users, roles: ["MASTER", "ADMIN", "RH", "GESTOR"] },
      { title: "Setores", href: "/funcionarios/setores", icon: Building2, roles: ["MASTER", "ADMIN", "RH"] },
      { title: "Cargos", href: "/funcionarios/cargos", icon: Briefcase, roles: ["MASTER", "ADMIN", "RH"] },
    ],
  },
  {
    title: "Jornadas",
    items: [
      { title: "Jornadas", href: "/jornadas", icon: CalendarRange, roles: ["MASTER", "ADMIN", "RH"] },
      { title: "Escalas", href: "/jornadas/escalas", icon: Calendar, roles: ["MASTER", "ADMIN", "RH"] },
      { title: "Feriados", href: "/jornadas/feriados", icon: PartyPopper, roles: ["MASTER", "ADMIN", "RH"] },
    ],
  },
  {
    title: "Ausências",
    items: [
      { title: "Férias", href: "/ausencias/ferias", icon: PlaneTakeoff, roles: ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"] },
      { title: "Afastamentos", href: "/ausencias/afastamentos", icon: Users, roles: ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"] },
      { title: "Atestados", href: "/ausencias/atestados", icon: FileText, roles: ["MASTER", "ADMIN", "RH", "GESTOR", "FUNCIONARIO"] },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { title: "Todos os relatórios", href: "/relatorios", icon: FileSearch, roles: ["MASTER", "ADMIN", "RH", "GESTOR"] },
    ],
  },
  {
    title: "Integrações",
    items: [
      { title: "Control iD", href: "/integracoes/control-id", icon: Fingerprint, roles: ["MASTER", "ADMIN"] },
      { title: "VGON PONTO Agent", href: "/integracoes/agents", icon: Server, roles: ["MASTER", "ADMIN"] },
      { title: "Sincronizações", href: "/integracoes/sincronizacoes", icon: RefreshCcw, roles: ["MASTER", "ADMIN"] },
      { title: "Logs", href: "/integracoes/logs", icon: ScrollText, roles: ["MASTER", "ADMIN"] },
    ],
  },
  {
    title: "Configurações",
    items: [
      { title: "Empresa", href: "/configuracoes/empresa", icon: Store, roles: ["MASTER", "ADMIN"] },
      { title: "Dispositivos", href: "/configuracoes/dispositivos", icon: Usb, roles: ["MASTER", "ADMIN"] },
      { title: "Usuários", href: "/configuracoes/usuarios", icon: UserCog, roles: ["MASTER", "ADMIN"] },
      { title: "Permissões", href: "/configuracoes/permissoes", icon: Shield, roles: ["MASTER"] },
      { title: "Auditoria", href: "/configuracoes/auditoria", icon: Activity, roles: ["MASTER", "ADMIN"] },
    ],
  },
];

export function getNavForRole(role: Role) {
  return NAV.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.roles.includes(role)),
  })).filter((g) => g.items.length > 0);
}

export function Sidebar({
  role = "ADMIN",
  collapsed,
  onToggleCollapse,
}: {
  role?: Role;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const groups = getNavForRole(role);

  return (
    <aside
      className={cn(
        "hidden md:flex md:flex-col h-screen sticky top-0 border-r bg-sidebar text-sidebar-foreground transition-all duration-200",
        collapsed ? "w-[74px]" : "w-64",
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed ? (
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-vgon-blue-700 shadow-md">
              <Fingerprint className="h-4.5 w-4.5" />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-bold tracking-wide">VGON PONTO</p>
              <p className="text-[10px] text-white/60">Sistema de ponto</p>
            </div>
          </Link>
        ) : (
          <Link href="/dashboard" className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-vgon-blue-700 shadow-md">
            <Fingerprint className="h-5 w-5" />
          </Link>
        )}
        {onToggleCollapse && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapse}
            className="hidden lg:inline-flex h-8 w-8 text-white/70 hover:text-white hover:bg-white/10"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>

      <TooltipProvider delayDuration={100}>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-6 no-print">
          {groups.map((group) => (
            <div key={group.title}>
              {!collapsed ? (
                <p className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-white/40">{group.title}</p>
              ) : null}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
                  const Icon = item.icon;
                  const content = (
                    <Link
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                          : "text-white/75 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      <Icon className={cn("h-4.5 w-4.5 shrink-0", collapsed ? "mx-auto" : "")} />
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{item.title}</span>
                          {item.badge && (
                            <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px]">{item.badge}</span>
                          )}
                        </>
                      )}
                    </Link>
                  );
                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>
                          <li>{content}</li>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    );
                  }
                  return <li key={item.href}>{content}</li>;
                })}
              </ul>
            </div>
          ))}
        </nav>
      </TooltipProvider>

      <div className={cn("border-t border-sidebar-border p-3 text-[11px] text-white/50", collapsed && "text-center")}>
        {!collapsed ? (
          <div>
            <p className="font-semibold text-white/80">VGON PONTO</p>
            <p>Versão 1.0.0 · Produção</p>
          </div>
        ) : (
          <p className="text-[10px]">v1.0.0</p>
        )}
      </div>
    </aside>
  );
}
