"use client";
import Link from "next/link";
import {
  Users,
  Clock3,
  UserCheck,
  UserX,
  AlertTriangle,
  PlaneTakeoff,
  PlusCircle,
  Landmark,
  Server,
  Fingerprint,
  ChevronRight,
  Activity,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn, formatMinutesSigned } from "@/lib/utils";

type StatProps = {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "blue" | "emerald" | "amber" | "rose" | "sky" | "violet" | "slate";
  hint?: string;
  trend?: string;
};

const STATS: StatProps[] = [
  { label: "Funcionários ativos", value: "128", icon: <Users className="h-5 w-5" />, tone: "blue", hint: "+2 nesta semana", trend: "+1,6%" },
  { label: "Trabalhando agora", value: "84", icon: <UserCheck className="h-5 w-5" />, tone: "emerald", hint: "65,6% dos ativos", trend: "em tempo real" },
  { label: "Atrasados hoje", value: "06", icon: <AlertTriangle className="h-5 w-5" />, tone: "amber", hint: "4 minutos em média", trend: "-2 vs ontem" },
  { label: "Ausentes hoje", value: "03", icon: <UserX className="h-5 w-5" />, tone: "rose", hint: "1 justificado · 2 faltas", trend: "abaixo da média" },
  { label: "Em férias", value: "05", icon: <PlaneTakeoff className="h-5 w-5" />, tone: "sky", hint: "Retornam nos próximos 15 dias" },
  { label: "Horas extras (mês)", value: "+123h", icon: <PlusCircle className="h-5 w-5" />, tone: "violet", hint: "vs 98h mês anterior" },
  { label: "Banco de horas", value: "+42h", icon: <Landmark className="h-5 w-5" />, tone: "emerald", hint: "saldo consolidado", trend: "+7h na semana" },
  { label: "iDFace", value: "● Online", icon: <Fingerprint className="h-5 w-5" />, tone: "emerald", hint: "serial 0M0200/01017B", trend: "última sincro agora" },
  { label: "VGON PONTO Agent", value: "● Online", icon: <Server className="h-5 w-5" />, tone: "emerald", hint: "v1.0.0 · 30s", trend: "heartbeat há 18s" },
];

const TONE_MAP: Record<StatProps["tone"], string> = {
  blue: "bg-sky-500/15 text-sky-700 ring-sky-500/30",
  emerald: "bg-emerald-500/15 text-emerald-700 ring-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-700 ring-amber-500/30",
  rose: "bg-rose-500/15 text-rose-700 ring-rose-500/30",
  sky: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/30",
  violet: "bg-violet-500/15 text-violet-700 ring-violet-500/30",
  slate: "bg-slate-500/15 text-slate-700 ring-slate-500/30",
};

type Sit = "Normal" | "Atrasado" | "Ausente" | "Férias" | "Incompleto";
const SIT_BADGE: Record<Sit, { label: string; tone: "success" | "warning" | "danger" | "info" | "muted"; dot: string }> = {
  Normal: { label: "Normal", tone: "success", dot: "bg-emerald-500" },
  Atrasado: { label: "Atrasado", tone: "warning", dot: "bg-amber-500" },
  Ausente: { label: "Ausente", tone: "danger", dot: "bg-rose-500" },
  Férias: { label: "Férias", tone: "info", dot: "bg-sky-500" },
  Incompleto: { label: "Incompleto", tone: "muted", dot: "bg-orange-500" },
};

