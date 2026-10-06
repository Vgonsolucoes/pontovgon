import { requireRole } from "@/server/lib/auth";
import { prisma } from "@/server/db";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import {
  Download,
  ShieldAlert,
  ShieldCheck,
  MonitorDot,
  Cpu,
  HardDriveDownload,
  Network,
  TerminalSquare,
  Fingerprint,
  Clock3,
  ExternalLink,
  Server as ServerIcon,
  Copy as CopyIcon,
} from "lucide-react";
import { Suspense } from "react";

const GITHUB_BASE = "https://github.com/Vgonsolucoes/pontovgon";
const RELEASE_TAG = "agent-v1.0.0";

export const metadata = {
  title: "Integrações · VGON PONTO Agent",
};

type AgentRow = {
  id: string;
  name: string;
  token: string;
  status: string;
  version: string | null;
  computerName: string | null;
  localIp: string | null;
  lastHeartbeatAt: Date | null;
  lastSyncAt: Date | null;
  syncIntervalSec: number;
  enabled: boolean;
  pendingCount: number;
  _count: {
    heartbeats: number;
    commands: number;
    sync_logs: number;
    devices: number;
  };
};

async function loadAgents(): Promise<AgentRow[]> {
  const rows = await prisma.agents.findMany({
    where: { deletedAt: null },
    include: {
      _count: {
        select: {
          heartbeats: true,
          commands: true,
          sync_logs: true,
          devices: true,
        },
      },
      heartbeats: { take: 1, orderBy: { sentAt: "desc" }, select: { pendingEvents: true } },
    },
    orderBy: [{ enabled: "desc" }, { createdAt: "desc" }],
  });
  return rows.map((r) => ({
    ...r,
    pendingCount: r.heartbeats[0]?.pendingEvents ?? 0,
  }));
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function StatusBadge({ s }: { s: string }) {
  const variants: Record<string, "default" | "success" | "destructive" | "secondary" | "outline"> = {
    ONLINE: "success",
    SYNCING: "default",
    OFFLINE: "secondary",
    AUTH_ERROR: "destructive",
    API_OFFLINE: "outline",
  };
  return <Badge variant={(variants[s] ?? "outline") as any}>{s}</Badge>;
}

function CopyCode({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="bg-slate-950 text-slate-100 rounded-lg p-4 text-xs sm:text-sm overflow-x-auto whitespace-pre-wrap break-words border border-slate-800">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => navigator?.clipboard?.writeText(code).catch(() => {})}
        className="hidden sm:flex absolute right-2 top-2 items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700"
      >
        <CopyIcon className="w-3 h-3" /> Copiar
      </button>
    </div>
  );
}

function AgentTokenSeed() {
  const LABEL = "agent_local_001";
  const pad = "VgOnSeGuRo2o26!";
  const LABEL_CLEAN = LABEL.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 12);
  const TOKEN = (LABEL_CLEAN + "_" + pad).padEnd(48, pad).slice(0, 48);
  const JSON_EXAMPLE = `{
  "apiUrl": "https://vgonponto-web.54myeq.easypanel.host",
  "agentToken": "${TOKEN}",
  "syncIntervalSec": 30,
  "pollCommandsIntervalSec": 30,
  "heartbeatIntervalSec": 30,
  "mock": false,
  "dbPath": "./data/agent.db",
  "logLevel": "info",
  "idface": {
    "url": "http://192.168.1.150",
    "port": 80,
    "user": "admin",
    "password": "admin",
    "deviceId": "4408801109279099",
    "deviceSerialNumber": "0M0200/01017B",
    "deviceFirmware": "6.18.6",
    "deviceMac": "FC:52:CE:8A:B9:91",
    "readEventsBatchSize": 500,
    "readEventsFromMinutesAgo": 1440
  }
}`;
  const JSON_MOCK = `{
  "apiUrl": "https://vgonponto-web.54myeq.easypanel.host",
  "agentToken": "${TOKEN}",
  "mock": true,
  "syncIntervalSec": 10,
  "dbPath": "./data/agent.db",
  "logLevel": "debug",
  "idface": {
    "url": "http://127.0.0.1",
    "port": 80,
    "user": "admin",
    "password": "admin",
    "deviceId": "4408801109279099",
    "deviceSerialNumber": "0M0200/01017B"
  }
}`;
  return { JSON_EXAMPLE, JSON_MOCK, TOKEN };
}

