import Link from "next/link";
import { ArrowLeft, Briefcase, Plus, SearchIcon, ToggleLeft, ToggleRight, Pencil } from "lucide-react";
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

export default async function PositionsPage({ searchParams }: { searchParams?: { q?: string; dept?: string } }) {
  await requireRole(["MASTER", "ADMIN", "RH"]);
  const q = (searchParams?.q || "").trim().toLowerCase();
  const dept = (searchParams?.dept || "").trim();

  const departments = [
    { id: "d1", name: "Administrativo" },
    { id: "d2", name: "Comercial" },
    { id: "d3", name: "Técnico" },
    { id: "d4", name: "Financeiro" },
    { id: "d5", name: "Diretoria" },
  ];
  const all = [
    { id: "p1", name: "Diretor(a)", departmentId: "d5", active: true },
    { id: "p2", name: "Técnico de Suporte", departmentId: "d3", active: true },
    { id: "p3", name: "Analista de RH", departmentId: null, active: true },
    { id: "p4", name: "Analista Financeiro", departmentId: "d4", active: true },
    { id: "p5", name: "Executivo de Vendas", departmentId: "d2", active: true },
    { id: "p6", name: "Auxiliar Administrativo", departmentId: "d1", active: true },
    { id: "p7", name: "Estagiário de TI", departmentId: "d3", active: false },
  ];
  const rows = all
    .filter((p) => (!dept ? true : p.departmentId === dept))
    .filter((p) => {
      if (!q) return true;
      const dName = departments.find((d) => d.id === p.departmentId)?.name || "";
      return p.name.toLowerCase().includes(q) || dName.toLowerCase().includes(q);
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-slate-500 text-xs mb-1">
            <Link href="/dashboard" className="hover:text-vgon-blue-600">Dashboard</Link>
            <span>/</span>
            <span>Funcionários</span>
            <span>/</span>
            <span className="text-slate-800 font-medium">Cargos</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-vgon-blue-600" /> Cargos
          </h1>
          <p className="text-sm text-slate-500 mt-1">Cadastre, edite, ative e desative cargos para vincular aos funcionários.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard"><ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar</Link>
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Novo cargo
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Cadastrados</CardDescription>
            <CardTitle className="text-2xl">{all.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Ativos</CardDescription>
            <CardTitle className="text-2xl">{all.filter((p) => p.active).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Inativos</CardDescription>
            <CardTitle className="text-2xl">{all.filter((p) => !p.active).length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row gap-3 md:items-end md:justify-between">
            <div>
              <CardTitle className="text-base">Lista de cargos</CardTitle>
              <CardDescription className="text-xs pt-1">Exibindo {rows.length} resultado(s)</CardDescription>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:w-[60%] lg:w-1/2">
              <form>
                <div className="relative">
                  <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <Input name="q" defaultValue={q} placeholder="Buscar cargo…" className="pl-9" />
                </div>
              </form>
              <form>
                <select
                  name="dept"
                  defaultValue={dept}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Todos os setores</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </form>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-t-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[280px]">Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead className="w-[140px]">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-slate-500 py-10">Nenhum cargo encontrado.</TableCell>
                  </TableRow>
                )}
                {rows.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-slate-800">{p.name}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {p.departmentId
                        ? <Badge variant="outline">{departments.find((d) => d.id === p.departmentId)?.name || "—"}</Badge>
                        : <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.active ? "success" : "muted"} className="inline-flex items-center gap-1 text-xs">
                        {p.active ? (<><ToggleRight className="h-3 w-3" /> Ativo</>) : (<><ToggleLeft className="h-3 w-3" /> Inativo</>)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost"><Pencil className="h-3.5 w-3.5 mr-1" /> Editar</Button>
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