const HOJE: Array<{
  nome: string;
  setor: string;
  cargo: string;
  entrada: string;
  saida1: string;
  retorno: string;
  saida: string;
  trabalhado: string;
  saldo: string;
  situacao: Sit;
}> = [
  { nome: "Ana Carolina Silva", setor: "Financeiro", cargo: "Analista Pleno", entrada: "07:32", saida1: "12:01", retorno: "12:58", saida: "17:33", trabalhado: "08:04", saldo: "+00:04", situacao: "Normal" },
  { nome: "Bruno Henrique Costa", setor: "Técnico", cargo: "Técnico Suporte Sênior", entrada: "07:44", saida1: "12:00", retorno: "13:02", saida: "--:--", trabalhado: "05:02", saldo: "-02:58", situacao: "Incompleto" },
  { nome: "Carla Mendes Pereira", setor: "RH", cargo: "Analista de RH", entrada: "07:38", saida1: "12:03", retorno: "13:10", saida: "17:50", trabalhado: "08:05", saldo: "+00:05", situacao: "Normal" },
  { nome: "Daniel Rocha Alves", setor: "Comercial", cargo: "Executivo de Vendas", entrada: "07:55", saida1: "--:--", retorno: "--:--", saida: "--:--", trabalhado: "--:--", saldo: "--:--", situacao: "Atrasado" },
  { nome: "Elisa Ferreira Lima", setor: "Diretoria", cargo: "Diretora Financeira", entrada: "--:--", saida1: "--:--", retorno: "--:--", saida: "--:--", trabalhado: "--:--", saldo: "--:--", situacao: "Férias" },
  { nome: "Fabrício Almeida Souza", setor: "Administrativo", cargo: "Auxiliar Adm.", entrada: "--:--", saida1: "--:--", retorno: "--:--", saida: "--:--", trabalhado: "--:--", saldo: "--:--", situacao: "Ausente" },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Bom dia, Master 👋</h2>
          <p className="text-sm text-slate-500">Segunda-feira, {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })} · Acompanhe a jornada em tempo real.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/ponto/espelho">Ver espelho de ponto</Link>
          </Button>
          <Button asChild>
            <Link href="/ponto/ajustes">Aprovar ajustes <ChevronRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </section>

      {/* Cards de indicadores */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
        {STATS.map((s) => (
          <Card key={s.label} className="shadow-sm hover:shadow-md transition">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{s.label}</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900 leading-tight">{s.value}</p>
                  {s.hint && <p className="mt-1 text-xs text-slate-500">{s.hint}</p>}
                </div>
                <div className={cn("h-10 w-10 rounded-lg ring-1 flex items-center justify-center", TONE_MAP[s.tone])}>
                  {s.icon}
                </div>
              </div>
              {s.trend && (
                <div className="mt-3 flex items-center gap-1 text-[11px] text-emerald-700">
                  <TrendingUp className="h-3.5 w-3.5" /> <span className="font-medium">{s.trend}</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Tabela Situação de Hoje + Card iDFace */}
      <section className="grid xl:grid-cols-3 gap-5">
        <Card className="xl:col-span-2 shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock3 className="h-5 w-5 text-vgon-blue-600" /> Situação de hoje
              </CardTitle>
              <CardDescription>Estado atual dos colaboradores. Clique em uma linha para detalhar dia.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Normal (2)
              </Badge>
              <Badge variant="warning" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Atrasados (1)
              </Badge>
              <Badge variant="danger" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Ausentes (1)
              </Badge>
              <Badge variant="info" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" /> Férias (1)
              </Badge>
              <Badge variant="muted" className="gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" /> Incompleto (1)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead>Retorno</TableHead>
                  <TableHead>Saída</TableHead>
                  <TableHead className="text-right">Trabalhado</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {HOJE.map((f) => {
                  const badge = SIT_BADGE[f.situacao];
                  return (
                    <TableRow key={f.nome} className="cursor-pointer hover:bg-blue-50/40">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback>{initials(f.nome)}</AvatarFallback>
                          </Avatar>
                          <div className="leading-tight min-w-0">
                            <p className="font-medium text-slate-800 truncate max-w-[220px]">{f.nome}</p>
                            <p className="text-xs text-slate-500 truncate max-w-[220px]">{f.cargo} · {f.setor}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-slate-700">{f.entrada}</TableCell>
                      <TableCell className="font-mono text-slate-700">{f.saida1}</TableCell>
                      <TableCell className="font-mono text-slate-700">{f.retorno}</TableCell>
                      <TableCell className="font-mono text-slate-700">{f.saida}</TableCell>
                      <TableCell className="font-mono text-right text-slate-800">{f.trabalhado}</TableCell>
                      <TableCell className={cn(
                        "font-mono text-right font-semibold",
                        f.saldo.startsWith("+") ? "text-emerald-600" : f.saldo.startsWith("-") ? "text-rose-600" : "text-slate-600",
                      )}>{formatMinutesSigned(parseSigned(f.saldo))}</TableCell>
                      <TableCell>
                        <Badge variant={badge.tone} className="gap-1.5">
                          <span className={cn("h-1.5 w-1.5 rounded-full", badge.dot)} /> {badge.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter className="border-t bg-slate-50/60 rounded-b-xl flex items-center justify-between py-3">
            <p className="text-xs text-slate-500">Atualizado em tempo real via integração VGON PONTO Agent.</p>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/ponto/marcacoes">Ver todas as marcações <ChevronRight className="h-4 w-4" /></Link>
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-5">
          <Card className="shadow-sm border-emerald-100">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-vgon-blue-500 to-emerald-500 text-white flex items-center justify-center">
                    <Fingerprint className="h-4.5 w-4.5" />
                  </div>
                  Control iD · iDFace
                </CardTitle>
                <Badge variant="success" className="gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
                </Badge>
              </div>
              <CardDescription>Equipamento físico de reconhecimento facial.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="grid grid-cols-2 gap-3 text-sm py-4">
              <Info label="Equipamento" value="iDFace" />
              <Info label="Firmware" value="6.18.6" />
              <Info label="Serial" value="0M0200/01017B" mono />
              <Info label="Device ID" value="4408801109279099" mono />
              <Info label="MAC" value="FC:52:CE:8A:B9:91" mono />
              <Info label="Última sincro" value="agora" />
              <Info label="Eventos pendentes" value="0" />
              <Info label="Última marcação" value="17:33" />
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/integracoes/control-id">Ver detalhes</Link>
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500">
                <Activity className="h-4 w-4" /> Sincronizar agora
              </Button>
            </CardFooter>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="h-9 w-9 rounded-lg bg-violet-500/15 text-violet-700 ring-1 ring-violet-500/30 flex items-center justify-center">
                  <Server className="h-4.5 w-4.5" />
                </div>
                VGON PONTO Agent
              </CardTitle>
              <CardDescription>Agente local na LAN do equipamento.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="grid grid-cols-2 gap-3 text-sm py-4">
              <Info label="Status" value="● Online" tone="ok" />
              <Info label="Versão" value="1.0.0" />
              <Info label="Computador" value="VGON-SRV-01" />
              <Info label="IP local" value="10.0.0.21" mono />
              <Info label="Último heartbeat" value="há 18s" />
              <Info label="Intervalo" value="30s" />
              <Info label="Sistema" value="Windows Server" />
              <Info label="Eventos fila" value="0" />
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button variant="outline" className="flex-1" asChild>
                <Link href="/integracoes/agents">Gerenciar agents</Link>
              </Button>
              <Button variant="secondary" className="flex-1" asChild>
                <Link href="/configuracoes/dispositivos">Dispositivos</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Info({ label, value, tone, mono }: { label: string; value: string; tone?: "ok" | "warn" | "err"; mono?: boolean }) {
  const color =
    tone === "ok" ? "text-emerald-700 font-semibold" : tone === "warn" ? "text-amber-700 font-semibold" : tone === "err" ? "text-rose-700 font-semibold" : "text-slate-800 font-medium";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn("mt-0.5", color, mono && "font-mono text-[13px]")}>{value}</p>
    </div>
  );
}

function parseSigned(s: string): number {
  if (s === "--:--" || !s) return NaN;
  const signal = s.startsWith("-") ? -1 : 1;
  const [h, m] = s.replace(/[+-]/, "").split(":").map((p) => parseInt(p, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return NaN;
  return (h * 60 + m) * signal;
}
