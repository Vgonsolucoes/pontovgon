import Link from "next/link";
import { ArrowLeft, UserCog, Wrench, Construction, CheckCircle2, BarChart3 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Usuários · VGON PONTO" };

export default async function PlaceholderPage() {
  await requireRole(["MASTER", "ADMIN"]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Link href="/dashboard" className="hover:text-vgon-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Configurações</span>
            <span>/</span>
            <span className="text-slate-800 font-medium">Usuários</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <UserCog className="h-6 w-6 text-vgon-blue-600" /> Usuários
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie contas de acesso: email, senha, perfil RBAC (MASTER/ADMIN/RH/GESTOR/FUNCIONÁRIO) e vínculo com funcionário.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar</Link>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Status da tela</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="warning" className="gap-1 inline-flex items-center">
                <Construction className="h-3 w-3" /> Em produção (estrutura pronta)
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Rotas, RBAC, layout e navegação configurados. CRUD e integrações sendo implementados nos próximos deploys.
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Controle de acesso</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="success" className="gap-1 inline-flex items-center">
                <CheckCircle2 className="h-3 w-3" /> RBAC OK
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Perfil(is) permitido(s): MASTER, ADMIN.
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Auditoria</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 inline-flex items-center">
                <BarChart3 className="h-3 w-3" /> Habilitada
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Operações críticas (criar/editar/excluir) geram log de auditoria com before/after e responsável.
          </CardContent>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Implementação</CardDescription>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant="outline" className="gap-1 inline-flex items-center">
                <Wrench className="h-3 w-3" /> Placeholder
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Estrutura de CRUD, tabelas e filtros serão ativados nas próximas entregas.
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Funcionalidades planejadas desta tela</CardTitle>
          <CardDescription className="text-xs pt-1">Esta página está 100% roteada, acessível e com RBAC aplicado. Os módulos abaixo são as próximas etapas.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-slate-600 space-y-2">
          <p>✅ Rota registrada no Next.js App Router (sem 404).</p>
          <p>✅ Controle de perfil RBAC (requireRole) aplicado.</p>
          <p>✅ Layout do AppShell (Sidebar + Topbar) carregando normalmente.</p>
          <p>✅ Breadcrumb e navegação de volta para Dashboard funcionando.</p>
          <p>🔜 CRUD / listagem / filtros / exportação (próximos deploys).</p>
        </CardContent>
      </Card>
    </div>
  );
}
