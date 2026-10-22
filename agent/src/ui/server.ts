import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";
import { hasUiSession, matchesSecret, UI_COOKIE } from "./auth";
import { execFile, spawn } from "node:child_process";
import { pino } from "pino";
import {
  AgentConfig,
  agentConfigSchema,
  getUiToken,
  loadConfig,
  PROGRAMDATA_DIR,
  resolveConfigPath,
  saveConfig,
} from "../config";
import { ControlIdService } from "../services/ControlIdService";
import { VgonPontoApiClient } from "../services/VgonPontoApiClient";
import { renderConfigPage } from "./page";

const log = pino({ name: "ui", level: process.env.LOG_LEVEL ?? "info" });

export const SERVICE_NAME = "VgonPontoAgent";
export const UI_PORT = Number(process.env.VGON_AGENT_UI_PORT ?? 3737);

export interface RuntimeStatus {
  [key: string]: unknown;
}

export interface UiHooks {
  mode: "embedded" | "standalone";
  /** Estado do runtime do agent (null no modo standalone, quando o serviço está parado). */
  getRuntimeStatus(): RuntimeStatus | null;
  /** Dispara uma sincronização imediata (apenas embedded). */
  syncNow(): Promise<string>;
}

function agentVersion(): string {
  try {
    // funciona tanto em src/ui (tsx) quanto em dist/ui (build)
    const pkg = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf-8"),
    ) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function json(res: http.ServerResponse, status: number, body: unknown) {
  const buf = Buffer.from(JSON.stringify(body), "utf-8");
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": buf.length,
    "Cache-Control": "no-store",
  });
  res.end(buf);
}

function readBody(req: http.IncomingMessage, limitBytes = 1_000_000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (c: Buffer) => {
      size += c.length;
      if (size > limitBytes) {
        reject(new Error("payload muito grande"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf-8")));
      } catch {
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function exec(cmd: string, args: string[], timeoutMs = 8000): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
      if (err && (err as { code?: number }).code === undefined && !(err as { killed?: boolean }).killed) {
        resolve({ stdout: String(stdout ?? ""), code: -1 });
        return;
      }
      resolve({ stdout: String(stdout ?? ""), code: (err as { code?: number } | null)?.code ?? 0 });
    });
  });
}

async function queryService(): Promise<{ installed: boolean; state: string }> {
  const { stdout, code } = await exec("sc.exe", ["query", SERVICE_NAME]);
  if (code !== 0) return { installed: false, state: "NOT_INSTALLED" };
  const m = stdout.match(/STATE\s*:\s*\d+\s+(\w+)/i);
  return { installed: true, state: (m?.[1] ?? "UNKNOWN").toUpperCase() };
}

/** Agenda `net start` após 3s e encerra o processo atual (restart quando embedded). */
function scheduleSelfRestart() {
  const child = spawn(
    "cmd.exe",
    ["/c", `ping -n 3 127.0.0.1 >nul & net start ${SERVICE_NAME}`],
    { detached: true, stdio: "ignore", windowsHide: true },
  );
  child.unref();
  setTimeout(() => process.exit(0), 400);
}

function loadConfigSafe(): { config: AgentConfig | null; error: string | null } {
  try {
    return { config: loadConfig(), error: null };
  } catch (e) {
    return { config: null, error: e instanceof Error ? e.message : String(e) };
  }
}

function tailLogs(n: number): { file: string | null; lines: string[] } {
  const dir = path.join(PROGRAMDATA_DIR, "logs");
  try {
    if (!fs.existsSync(dir)) return { file: null, lines: [] };
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".log"))
      .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    if (!files.length) return { file: null, lines: [] };
    const file = path.join(dir, files[0].f);
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
    return { file: files[0].f, lines: lines.slice(-Math.max(1, Math.min(n, 2000))) };
  } catch {
    return { file: null, lines: [] };
  }
}

