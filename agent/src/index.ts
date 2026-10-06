import process from "node:process";
import os from "node:os";
import { pino } from "pino";
import { loadConfig, AgentConfig } from "./config";
import {
  getDb,
  setKv,
  getKv,
  queuePendingEvent,
  takePendingBatch,
  markPendingAttempt,
  movePendingToSent,
  deleteFailed,
  closeDb,
  PendingEvent,
} from "./db/sqlite";
import { ControlIdService, IDFaceTimeEvent, AgentCommand, CommandResult } from "./services/ControlIdService";
import { VgonPontoApiClient } from "./services/VgonPontoApiClient";

const LOGO = String.raw`
  ___  _____  ___  _  _    ___   ___  _____  _____  ___  
 / _ \|_   _|/ _ \| \| |  / _ \ / _ \|  _  ||_   _|/ _ \ 
| | | | | | | | | |  .  | | | | | | | | |_| |  | | | | | |
| |_| | | | | |_| | |\  | | |_| | |_| |  ___|  | | | |_| |
 \___/  |_|  \___/|_| \_|  \___/ \___/|_|      |_|  \___/ 
   A G E N T E    L O C A L   —   M O D E L O   B
`;

function getIps(): string[] {
  const nets = os.networkInterfaces();
  const out: string[] = [];
  for (const list of Object.values(nets) ?? []) {
    for (const n of list ?? []) {
      if (!n.internal && n.family === "IPv4") out.push(n.address);
    }
  }
  return out;
}

class AgentRuntime {
  cfg: AgentConfig;
  log: pino.Logger;
  ctrl!: ControlIdService;
  api!: VgonPontoApiClient;
  running = false;
  loopTimer: ReturnType<typeof setInterval> | null = null;
  hbTimer: ReturnType<typeof setInterval> | null = null;
  cmdTimer: ReturnType<typeof setInterval> | null = null;
  cmdQueue: AgentCommand[] = [];
  bootAt = new Date();

  constructor(cfg: AgentConfig) {
    this.cfg = cfg;
    this.log = pino({ name: "agent", level: cfg.logLevel ?? "info" });
  }

  async boot() {
    console.log(LOGO);
    this.log.info(
      { mock: this.cfg.mock, api: this.cfg.apiUrl, deviceId: this.cfg.idface.deviceId, intervalSec: this.cfg.syncIntervalSec },
      "Iniciando VGON PONTO Agent",
    );
    this.ctrl = new ControlIdService(this.cfg);
    this.api = new VgonPontoApiClient(this.cfg);
    getDb(this.cfg.dbPath);

    if (!this.cfg.mock) {
      const ok = await this.ctrl.login();
      this.log.info({ loginOk: ok }, "Login iDFace");
    } else {
      this.log.warn("====== MOCK MODE ATIVADO — não conecta ao iDFace real ======");
    }

    this.running = true;

    const tickSync = async () => {
      try {
        await this.syncTick();
      } catch (e) {
        this.log.error({ err: e instanceof Error ? e.stack ?? e.message : String(e) }, "syncTick failure");
      }
    };
    void tickSync();
    this.loopTimer = setInterval(tickSync, this.cfg.syncIntervalSec * 1000);

    const tickHb = async () => {
      try {
        await this.heartbeatTick("ONLINE");
      } catch (e) {
        this.log.warn({ err: e instanceof Error ? e.message : String(e) }, "heartbeatTick failure");
      }
    };
    void tickHb();
    this.hbTimer = setInterval(tickHb, this.cfg.heartbeatIntervalSec * 1000);

    const tickCmd = async () => {
      try {
        await this.commandsTick();
      } catch (e) {
        this.log.error({ err: e instanceof Error ? e.stack ?? e.message : String(e) }, "commandsTick failure");
      }
    };
    void tickCmd();
    this.cmdTimer = setInterval(tickCmd, this.cfg.pollCommandsIntervalSec * 1000);

    this.log.info("Agent em execução — Ctrl+C para parar");
  }

  shutdown() {
    this.running = false;
    if (this.loopTimer) clearInterval(this.loopTimer);
    if (this.hbTimer) clearInterval(this.hbTimer);
    if (this.cmdTimer) clearInterval(this.cmdTimer);
    closeDb();
    this.log.info("Agent parado.");
  }

  async heartbeatTick(status: "ONLINE" | "OFFLINE" | "SYNCING" | "AUTH_ERROR" | "API_OFFLINE") {
    const db = getDb(this.cfg.dbPath);
    const pending = (await db.prepare("SELECT COUNT(*) as c FROM pending_events").get() as { c: number }).c;
    const ips = getIps().join(", ");
    try {
      const res = await this.api.heartbeat({
        version: "0.1.0",
        computerName: os.hostname(),
        localIp: ips,
        osVersion: `${os.type()} ${os.release()} ${os.arch()}`,
        pendingEvents: pending,
        agentStatus: status,
        raw: { mock: this.cfg.mock, pid: process.pid, uptimeSec: Math.floor(process.uptime()), bootAt: this.bootAt.toISOString() },
      });
      this.log.debug({ heartbeatId: res.heartbeatId, pending, nextSec: res.nextHeartbeatSec }, "Heartbeat OK");
    } catch (e) {
      this.log.warn({ err: e instanceof Error ? e.message : String(e) }, "Heartbeat falhou (servidor offline?)");
    }
  }

