import Link from "next/link";
import { ArrowLeft, Building2, Plus, SearchIcon, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireRole } from "@/server/lib/auth";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage({ searchParams }: { searchParams?: { q?: string } }) {
  await requireRole(["MASTER", "ADMIN", "RH"]);
  const q = (searchParams?.q || "").trim().toLowerCase();

  // Dados exemplo (pronto para substituir por prisma.departments.findMany)
  const all = [
    { id: "d1", name: "Administrativo", description: "Suporte administrativo e gestão geral.", active: true, count: 8 },
    { id: "d2", name: "Comercial", description: "Vendas, prospecção e atendimento ao cliente.", active: true, count: 5 },
    { id: "d3", name: "Técnico", description: "Suporte técnico e infraestrutura.", active: true, count: 12 },
    { id: "d4", name: "Financeiro", description: "Contabilidade, contas a pagar e receber.", active: true, count: 3 },
    { id: "d5", name: "Diretoria", description: "Diretoria executiva.", active: true, count: 2 },
    { id: "d6", name: "Recursos Humanos", description: "RH, benefícios e departamento pessoal.", active: false, count: 0 },
  ];
  const rows = q ? all.filter((d) => d.name.toLowerCase().includes(q) || (d.description || "").toLowerCase().includes(q)) : all;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Link href="/dashboard" className="hover:text-vgon-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Funcionários</span>
            <span>/</span>
            <span className="text-slate-800 font-medium">Setores</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-vgon-blue-600" /> Setores
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie os setores da empresa. Vincule aos cargos e funcionários.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar</Link>
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Novo setor
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        {[
          { label: "Total de setores", value: all.length, hint: "Cadastrados", tone: "info" as const },
          { label: "Ativos", value: all.filter((d) => d.active).length, hint: "Operacionais", tone: "success" as const },
          { label: "Inativos", value: all.filter((d) => !d.active).length, hint: "Desativados", tone: "warning" as const },
          { label: "Funcionários alocados", value: all.reduce((acc, d) => acc + d.count, 0), hint: "Soma de todos setores", tone: "secondary" as const },
        ].map((c) => (
          <Card key={c.label} className="border shadow-sm">
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">{c.hint}</CardDescription>
              <CardTitle className="text-2xl flex items-center justify-between">
                <span>{c.value}</span>
                <Badge variant={c.tone}>{c.label}</Badge>
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Lista de setores</CardTitle>
            <CardDescription className="text-xs pt-1">Exibindo {rows.length} resultado(s)</CardDescription>
          </div>
          <form className="relative w-full md:w-80">
            <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input name="q" defaultValue={q} placeholder="Buscar setor…" className="pl-9" />
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-t-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[120px] text-center">Funcionários</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-slate-500 py-10">
                      Nenhum setor encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium text-slate-800">{d.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">{d.description || "—"}</TableCell>
                    <TableCell className="text-center font-semibold text-slate-700">{d.count}</TableCell>
                    <TableCell>
                      <Badge variant={d.active ? "success" : "muted"} className="inline-flex items-center gap-1 text-xs">
                        {d.active ? (<><ToggleRight className="h-3 w-3" /> Ativo</>) : (<><ToggleLeft className="h-3 w-3" /> Inativo</>)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
