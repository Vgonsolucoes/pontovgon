import { requireRole } from "@/server/lib/auth";
import { prisma } from "@/server/db";
import { isRecentCommunication } from "@/server/lib/operational";
import fs from "node:fs";
import path from "node:path";
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
  HardDriveDownload,
  Network,
  TerminalSquare,
  Fingerprint,
  ExternalLink,
  Server as ServerIcon,
  PackageOpen,
  FileWarning,
  Users,
  RefreshCcw,
} from "lucide-react";
import { Suspense } from "react";
import { CopyCode, CopyTokenButton } from "@/components/integrations/copy-code";
import { AgentActions } from "@/components/integrations/agent-actions";

const GITHUB_BASE = "https://github.com/Vgonsolucoes/pontovgon";

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
  sentToday: number;
  failedToday: number;
  _count: {
    heartbeats: number;
    commands: number;
    sync_logs: number;
    devices: number;
  };
};

type LoadAgentsResult =
  | { ok: true; rows: AgentRow[] }
  | { ok: false; message: string };

/** Início do dia corrente em America/Sao_Paulo (UTC-3 fixo, sem horário de verão desde 2019). */
function startOfDaySaoPaulo(): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T00:00:00-03:00`);
}

// Nunca deixa uma falha de consulta derrubar a pagina inteira:
// retorna estado de erro para exibicao amigavel e registra detalhes no log do servidor.
async function loadAgents(): Promise<LoadAgentsResult> {
  try {
    const dayStart = startOfDaySaoPaulo();
    const [rows, syncAgg] = await Promise.all([
      prisma.agents.findMany({
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
      }),
      prisma.device_sync_logs.groupBy({
        by: ["agentId"],
        where: { startedAt: { gte: dayStart } },
        _sum: { newEvents: true, failed: true },
      }),
    ]);
    const aggByAgent = new Map(
      syncAgg
        .filter((a) => a.agentId)
        .map((a) => [
          a.agentId as string,
          { sent: a._sum.newEvents ?? 0, failed: a._sum.failed ?? 0 },
        ]),
    );
    const mapped = rows.map((r: any) => ({
      ...r,
      status: r.enabled && isRecentCommunication(r.lastHeartbeatAt) ? r.status : "OFFLINE",
      pendingCount: r.heartbeats[0]?.pendingEvents ?? 0,
      sentToday: aggByAgent.get(r.id)?.sent ?? 0,
      failedToday: aggByAgent.get(r.id)?.failed ?? 0,
    })) as AgentRow[];
    return { ok: true, rows: mapped };
  } catch (err) {
    console.error("[integracoes/agents] falha ao consultar agents:", err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro desconhecido ao consultar o banco de dados.",
    };
  }
}

type AgentManifest = {
  version: string;
  fileName: string;
  sha256: string;
  sizeBytes: number;
  arch: string;
  builtAt: string;
};

/**
 * Lê o manifest gerado pelo build do instalador (agent/installer/build-installer.ps1
 * copia para public/downloads/). Ausência do arquivo = instalador ainda não publicado
 * (estado vazio honesto, sem links quebrados).
 */
function loadAgentManifest(): AgentManifest | null {
  try {
    const p = path.join(process.cwd(), "public", "downloads", "agent-manifest.json");
    if (!fs.existsSync(p)) return null;
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as Partial<AgentManifest>;
    if (!raw.fileName || !raw.version || !raw.sha256) return null;
    const exeExists = fs.existsSync(
      path.join(process.cwd(), "public", "downloads", raw.fileName),
    );
    if (!exeExists) return null;
    return {
      version: String(raw.version),
      fileName: String(raw.fileName),
      sha256: String(raw.sha256),
      sizeBytes: Number(raw.sizeBytes ?? 0),
      arch: String(raw.arch ?? "windows-x64"),
      builtAt: String(raw.builtAt ?? ""),
    };
  } catch (err) {
    console.error("[integracoes/agents] falha ao ler agent-manifest.json:", err);
    return null;
  }
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

function buildConfigExample(token: string | null): string {
  return `{
  "apiUrl": "https://vgonponto-web.54myeq.easypanel.host",
  "agentToken": "${token ?? "COLE_O_AGENT_TOKEN_DA_TABELA_ABAIXO"}",
  "syncIntervalSec": 30,
  "pollCommandsIntervalSec": 15,
  "heartbeatIntervalSec": 60,
  "mock": false,
  "logLevel": "info",
  "idface": {
    "url": "http://192.168.1.150",
    "port": 80,
    "user": "admin",
    "password": "admin",
    "deviceId": "4408801109279099"
  }
}`;
}

export default async function IntegracoesAgentPage() {
  await requireRole(["MASTER", "ADMIN"]);
  const result = await loadAgents();
  const manifest = loadAgentManifest();
  const firstToken = result.ok ? result.rows[0]?.token ?? null : null;

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
          O MODELO B é <strong>obrigatório</strong>. Instale o agent em um PC/mini-pc que consiga alcançar o iDFace pela LAN.
          Credenciais do iDFace ficam apenas na máquina local (<code className="bg-amber-100 dark:bg-amber-900 px-1 rounded text-[0.8em]">C:\ProgramData\VGON\Ponto Agent</code>) —
          nunca saem da sua rede.
        </AlertDescription>
      </Alert>

      <section className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card className={manifest ? "border-emerald-300 dark:border-emerald-800" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MonitorDot className="w-5 h-5 text-sky-700" /> Windows x64 Setup (instalador oficial)
            </CardTitle>
            <CardDescription>
              Instala o serviço <strong>VgonPontoAgent</strong> com runtime embutido — sem precisar instalar Node.js.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {manifest ? (
              <>
                <Link href={`/downloads/${manifest.fileName}`} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full">
                    <Download className="w-4 h-4 mr-2" /> Baixar {manifest.fileName}
                    {manifest.sizeBytes > 0 && (
                      <span className="ml-1 opacity-80">
                        (~{(manifest.sizeBytes / 1024 / 1024).toFixed(0)} MB)
                      </span>
                    )}
                  </Button>
                </Link>
                <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {[
                    ["Versão", `v${manifest.version}`],
                    ["Arquitetura", manifest.arch],
                    [
                      "Publicado em",
                      manifest.builtAt
                        ? new Date(manifest.builtAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
                        : "—",
                    ],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1.5">
                      <dt className="text-slate-500 dark:text-slate-400">{k}</dt>
                      <dd className="font-mono text-slate-900 dark:text-slate-100 text-[0.78rem]">{v}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <p className="text-xs text-slate-500 mb-1">
                    SHA-256 (verifique após o download com{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">certutil -hashfile arquivo SHA256</code>):
                  </p>
                  <CopyCode code={manifest.sha256} />
                </div>
              </>
            ) : (
              <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-5 text-center space-y-2">
                <FileWarning className="w-6 h-6 mx-auto text-slate-400" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Instalador ainda não publicado
                </p>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
                  Gere o instalador em uma máquina Windows com Node.js 20+ e Inno Setup 6:
                  <CopyCode code={`cd agent\nnpm ci\nnpm run installer`} />
                  O script gera o Setup + SHA-256 e copia o manifest para{" "}
                  <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">public/downloads/</code> —
                  faça o deploy e este botão aparecerá automaticamente.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <PackageOpen className="w-5 h-5 text-indigo-600" /> Releases e código-fonte
            </CardTitle>
            <CardDescription>Changelog, checksums e releases históricas no GitHub.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Link href={`${GITHUB_BASE}/releases`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full">
                <ExternalLink className="w-4 h-4 mr-2" /> Abrir GitHub Releases
              </Button>
            </Link>
            <p className="text-xs text-slate-500 leading-relaxed">
              Windows 10/11 ou Server 2019+ (x64) · Porta local da tela de configuração:{" "}
              <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">127.0.0.1:3737</code> ·
              O instalador nunca contém credenciais — elas são configuradas na tela local após a instalação.
            </p>
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
              <CardDescription>Do download às marcações fluindo em 4 passos.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ol className="space-y-6 list-decimal pl-5 text-slate-700 dark:text-slate-300 [&>li::marker]:font-bold [&>li::marker]:text-slate-900">
                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Baixe e execute o Setup <em>como administrador</em>
                  </div>
                  <div className="text-sm leading-relaxed">
                    Use o botão de download acima. O instalador cria o serviço Windows{" "}
                    <strong>VgonPontoAgent</strong> (início automático), instala o runtime embutido em{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">C:\Program Files\VGON\Ponto Agent</code>{" "}
                    e os dados em{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">C:\ProgramData\VGON\Ponto Agent</code>.
                    Em atualizações, sua configuração é preservada.
                  </div>
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Abra a tela “VGON PONTO Agent — Configurações”
                  </div>
                  <div className="text-sm leading-relaxed">
                    Pelo menu Iniciar (atalho criado pelo instalador) ou acessando{" "}
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">http://127.0.0.1:3737</code>{" "}
                    na própria máquina.
                  </div>
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Configure iDFace + API e salve
                  </div>
                  <div className="text-sm leading-relaxed">
                    Preencha a URL do iDFace na LAN, usuário/senha do equipamento, a URL da API e o{" "}
                    <strong>Agent Token</strong> da tabela abaixo. Valide com <em>Testar iDFace</em> e{" "}
                    <em>Testar Servidor</em>, clique em <strong>Salvar Configuração</strong> e depois em{" "}
                    <strong>Reiniciar Serviço</strong>. Referência do formato:
                  </div>
                  <CopyCode code={buildConfigExample(firstToken)} />
                </li>

                <li className="space-y-2">
                  <div className="font-semibold text-slate-900 dark:text-slate-50">
                    Confirme o status ONLINE na tabela
                  </div>
                  <div className="text-sm leading-relaxed">
                    Em até 1 minuto o heartbeat deve marcar o agent como{" "}
                    <Badge variant="success" className="align-middle">ONLINE</Badge> e a coluna{" "}
                    <strong>Enviados hoje</strong> começa a contar as marcações. Use os botões{" "}
                    <strong>Sincronizar</strong> e <strong>Testar</strong> na linha do agent para forçar ações
                    imediatas (executadas no próximo poll de ≤15s).
                  </div>
                </li>
              </ol>
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
                  { t: "VGON PONTO Agent", d: "Serviço Windows. Sync 30s, poll 15s, heartbeat 60s. Fila SQLite offline.", ic: ServerIcon },
                  { t: "HTTPS WAN", d: "Agent → POST /api/agents/time-entries/batch (idempotente).", ic: Network },
                  { t: "EasyPanel + Postgres", d: "Nuvem Vgon. UNIQUE(deviceId,eventId) = sem duplica.", ic: HardDriveDownload },
                  { t: "Command Queue", d: "Servidor enfileira PENDING. Agent POLL a cada 15s, executa, PATCH resultado.", ic: RefreshCcw },
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
              Status em tempo real, contadores do dia, ações remotas (via Command Queue) e token de configuração.
            </CardDescription>
          </div>
          <Link href="/integracoes/logs">
            <Button variant="outline" size="sm">Ver logs de sincronização</Button>
          </Link>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="text-sm text-slate-500 p-4">Carregando agents...</div>}>
            <AgentTable result={result} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}

function AgentTable({ result }: { result: LoadAgentsResult }) {
  // Falha na consulta (ex: banco indisponivel) — nunca quebra a pagina inteira.
  if (!result.ok) {
    return (
      <div className="border border-rose-200 rounded-lg p-6 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-900">
        <p className="text-sm font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Não foi possível carregar a lista de VGON PONTO Agents.
        </p>
        <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
          Verifique a conexão com o banco de dados e recarregue a página. Os detalhes foram registrados no log do servidor.
        </p>
        <p className="text-[11px] font-mono text-rose-500 mt-2 break-all">{result.message}</p>
      </div>
    );
  }

  const rows = result.rows;

  if (rows.length === 0) {
    return (
      <div className="border rounded-lg p-6 text-center bg-slate-50 dark:bg-slate-900 space-y-3">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          Nenhum VGON PONTO Agent cadastrado.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
          Execute <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">npx prisma db seed</code>{" "}
          no servidor para criar o agent inicial <strong>Agent Local 001 — Sede Vgon</strong> e seu token
          de autenticação. O token aparecerá nesta tabela após o cadastro.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Máquina / IP</TableHead>
            <TableHead className="text-right">Heartbeat</TableHead>
            <TableHead className="text-right">Último sync</TableHead>
            <TableHead className="text-right">Pendentes</TableHead>
            <TableHead className="text-right">Enviados hoje</TableHead>
            <TableHead className="text-right">Falhas hoje</TableHead>
            <TableHead>Ações</TableHead>
            <TableHead>Agent Token (Bearer)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.enabled ? "" : "opacity-50"}>
              <TableCell>
                <div className="font-medium text-slate-900 dark:text-slate-50">{r.name}</div>
                <div className="text-xs text-slate-500">
                  v{r.version ?? "?"} · sync {r.syncIntervalSec}s · {r._count.devices} device(s) · {r._count.commands} cmd
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge s={r.status} />
                {!r.lastHeartbeatAt && (
                  <div className="text-[11px] text-slate-500 mt-1">Agent sem comunicação.</div>
                )}
              </TableCell>
              <TableCell>
                <div className="text-sm font-mono">{r.computerName ?? "—"}</div>
                <div className="text-xs text-slate-500">{r.localIp ?? "—"}</div>
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-sm">{fmtDate(r.lastHeartbeatAt)}</TableCell>
              <TableCell className="text-right whitespace-nowrap text-sm">{fmtDate(r.lastSyncAt)}</TableCell>
              <TableCell className="text-right font-mono">{r.pendingCount}</TableCell>
              <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-400">{r.sentToday}</TableCell>
              <TableCell className={`text-right font-mono ${r.failedToday > 0 ? "text-rose-600 font-semibold" : ""}`}>
                {r.failedToday}
              </TableCell>
              <TableCell>
                <AgentActions agentId={r.id} agentName={r.name} />
              </TableCell>
              <TableCell>
                <div className="max-w-xs">
                  <div className="truncate font-mono text-xs bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded border border-slate-200 dark:border-slate-800" title={r.token}>
                    {r.token}
                  </div>
                  <CopyTokenButton token={r.token} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