export function startUiServer(hooks: UiHooks, port = UI_PORT): http.Server {
  const token = getUiToken();
  const session = randomBytes(32).toString("hex");

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
      const host = req.headers.host;
      if (!["127.0.0.1", "localhost"].some(h => host === `${h}:${req.socket.localPort ?? port}`) ||
          (req.headers.origin && req.headers.origin !== `http://${host}`)) {
        json(res, 403, { ok: false, error: "Origem local inválida" });
        return;
      }
      const given = url.searchParams.get("token") ?? (req.headers["x-ui-token"] as string | undefined);
      if (!matchesSecret(given, token) && !hasUiSession(req.headers.cookie, session)) {
        if (url.pathname === "/") {
          res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Acesso protegido. Abra 'VGON PONTO Agent — Configurações' pelo menu Iniciar e confirme a elevação de administrador. O atalho autoriza este navegador; depois você pode reabrir http://127.0.0.1:3737 nesta sessão.");
        } else {
          json(res, 401, { ok: false, error: "unauthorized" });
        }
        return;
      }

      const route = `${req.method} ${url.pathname}`;

      if (route === "GET /") {
        if (matchesSecret(url.searchParams.get("token"), token)) {
          res.writeHead(303, { Location: "/", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Set-Cookie": `${UI_COOKIE}=${session}; HttpOnly; SameSite=Strict; Path=/` });
          res.end();
          return;
        }
        const html = Buffer.from(renderConfigPage(token), "utf-8");
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Content-Length": html.length, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
        res.end(html);
        return;
      }

      if (route === "GET /api/ping") {
        json(res, 200, { ok: true, mode: hooks.mode, version: agentVersion() });
        return;
      }

      if (route === "GET /api/status") {
        const service = await queryService();
        json(res, 200, {
          ok: true,
          mode: hooks.mode,
          version: agentVersion(),
          service,
          runtime: hooks.getRuntimeStatus(),
          paths: { config: resolveConfigPath(), dataDir: PROGRAMDATA_DIR },
        });
        return;
      }

      if (route === "GET /api/config") {
        const { config, error } = loadConfigSafe();
        json(res, 200, { ok: true, config, error, path: resolveConfigPath() });
        return;
      }

      if (route === "POST /api/config") {
        const body = (await readBody(req)) as { config?: unknown };
        const parsed = agentConfigSchema.safeParse(body?.config);
        if (!parsed.success) {
          json(res, 400, { ok: false, error: "Configuração inválida", issues: parsed.error.flatten() });
          return;
        }
        const dest = saveConfig(parsed.data);
        log.info({ path: dest }, "Configuração salva via UI local");
        json(res, 200, { ok: true, path: dest, restartRequired: true });
        return;
      }

      if (route === "POST /api/test/idface") {
        const body = (await readBody(req)) as { config?: unknown };
        let cfg: AgentConfig | null = null;
        if (body?.config) {
          const parsed = agentConfigSchema.safeParse(body.config);
          if (parsed.success) cfg = parsed.data;
        }
        if (!cfg) {
          const loaded = loadConfigSafe();
          cfg = loaded.config;
          if (!cfg) {
            json(res, 400, { ok: false, error: loaded.error ?? "config indisponível" });
            return;
          }
        }
        if (cfg.mock) {
          json(res, 400, { ok: false, error: "MOCK ativo — desative para testar o equipamento real" });
          return;
        }
        try {
          const ctrl = new ControlIdService(cfg);
          const loginOk = await ctrl.login();
          if (!loginOk) {
            json(res, 200, { ok: false, error: "Login recusado pelo iDFace (verifique URL/usuário/senha)" });
            return;
          }
          const status = await ctrl.getStatus();
          json(res, 200, { ok: true, status });
        } catch (e) {
          json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        return;
      }

      if (route === "POST /api/test/server") {
        const body = (await readBody(req)) as { config?: unknown };
        let cfg: AgentConfig | null = null;
        if (body?.config) {
          const parsed = agentConfigSchema.safeParse(body.config);
          if (parsed.success) cfg = parsed.data;
        }
        if (!cfg) {
          const loaded = loadConfigSafe();
          cfg = loaded.config;
          if (!cfg) {
            json(res, 400, { ok: false, error: loaded.error ?? "config indisponível" });
            return;
          }
        }
        try {
          const api = new VgonPontoApiClient(cfg);
          const hb = await api.heartbeat({
            version: agentVersion(),
            computerName: os.hostname(),
            localIp: "127.0.0.1",
            osVersion: `${os.type()} ${os.release()} ${os.arch()}`,
            pendingEvents: 0,
            agentStatus: "ONLINE",
            raw: { uiTest: true },
          });
          json(res, 200, { ok: true, serverNow: hb.serverNow, agentId: hb.agentId });
        } catch (e) {
          json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        return;
      }

      if (route === "POST /api/sync-now") {
        if (hooks.mode !== "embedded") {
          json(res, 409, { ok: false, error: "Serviço parado — inicie o serviço para sincronizar" });
          return;
        }
        try {
          const msg = await hooks.syncNow();
          json(res, 200, { ok: true, message: msg });
        } catch (e) {
          json(res, 200, { ok: false, error: e instanceof Error ? e.message : String(e) });
        }
        return;
      }

      if (route === "POST /api/service") {
        const body = (await readBody(req)) as { op?: string };
        const op = body?.op;
        if (op !== "start" && op !== "stop" && op !== "restart") {
          json(res, 400, { ok: false, error: "op inválida (start|stop|restart)" });
          return;
        }
        const svc = await queryService();
        if (!svc.installed) {
          json(res, 400, { ok: false, error: "Serviço não instalado — reinstale o Agent" });
          return;
        }
        if (op === "start") {
          const r = await exec("sc.exe", ["start", SERVICE_NAME]);
          json(res, 200, { ok: r.code === 0, detail: r.stdout.trim().slice(0, 500) });
          return;
        }
        if (op === "stop") {
          if (hooks.mode === "embedded") {
            // responde antes de parar (o próprio processo será encerrado)
            json(res, 200, { ok: true, detail: "Serviço será parado — esta tela ficará indisponível até novo start" });
            setTimeout(() => void exec("sc.exe", ["stop", SERVICE_NAME]), 500);
          } else {
            const r = await exec("sc.exe", ["stop", SERVICE_NAME]);
            json(res, 200, { ok: r.code === 0, detail: r.stdout.trim().slice(0, 500) });
          }
          return;
        }
        // restart
        if (hooks.mode === "embedded") {
          json(res, 200, { ok: true, detail: "Reiniciando — aguarde alguns segundos e recarregue a página" });
          scheduleSelfRestart();
        } else {
          await exec("sc.exe", ["stop", SERVICE_NAME]);
          await new Promise((r) => setTimeout(r, 1500));
          const r = await exec("sc.exe", ["start", SERVICE_NAME]);
          json(res, 200, { ok: r.code === 0, detail: r.stdout.trim().slice(0, 500) });
        }
        return;
      }

      if (route === "GET /api/logs") {
        const tail = Number(url.searchParams.get("tail") ?? 200);
        const result = tailLogs(Number.isFinite(tail) ? tail : 200);
        json(res, 200, { ok: true, ...result });
        return;
      }

      json(res, 404, { ok: false, error: "rota não encontrada" });
    } catch (e) {
      log.error({ err: e instanceof Error ? e.message : String(e) }, "UI handler falhou");
      try {
        json(res, 500, { ok: false, error: "erro interno da UI" });
      } catch {
        // socket já encerrado
      }
    }
  });

  server.on("error", (e) => {
    log.warn({ err: e instanceof Error ? e.message : String(e), port }, "UI local não pôde abrir a porta (ocupada?)");
  });

  server.listen(port, "127.0.0.1", () => {
    log.info({ port, mode: hooks.mode }, "UI local 'VGON PONTO Agent — Configurações' em http://127.0.0.1:%d", port);
  });

  return server;
}
