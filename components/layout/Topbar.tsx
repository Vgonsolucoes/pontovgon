"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Menu,
  Bell,
  Search,
  LogOut,
  UserCog,
  HelpCircle,
  Fingerprint,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar, getNavForRole, type Role } from "@/components/layout/Sidebar";

export function Topbar({
  title,
  subtitle,
  user,
  onSignOut,
}: {
  title?: string;
  subtitle?: string;
  user?: { id: string; name: string; email: string; role: Role; employeeId?: string | null };
  onSignOut?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [openMobile, setOpenMobile] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);
  const safeRole: Role = user?.role ?? "ADMIN";

  const handleSignOut = async () => {
    if (onSignOut) await onSignOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-white/80 px-3 md:px-6 backdrop-blur supports-[backdrop-filter]:bg-white/60 no-print">
        <Sheet open={openMobile} onOpenChange={setOpenMobile}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Abrir menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="!max-w-[280px] border-0 p-0 bg-sidebar text-sidebar-foreground">
            <SheetHeader className="p-4 pb-2">
              <SheetTitle className="text-white">Menu</SheetTitle>
            </SheetHeader>
            <div className="overflow-y-auto">
              <Sidebar role={safeRole} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="hidden md:flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-slate-600 hover:text-slate-900"
            onClick={() => setCollapsed((c) => !c)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-semibold text-slate-900 truncate">
            {title ?? "Bem-vindo ao VGON PONTO"}
          </h1>
          {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
        </div>

        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar funcionários, marcações, atestados..."
              className="pl-9 bg-slate-50/60 focus-visible:bg-white"
            />
          </div>
        </div>

        <Badge variant="success" className="hidden sm:inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
        </Badge>

        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5 text-slate-600" />
          <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
          <span className="sr-only">Notificações</span>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5 pr-2 data-[state=open]:bg-slate-100">
              <Avatar className="h-8 w-8">
                <AvatarFallback>{initials(user?.name ?? "V G")}</AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-[13px] font-medium text-slate-800">
                  {user?.name ?? "Usuário Vgon"}
                </p>
                <p className="text-[11px] text-slate-500">{user?.role ?? "ADMIN"}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>
              <div className="flex items-center gap-2">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{initials(user?.name ?? "VG")}</AvatarFallback>
                </Avatar>
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{user?.name ?? "Usuário"}</p>
                  <p className="text-xs text-slate-500">{user?.email ?? "usuário@vgon.com.br"}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" /> Painel
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/configuracoes/perfil">
                  <UserCog className="h-4 w-4" /> Meu perfil
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/configuracoes/dispositivos">
                  <Fingerprint className="h-4 w-4" /> Dispositivos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/ajuda">
                  <HelpCircle className="h-4 w-4" /> Central de ajuda
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-rose-600 focus:bg-rose-50 focus:text-rose-700"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {collapsed ? null : null /* usado apenas para hook */}
      <MobileSidebarBridge collapsed={collapsed} />
    </>
  );
}

function MobileSidebarBridge({ collapsed }: { collapsed: boolean }) {
  // Aplica estado colapsado no sidebar por meio do evento/context em versões futuras.
  React.useEffect(() => {
    const ev = new CustomEvent("sidebar-collapsed", { detail: collapsed });
    window.dispatchEvent(ev);
  }, [collapsed]);
  return null;
}

export function NavPlaceholder({ role }: { role?: Role }) {
  const nav = getNavForRole(role ?? "ADMIN").flatMap((g) => g.items);
  void nav;
  return null;
}
