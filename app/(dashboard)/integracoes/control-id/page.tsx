import { requireRole } from "@/server/lib/auth";
import { prisma } from "@/server/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  Fingerprint,
  ShieldAlert,
  RefreshCw,
  Activity,
  Clock,
  ExternalLink,
  Network,
  Cpu,
  ServerCrash,
  Users as UsersIcon,
  ListChecks,
} from "lucide-react";

export const metadata = {
  title: "Integrações · Control iD iDFace",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

const IDFACE_MASTER = {
  name: "iDFace Principal",
  manufacturer: "Control ID",
  model: "iDFace",
  serialNumber: "0M0200/01017B",
  firmwareVersion: "6.18.6",
  firmwareSecBox: "—",
  macAddress: "FC:52:CE:8A:B9:91",
  deviceUniqueId: "4408801109279099",
  location: "Sede Vgon — Recepção",
};

export default async function ControlIdPage() {
  const session = await requireRole(["MASTER", "ADMIN", "RH"]);

  const device = await prisma.devices.findFirst({
    where: { deviceUniqueId: IDFACE_MASTER.deviceUniqueId, deletedAt: null },
    include: {
      agent: {
        include: {
          heartbeats: {
            take: 1,
            orderBy: { sentAt: "desc" },
          },
        },
      },
      _count: {
        select: {
          device_users: true,
          time_entries: true,
          sync_logs: true,
        },
      },
    },
  });

  const status = device?.agent?.status ?? "OFFLINE";
  const lastHb = device?.agent?.lastHeartbeatAt ?? null;
  const lastSync = device?.lastCommunication ?? device?.lastEntryAt ?? null;
  const hbPending = device?.agent?.heartbeats[0]?.pendingEvents ?? 0;

  async function criarComandoSyncAcao(_: FormData) {
    "use server";
    const sess = await requireRole(["MASTER", "ADMIN"]);
    const d = await prisma.devices.findFirst({
      where: { deviceUniqueId: IDFACE_MASTER.deviceUniqueId, deletedAt: null },
      select: { agentId: true },
    });
    if (!d?.agentId) {
      // ignore — no agent bound yet
      return;
    }
    await prisma.commands.create({
      data: {
        agentId: d.agentId,
        commandType: "SYNC_NOW",
        payload: {},
        status: "PENDING",
      },
    });
  }

  return (
    <div className="space-y-6 p-4 sm:p-8 max-w-[1200px] mx-auto">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Integrações</Badge>
          <Badge variant="secondary">Control iD</Badge>
          <Badge className="bg-emerald-600 text-xs">
            <Activity className="w-3 h-3 mr-1" />
            Equipamento mestre
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Control iD · iDFace Principal
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          Visão geral do equipamento de reconhecimento facial e estado da integração via{" "}
          <strong>MODELO B — Agente Local</strong>. O servidor NUNCA conecta diretamente a este relógio —
          todas as ações são comandadas via <em>Command Queue</em> polled pelo Agent.
        </p>
      </header>

      <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
          ⚠️ Acesso LAN apenas via Agent
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-300">
          Este equipamento está no IP privado da LAN (ex: 192.168.1.150). Não abrir portas no firewall.
          Instale o <Link href="/integracoes/agents" className="underline font-semibold">VGON PONTO Agent</Link> em uma
          máquina da mesma rede. Botões abaixo criam comandos PENDING na fila — o Agent coleta e executa.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Status Agent</CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Activity className="w-5 h-5 text-emerald-600" /> {status}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Último heartbeat: <span className="font-mono">{fmt(lastHb)}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Última sincronização</CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <RefreshCw className="w-5 h-5 text-indigo-600" /> {fmt(lastSync)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Eventos na fila SQLite do agent: <span className="font-mono">{hbPending}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Colaboradores vinculados</CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <UsersIcon className="w-5 h-5 text-sky-600" /> {device?._count.device_users ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Marcações recebidas: <span className="font-mono">{device?._count.time_entries ?? 0}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Sync logs (últimos)</CardDescription>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ListChecks className="w-5 h-5 text-rose-600" /> {device?._count.sync_logs ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link href="/integracoes/logs" className="text-xs text-sky-700 underline">Abrir logs →</Link>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Fingerprint className="w-5 h-5 text-indigo-600" /> Dados do equipamento
              </CardTitle>
              <CardDescription>
                Dados técnicos preenchidos pelo seed (valores reais a confirmar no equipamento).
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <form action={criarComandoSyncAcao}>
                <Button type="submit" variant="default" className="bg-emerald-600 hover:bg-emerald-700">
                  <RefreshCw className="w-4 h-4 mr-2" /> Sincronizar agora
                </Button>
              </form>
              <Link href="/integracoes/agents">
                <Button variant="outline">
                  <ServerCrash className="w-4 h-4 mr-2" /> Abrir tela do Agent
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableBody>
                  {(
                    [
                      ["Nome", device?.name ?? IDFACE_MASTER.name],
                      ["Fabricante", device?.manufacturer ?? IDFACE_MASTER.manufacturer],
                      ["Modelo", device?.model ?? IDFACE_MASTER.model],
                      ["Serial Number", device?.serialNumber ?? IDFACE_MASTER.serialNumber],
                      ["Firmware", device?.firmwareVersion ?? IDFACE_MASTER.firmwareVersion],
                      ["SecBox (Firmware)", device?.firmwareSecBox ?? IDFACE_MASTER.firmwareSecBox],
                      ["Endereço MAC", device?.macAddress ?? IDFACE_MASTER.macAddress],
                      ["Device ID (único iDFace)", device?.deviceUniqueId ?? IDFACE_MASTER.deviceUniqueId],
                      ["Localização", device?.location ?? IDFACE_MASTER.location],
                      ["Vinculado ao Agent", device?.agent?.name ?? "— (vincular em /integracoes/agents)"],
                      ["Última comunicação (LAN)", fmt(device?.lastCommunication ?? null)],
                      ["Última marcação recebida", fmt(device?.lastEntryAt ?? null)],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="w-1/3 font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50">
                        {k}
                      </TableCell>
                      <TableCell className="font-mono text-[0.82rem]">{v}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Cpu className="w-5 h-5 text-emerald-600" /> Endpoints iDFace (na LAN)
              </CardTitle>
              <CardDescription>Documentação de referência — firmware 6.18.6</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <ul className="space-y-2 text-xs font-mono">
                <li className="bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                  GET /api.cgi?action=login&user=...&pwd=BASE64
                </li>
                <li className="bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                  GET /api.cgi?action=get_events&from=ISO&limit=500&session=...
                </li>
                <li className="bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                  GET /api.cgi?action=get_device_status&session=...
                </li>
                <li className="bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                  GET /api.cgi?action=enroll_user&user_id=...&name=...&session=...
                </li>
                <li className="bg-slate-100 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                  GET /api.cgi?action=reboot&session=...
                </li>
              </ul>
              <p className="text-xs text-slate-500 pt-2">
                Estes endpoints são usados apenas pelo Agent Local (na LAN). A nuvem nunca chama eles.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Network className="w-5 h-5 text-sky-600" /> Comunicação da nuvem ↔ Agent
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-slate-600 dark:text-slate-400">
                O Agent (na LAN) bate nas 4 rotas HTTPS abaixo a cada 30s.
              </p>
              <ol className="list-decimal pl-5 space-y-1 text-xs font-mono">
                <li>POST /api/agents/heartbeat</li>
                <li>GET /api/agents/commands/next</li>
                <li>PATCH /api/agents/commands/:id</li>
                <li>POST /api/agents/time-entries/batch (idempotente)</li>
              </ol>
              <Separator className="my-3" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Sync default
                </span>
                <span className="font-mono">30 segundos</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ExternalLink className="w-4 h-4" /> Recursos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Link className="flex items-center gap-2 text-sky-700 hover:underline" href="https://controlid.com.br" target="_blank" rel="noopener noreferrer">
                Site oficial Control ID <ExternalLink className="w-3 h-3" />
              </Link>
              <Link className="flex items-center gap-2 text-sky-700 hover:underline" href="/integracoes/agents">
                Baixar VGON PONTO Agent
              </Link>
              <Link className="flex items-center gap-2 text-sky-700 hover:underline" href="/integracoes/sincronizacoes">
                Ver sincronizações
              </Link>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