export default async function IntegracoesAgentPage() {
  const session = await requireRole(["MASTER", "ADMIN"]);
  const AGENT = AgentTokenSeed();
  const agents = await loadAgents();

  return (
    <div className="space-y-6 p-4 sm:p-8 max-w-[1400px] mx-auto">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Integrações
          </Badge>
          <Badge variant="secondary" className="text-xs">
            MODELO B · Agente Local LAN
          </Badge>
          <Badge variant="default" className="bg-emerald-600 text-xs">
            <ShieldCheck className="w-3 h-3 mr-1" />
            Nunca servidor → IP privado iDFace
          </Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-50 tracking-tight">
          VGON PONTO Agent — download e instalação
        </h1>
        <p className="text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed">
          O VGON PONTO Agent é o software local que roda dentro da sua LAN, coleta as marcações diretamente do
          Control iD iDFace via HTTP, armazena em fila local SQLite e envia para a nuvem de forma{" "}
          <span className="font-semibold">idempotente</span> (nunca duplica marcação). O servidor NUNCA abre conexão
          com o IP privado do relógio — toda comunicação é iniciada pelo agent.
        </p>
      </header>

      <Alert variant="destructive" className="border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle className="text-amber-900 dark:text-amber-200 font-semibold">
          ⚠️ Nunca exponha a porta do iDFace à internet
        </AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-300">
          O MODELO B é <strong>obrigatório</strong>. Instale o agent em um PC/mini-pc/Raspberry Pi que consiga alcançar o iDFace pela LAN.
          Credenciais do iDFace ficam apenas no <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-[0.8em]">agent.config.json</code> local —
          nunca saem da sua rede.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MonitorDot className="w-5 h-5 text-sky-600" /> Windows x64 (Portable ZIP)
            </CardTitle>
            <CardDescription>Descompacte e execute com `npm start`. Ideal para testes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href={`${GITHUB_BASE}/releases/download/${RELEASE_TAG}/vgon-ponto-agent-v1.0.0-win-x64.zip`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="w-full">
                <HardDriveDownload className="w-4 h-4 mr-2" /> Download .zip (~45 MB)
              </Button>
            </Link>
            <p className="text-xs text-slate-500">Requer Node.js ≥ 18 · Windows 10/11 ou Server 2019+</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MonitorDot className="w-5 h-5 text-sky-700" /> Windows x64 Setup (Instalador)
            </CardTitle>
            <CardDescription>Instala como Windows Service automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href={`${GITHUB_BASE}/releases/download/${RELEASE_TAG}/vgon-ponto-agent-v1.0.0-win-x64.exe`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" /> Baixar Setup.exe (breve)
              </Button>
            </Link>
            <p className="text-xs text-slate-500">Use o .zip por enquanto. Instalador oficial em release futura.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cpu className="w-5 h-5 text-emerald-600" /> Linux x64 (tar.gz)
            </CardTitle>
            <CardDescription>Ubuntu / Debian / RHEL — systemd.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href={`${GITHUB_BASE}/releases/download/${RELEASE_TAG}/vgon-ponto-agent-v1.0.0-linux-x64.tar.gz`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full">
                <HardDriveDownload className="w-4 h-4 mr-2" /> Baixar .tar.gz
              </Button>
            </Link>
            <p className="text-xs text-slate-500">Use `tar -xzf` + `npm start` como serviço systemd.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ServerIcon className="w-5 h-5 text-rose-600" /> Raspberry Pi (ARM64)
            </CardTitle>
            <CardDescription>Debian .pkg para Pi 3B+ / 4 / 5.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link
              href={`${GITHUB_BASE}/releases/download/${RELEASE_TAG}/vgon-ponto-agent-v1.0.0-linux-arm64.deb`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" /> Baixar .deb
              </Button>
            </Link>
            <p className="text-xs text-slate-500">Instale: `sudo dpkg -i vgon-ponto-agent*.deb`</p>
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        <section className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <TerminalSquare className="w-5 h-5" /> Passo a passo de instalação (Windows)
              </CardTitle>
              <CardDescription>6 passos para colocar o agent rodando em 5 minutos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ol className="space-y-6 list-decimal pl-5 text-slate-700 dark:text-slate-300 space-y-5 [&>li::marker]:font-bold [&>li::marker]:text-slate-900">
                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">Extraia o .zip</div>
                  <div className="text-sm leading-relaxed">
                    Baixe o arquivo <em>vgon-ponto-agent-v1.0.0-win-x64.zip</em>, extraia em uma pasta permanente
                    (ex: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">C:\VGON\agent</code>).
                    Não rode de dentro da pasta Downloads nem do .zip direto.
                  </div>
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Instale Node.js (se não tiver)
                  </div>
                  <div className="text-sm leading-relaxed">
                    Abra PowerShell e digite <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">node --version</code>.
                    Se der erro, baixe o LTS (≥ 18) em{" "}
                    <Link className="text-sky-700 underline" target="_blank" rel="noopener noreferrer" href="https://nodejs.org/pt-br/download">
                      nodejs.org <ExternalLink className="w-3 h-3 inline" />
                    </Link>
                  </div>
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Configure o <code>agent.config.json</code>
                  </div>
                  <div className="text-sm leading-relaxed">
                    Copie o arquivo <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">agent.config.json.example</code>
                    &nbsp;para <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">agent.config.json</code> e
                    preencha com as credenciais do seu iDFace (na LAN) e o{" "}
                    <strong>Agent Token</strong> exibido na tabela abaixo (primeiro agent tem token padrão do seed).
                    Exemplo pronto (substitua IP/usuário/senha):
                  </div>
                  <CopyCode code={AGENT.JSON_EXAMPLE} />
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Rode o primeiro teste em modo MOCK
                  </div>
                  <div className="text-sm leading-relaxed">
                    Valide tudo sem precisar do iDFace real — gera marcações sintéticas e envia para API.
                    Abra PowerShell na pasta do agent e digite:
                  </div>
                  <CopyCode code={`# No PowerShell (na pasta do agent onde está o package.json)
$env:MOCK = "true"
npm install
npm run start
# ou no cmd (batch):
#   set MOCK=true
#   npm install && npm start`} />
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    ✅ Procure no log por <code>Heartbeat OK</code> e{" "}
                    <code>Lote enviado para API created=N</code>. Se aparecer, seu token e a URL estão corretos.
                  </p>
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Troque para MOCK=false e use credenciais reais do iDFace
                  </div>
                  <div className="text-sm leading-relaxed">
                    Edite <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">agent.config.json</code> novamente,
                    set <code>mock</code> para <code>false</code> e ajuste{" "}
                    <code>idface.url</code> (IP LAN do iDFace), usuário e senha padrão (admin/admin ou definido no equipamento).
                    Confirme pingando o IP: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">ping 192.168.1.150 -t</code>.
                    Depois rode:
                  </div>
                  <CopyCode code={`# Confirme primeiro
npm run start
# Se aparecer login OK, login iDFace, ... capturados eventos -> pronto.`} />
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    (Opcional) Instale como Windows Service
                  </div>
                  <div className="text-sm leading-relaxed">
                    Assim o agent inicia sozinho após reinício do servidor/posto. Rode PowerShell COMO ADMINISTRADOR:
                  </div>
                  <CopyCode code={`npm install -g node-windows
npm run service:install
# para desinstalar: npm run service:uninstall`} />
                  <p className="text-xs text-slate-500">
                    No sistema de produção Vgon recomenda-se usar um mini-pc Windows ou Raspberry Pi sempre ligado,
                    com usuário comum e o agent como serviço rodando em background.
                  </p>
                </li>
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Clock3 className="w-5 h-5" /> Modo MOCK (validação rápida sem iDFace)
              </CardTitle>
              <CardDescription>
                Pule todos os passos do iDFace real e veja marcações sintéticas chegando no dashboard em 30 segundos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Crie um arquivo <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">agent.config.json</code>
                com o conteúdo abaixo e rode <code>npm install &amp;&amp; npm run start</code>.
                Ele vai gerar ~16 marcações/colaborador/dia e enviar via batch idempotente para a API.
              </p>
              <CopyCode code={AGENT.JSON_MOCK} />
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Network className="w-5 h-5 text-indigo-600" /> Arquitetura resumida
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="relative border-l border-slate-200 dark:border-slate-800 ml-2 space-y-5">
                {[
                  { t: "iDFace", d: "Relógio na LAN (IP privado). Apenas HTTP local.", ic: Fingerprint },
                  { t: "VGON PONTO Agent", d: "Windows/Raspberry. Polling 30s. Fila SQLite offline.", ic: ServerIcon },
                  { t: "HTTPS WAN", d: "Agent → POST /api/agents/time-entries/batch (idempotente).", ic: Network },
                  { t: "EasyPanel + Postgres", d: "Nuvem Vgon. UNIQUE(deviceId,eventId) = sem duplica.", ic: HardDriveDownload },
                  { t: "Command Queue", d: "Servidor cria PENDING. Agent POLL a cada 30s, executa, PATCH resultado.", ic: RefreshCcw },
                ].map((x, i) => (
                  <li key={x.t} className="pl-5">
                    <div className="absolute -left-2.5 w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center ring-2 ring-white dark:ring-slate-950">
                      <x.ic className="w-3 h-3 text-indigo-600 dark:text-indigo-300" />
                    </div>
                    <div className="font-semibold text-slate-900 dark:text-slate-50 text-sm">
                      {i + 1}. {x.t}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{x.d}</div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Fingerprint className="w-5 h-5 text-emerald-600" /> Dados iDFace padrão (seed)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <dl className="divide-y divide-slate-100 dark:divide-slate-800">
                {[
                  ["Modelo", "Control iD iDFace"],
                  ["Serial", "0M0200/01017B"],
                  ["Firmware", "6.18.6"],
                  ["MAC", "FC:52:CE:8A:B9:91"],
                  ["Device ID (unique)", "4408801109279099"],
                  ["Usuário padrão", "admin / admin"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5">
                    <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                    <dd className="font-mono text-slate-900 dark:text-slate-100 text-[0.78rem] text-right">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href="/integracoes/control-id"
                className="text-xs text-sky-700 underline flex items-center gap-1 pt-2"
              >
                Abrir tela do iDFace → <ExternalLink className="w-3 h-3" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link href={GITHUB_BASE} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:underline">
                  <ExternalLink className="w-4 h-4 text-slate-700" /> GitHub Releases
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Verifique sempre releases atualizadas, changelog e checksums em{" "}
                <Link
                  className="text-sky-700 underline"
                  href={`${GITHUB_BASE}/releases/tag/${RELEASE_TAG}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {RELEASE_TAG}
                </Link>
                .
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>

      <Separator />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Users className="w-5 h-5 text-slate-700" /> Agents cadastrados
            </CardTitle>
            <CardDescription>
              Status em tempo real, token para colar no <code>agent.config.json</code> e contadores.
            </CardDescription>
          </div>
          <Link href="/integracoes/logs">
            <Button variant="outline" size="sm">Ver logs de sincronização</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-sm text-slate-500 p-4">Carregando agents...</div>}>
            <AgentTable rows={agents} seedToken={AGENT.TOKEN} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentTable({ rows, seedToken }: { rows: AgentRow[]; seedToken: string }) {
  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-6 text-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Nenhum agent cadastrado ainda. Execute o <code>prisma db seed</code> para criar o agent inicial{" "}
          <strong>Agent Local 001 - Sede Vgon</strong> com token:
        </p>
        <CopyCode code={seedToken} />
      </div>
    );
  }
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Máquina / IP</TableHead>
            <TableHead className="text-right">Heartbeat</TableHead>
            <TableHead className="text-right">Último sync</TableHead>
            <TableHead className="text-right">Pendentes</TableHead>
            <TableHead>Agent Token (Bearer)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.enabled ? "" : "opacity-50"}>
              <TableCell>
                <div className="font-medium text-slate-900 dark:text-slate-50">{r.name}</div>
                <div className="text-xs text-slate-500">
                  v{r.version ?? "?"} · {r.syncIntervalSec}s · {r._count.devices} device(s) · {r._count.commands} cmd
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge s={r.status} />
              </TableCell>
              <TableCell>
                <div className="text-sm font-mono">{r.computerName ?? "—"}</div>
                <div className="text-xs text-slate-500">{r.localIp ?? "—"}</div>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-sm">{fmtDate(r.lastHeartbeatAt)}</TableCell>
              <TableCell className="text-right whitespace-nowrap text-sm">{fmtDate(r.lastSyncAt)}</TableCell>
              <TableCell className="text-right font-mono">{r.pendingCount}</TableCell>
              <TableCell>
                <div className="max-w-xs">
                  <div className="truncate font-mono text-xs bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800" title={r.token}>
                    {r.token}
                  </div>
                  <button
                    type="button"
                    onClick={() => navigator?.clipboard?.writeText(r.token).catch(() => {})}
                    className="text-[11px] mt-1 text-sky-700 hover:underline flex items-center gap-1"
                  >
                    <CopyIcon className="w-3 h-3" /> Copiar token
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// shim components used but not in the minimal sidebar imports — avoid build errors
function RefreshCcw(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function Users(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