  async syncTick() {
    const db = getDb(this.cfg.dbPath);
    const status = await this.ctrl.getStatus();
    if (!status.online && !this.cfg.mock) {
      this.log.warn("iDFace offline — enfileirando eventos salvos já capturados e reenviando lote anterior");
    }
    const lastKey = "events_last_iso";
    const since = getKv(db, lastKey) ?? undefined;

    let events: IDFaceTimeEvent[] = [];
    try {
      events = await this.ctrl.getNewEvents(since);
    } catch (e) {
      this.log.error({ err: e instanceof Error ? e.message : String(e) }, "getNewEvents lançou");
    }

    for (const e of events) queuePendingEvent(db, e);
    if (events.length) {
      const latest = events
        .map((x) => x.timestamp)
        .filter(Boolean)
        .sort()
        .slice(-1)[0];
      if (latest) setKv(db, lastKey, latest);
      this.log.info({ n: events.length, latest }, "Capturados eventos do iDFace (enfileirados)");
    }

    const pending = takePendingBatch(db, 500);
    if (pending.length === 0) {
      deleteFailed(db, 25);
      return;
    }
    const items = pending
      .map((p: PendingEvent) => {
        try {
          return JSON.parse(p.payload_json) as IDFaceTimeEvent;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as IDFaceTimeEvent[];
    if (items.length === 0) return;

    const startedAt = new Date().toISOString();
    try {
      const resp = await this.api.sendTimeEntriesBatch({
        events: items,
        deviceUniqueId: this.cfg.idface.deviceId,
        deviceSerialNumber: this.cfg.idface.deviceSerialNumber,
        startedAt,
        syncId: `sync-${Date.now()}`,
      });
      this.log.info(
        { received: resp.received, created: resp.created, duplicated: resp.duplicated, failed: resp.failed, syncLogId: resp.syncLogId },
        "Lote enviado para API",
      );
      const failedIds = new Set((resp.failedItems ?? []).map((x) => x.externalEventId));
      const processedOk = items
        .filter((i) => !failedIds.has(i.externalEventId))
        .map((i) => i.externalEventId);
      const okPending = pending.filter((p) => {
        try {
          const ee = JSON.parse(p.payload_json).externalEventId;
          return !failedIds.has(ee);
        } catch {
          return true;
        }
      });
      for (const p of pending) {
        try {
          const ee = JSON.parse(p.payload_json).externalEventId;
          if (failedIds.has(ee)) markPendingAttempt(db, p.id, "server marked failed");
        } catch {
          // ignore
        }
      }
      movePendingToSent(db, okPending, processedOk, resp);
    } catch (e) {
      for (const p of pending) markPendingAttempt(db, p.id, e instanceof Error ? e.message : String(e));
      this.log.error({ err: e instanceof Error ? e.message : String(e), n: pending.length }, "Envio lote falhou — mantido em fila para retry");
    }
    deleteFailed(db, 25);
  }

  async commandsTick() {
    if (this.cmdQueue.length) {
      const cmd = this.cmdQueue.shift()!;
      await this.runOneCommand(cmd);
    }
    try {
      const next = await this.api.pollNextCommand();
      if (next) this.cmdQueue.push(next);
    } catch (e) {
      this.log.warn({ err: e instanceof Error ? e.message : String(e) }, "Poll comandos falhou");
    }
  }

  async runOneCommand(cmd: AgentCommand) {
    let result: CommandResult = { ok: false, error: "unhandled" };
    try {
      result = await this.ctrl.executeCommand(cmd);
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.stack ?? e.message : String(e) };
    }
    try {
      const f = await this.api.finishCommand(cmd.id, result);
      this.log.info({ cmdId: cmd.id, type: cmd.commandType, status: f.command.status, ok: result.ok }, "Comando finalizado");
    } catch (e) {
      this.log.warn({ cmdId: cmd.id, err: e instanceof Error ? e.message : String(e) }, "Comando executado mas PATCH falhou — tentar novamente depois");
    }
  }
}

process.on("SIGINT", () => {
  console.log("\nSIGINT: parando agent...");
  process.exit(0);
});
process.on("SIGTERM", () => {
  console.log("SIGTERM: parando agent...");
  process.exit(0);
});

async function main() {
  try {
    const cfg = loadConfig();
    const rt = new AgentRuntime(cfg);
    process.on("beforeExit", () => rt.shutdown());
    process.on("exit", () => rt.shutdown());
    await rt.boot();
  } catch (e) {
    console.error("");
    console.error("============================================================");
    console.error("  ERRO NA INICIALIZAÇÃO DO VGON PONTO AGENT:");
    console.error("  ", e instanceof Error ? e.message : String(e));
    console.error("============================================================");
    if (e instanceof Error && process.argv.includes("--debug")) console.error(e.stack);
    else {
      console.error("  Dica: execute com MOCK=true para testar sem o iDFace real.");
      console.error("  Exemplo: npm run start:mock");
    }
    process.exit(1);
  }
}

void main();
