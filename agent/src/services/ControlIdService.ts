import axios, { AxiosInstance } from "axios";
import type { AgentConfig, IDFaceConfig } from "../config";
import { pino } from "pino";
import { getDb, getKv, setKv } from "../db/sqlite";

export interface IDFaceTimeEvent {
  externalEventId: string;
  deviceId: string;
  deviceSerialNumber?: string;
  employeeExternalId?: string;
  employeeId?: string;
  date: string; // YYYY-MM-DD (America/Sao_Paulo)
  time: string; // HH:mm (America/Sao_Paulo)
  timestamp: string; // ISO (UTC)
  kind?: string; // MARK, EXIT, ENTRY, ADJUSTMENT, OFFSET
  origin: "IDFACE";
  originalEventRef?: string;
  note?: string;
}

export interface IDFaceStatus {
  online: boolean;
  serialNumber?: string;
  firmware?: string;
  mac?: string;
  deviceUniqueId?: string;
  lastCommunication?: string;
  pendingInQueue: number;
  error?: string;
}

export interface CommandPayloads {
  SYNC_NOW: Record<string, never>;
  TEST_DEVICE: { ping: boolean };
  REBOOT_DEVICE: { reason?: string };
  SET_DEVICE_TIME: { iso: string };
  PULL_ALL_EVENTS: { fromIso?: string };
  ENROLL_USER: { employeeExternalId: string; name: string; identifier?: string };
}

export type CommandType = keyof CommandPayloads;

export interface AgentCommand<P = unknown> {
  id: string;
  commandType: CommandType;
  payload: P;
  createdAt: string;
  attempts: number;
}

export interface CommandResult {
  ok: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

const log = pino({ name: "services", level: process.env.LOG_LEVEL ?? "info" });

// ─────────────────────────────────────────────────────────────────────────────
// Constantes da API oficial Control iD (iDFace — firmware 6.18.6)
// Doc: https://www.controlid.com.br/docs/access-api-pt/
// ─────────────────────────────────────────────────────────────────────────────

// access_logs.event = 7 → "Acesso concedido" (doc oficial; exemplo de
// load_objects filtra exatamente id > X AND event = 7).
const IDFACE_EVENT_ACCESS_GRANTED = 7;

// Sessão iDFace expira (~30 min). Renovamos proativamente antes disso.
const SESSION_TTL_MS = 25 * 60 * 1000;

// Teto de páginas por tick de sync (proteção contra loop infinito).
const MAX_PAGES_PER_TICK = 20;

// Chave do cursor incremental (id do último access_log importado) no kv_store.
const KV_LAST_LOG_ID = "idface_last_log_id";

const SP_TZ = "America/Sao_Paulo";

interface AccessLogRow {
  id: number | string;
  time: number; // unix timestamp (segundos)
  event: number;
  device_id?: number | string;
  identifier_id?: number | string;
  user_id?: number | string;
  portal_id?: number | string;
  identification_rule_id?: number | string;
  card_value?: number | string;
  log_type_id?: number | string;
}

interface SpParts {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  day: number;
  month: number;
  year: number;
  hour: number;
  minute: number;
  second: number;
}

/** Componentes de data/hora no fuso America/Sao_Paulo (horário local do equipamento). */
function spParts(d: Date): SpParts {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    timeZone: SP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    time: `${map.hour}:${map.minute}`,
    day: Number(map.day),
    month: Number(map.month),
    year: Number(map.year),
    hour: Number(map.hour === "24" ? "0" : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export class ControlIdService {
  private http: AxiosInstance;
  private _mock: boolean;
  private cfg: IDFaceConfig;
  private dbPath: string;
  private _session: string | null = null;
  private _sessionAt = 0;
  private _mockSeq = 1;
  private _startupAt = new Date();

  constructor(config: AgentConfig) {
    this.cfg = config.idface;
    this.dbPath = config.dbPath;
    this._mock = !!config.mock;
    const base = this.cfg.url.replace(/\/$/, "");
    const port = this.cfg.port ?? 80;
    // Só acrescenta :porta se a URL já não trouxer porta explícita.
    const hasPort = /:\d+$/.test(new URL(base).host) || (port === 80 && base.startsWith("http://"));
    this.http = axios.create({
      baseURL: hasPort ? base : `${base}:${port}`,
      timeout: 8000,
      headers: { "Content-Type": "application/json", "User-Agent": "VGON-PONTO-Agent/0.2.0" },
      // Nunca logar corpo de requisições (contém credenciais em /login.fcgi).
      transformRequest: [(data) => (typeof data === "string" ? data : JSON.stringify(data ?? null))],
    });
  }

  get isMock(): boolean {
    return this._mock;
  }

  // ── Autenticação / sessão ────────────────────────────────────────────────

  /**
   * POST /login.fcgi — doc oficial: body {"login","password"} → {"session"}.
   * Nunca loga senha nem sessão.
   */
  async login(): Promise<boolean> {
    if (this._mock) {
      this._session = `mock-session-${this._startupAt.getTime()}`;
      this._sessionAt = Date.now();
      return true;
    }
    try {
      const res = await this.http.post("/login.fcgi", {
        login: this.cfg.user,
        password: this.cfg.password,
      });
      const sess = (res.data as { session?: unknown } | null)?.session;
      if (typeof sess === "string" && sess.length > 0) {
        this._session = sess;
        this._sessionAt = Date.now();
        return true;
      }
      log.warn("Login iDFace: resposta sem campo session");
      return false;
    } catch (e) {
      this._session = null;
      log.debug({ err: errMsg(e) }, "Login iDFace falhou");
      return false;
    }
  }

  /** Garante sessão válida (re-login proativo antes da expiração). */
  private async ensureSession(): Promise<string> {
    if (this._session && Date.now() - this._sessionAt < SESSION_TTL_MS) return this._session;
    const ok = await this.login();
    if (!ok || !this._session) throw new Error("Falha de autenticação no iDFace (login)");
    return this._session;
  }

  /** Invalida sessão local (usado quando o equipamento recusa a sessão atual). */
  private dropSession() {
    this._session = null;
    this._sessionAt = 0;
  }

  /**
   * POST autenticado com re-login automático quando a sessão expira no
   * equipamento (HTTP 401/403 ou resposta HTML da tela de login).
   */
  private async postAuthed<T = unknown>(path: string, body: unknown, retried = false): Promise<T> {
    const session = await this.ensureSession();
    try {
      const res = await this.http.post(`${path}?session=${encodeURIComponent(session)}`, body);
      return res.data as T;
    } catch (e) {
      if (!retried && isSessionError(e)) {
        this.dropSession();
        return this.postAuthed<T>(path, body, true);
      }
      throw e;
    }
  }

  // ── Status ───────────────────────────────────────────────────────────────

  async getStatus(): Promise<IDFaceStatus> {
    if (this._mock) {
      return {
        online: true,
        serialNumber: this.cfg.deviceSerialNumber ?? "0M0200/01017B",
        firmware: this.cfg.deviceFirmware ?? "6.18.6",
        mac: this.cfg.deviceMac ?? "FC:52:CE:8A:B9:91",
        deviceUniqueId: this.cfg.deviceId,
        lastCommunication: new Date().toISOString(),
        pendingInQueue: 0,
      };
    }
    try {
      // POST /system_information.fcgi?session= (body null) — doc oficial.
      const d = await this.postAuthed<Record<string, unknown>>("/system_information.fcgi", null);
      const info = (d ?? {}) as Record<string, unknown>;
      const net = (info.network ?? {}) as Record<string, unknown>;
      return {
        online: true,
        serialNumber: str(info.serial_number) ?? this.cfg.deviceSerialNumber,
        firmware: str(info.firmware_version) ?? this.cfg.deviceFirmware,
        mac: str(net.mac) ?? str(info.mac) ?? this.cfg.deviceMac,
        deviceUniqueId: str(info.device_id) ?? this.cfg.deviceId,
        lastCommunication: new Date().toISOString(),
        pendingInQueue: 0,
      };
    } catch (e) {
      return {
        online: false,
        pendingInQueue: 0,
        error: errMsg(e),
      };
    }
  }

  // ── Leitura de marcações (access_logs) ───────────────────────────────────

  /**
   * Lê novos access_logs do iDFace via POST /load_objects.fcgi (doc oficial):
   *   {"object":"access_logs","where":[{field:"id",operator:">",value:X},
   *    {field:"event","operator":"=","value":7}],"order":["id","ascending"],"limit":N}
   *
   * Cursor incremental por id (monotônico, imune a relógio errado do equipamento)
   * persistido em kv_store[idface_last_log_id]. Na 1ª execução (cursor=0) usa
   * sinceIso / janela readEventsFromMinutesAgo como piso de tempo.
   *
   * externalEventId determinístico: `${deviceId}-${access_log.id}` (sem random).
   */
  async getNewEvents(sinceIso?: string): Promise<IDFaceTimeEvent[]> {
    if (this._mock) return this._genMockEvents(sinceIso);

    const db = getDb(this.dbPath);
    let lastId = Number(getKv(db, KV_LAST_LOG_ID) ?? "0") || 0;
    const minTimeUnix = this._initialTimeFloorUnix(sinceIso, lastId);

    const out: IDFaceTimeEvent[] = [];
    let pages = 0;
    let maxId = lastId;

    while (pages < MAX_PAGES_PER_TICK) {
      const rows = await this._loadAccessLogsPage(maxId, minTimeUnix, this.cfg.readEventsBatchSize);
      pages++;
      if (rows.length === 0) break;

      for (const r of rows) {
        const id = Number(r.id);
        if (!Number.isFinite(id)) continue;
        if (id > maxId) maxId = id;
        out.push(this._mapAccessLog(r));
      }
      if (rows.length < this.cfg.readEventsBatchSize) break; // última página
    }

    if (maxId > lastId) {
      log.debug({ from: lastId, to: maxId, n: out.length }, "Novas marcações lidas do iDFace");
    }
    return out;
  }

  /**
   * Persiste o cursor incremental APÓS os eventos terem sido enfileirados no
   * SQLite local (durabilidade: se o processo cair entre a leitura e o
   * enfileiramento, o cursor não avança e os logs serão relidos).
   * Deve ser chamado pelo runtime após queuePendingEvent de todos os eventos.
   */
  commitEventsCursor(events: IDFaceTimeEvent[]): void {
    if (this._mock || events.length === 0) return;
    const db = getDb(this.dbPath);
    const current = Number(getKv(db, KV_LAST_LOG_ID) ?? "0") || 0;
    let maxId = current;
    for (const e of events) {
      const id = Number(e.originalEventRef);
      if (Number.isFinite(id) && id > maxId) maxId = id;
    }
    if (maxId > current) setKv(db, KV_LAST_LOG_ID, String(maxId));
  }

  /** Piso de tempo (unix) só na primeira carga, quando ainda não há cursor por id. */
  private _initialTimeFloorUnix(sinceIso: string | undefined, lastId: number): number | null {
    if (lastId > 0) return null;
    const fromIso = sinceIso ? Date.parse(sinceIso) : NaN;
    const fallback = Date.now() - this.cfg.readEventsFromMinutesAgo * 60 * 1000;
    const ms = Number.isFinite(fromIso) ? fromIso : fallback;
    return Math.floor(ms / 1000);
  }

  private async _loadAccessLogsPage(afterId: number, minTimeUnix: number | null, limit: number): Promise<AccessLogRow[]> {
    const where: Record<string, unknown>[] = [
      {
        object: "access_logs",
        field: "id",
        operator: ">",
        value: afterId,
        connector: ") AND (",
      },
      {
        object: "access_logs",
        field: "event",
        operator: "=",
        value: IDFACE_EVENT_ACCESS_GRANTED,
      },
    ];
    if (minTimeUnix !== null) {
      // Insere o piso de tempo como 1ª condição (primeira carga histórica).
      where.unshift({
        object: "access_logs",
        field: "time",
        operator: ">=",
        value: minTimeUnix,
        connector: ") AND (",
      });
    }
    const data = await this.postAuthed<Record<string, unknown>>("/load_objects.fcgi", {
      object: "access_logs",
      where,
      order: ["id", "ascending"],
      limit,
    });
    const rows = (data as { access_logs?: AccessLogRow[] } | null)?.access_logs;
    return Array.isArray(rows) ? rows : [];
  }

  private _mapAccessLog(r: AccessLogRow): IDFaceTimeEvent {
    const id = Number(r.id);
    const ts = new Date(Number(r.time) * 1000);
    const sp = spParts(ts);
    const userId = r.user_id !== undefined && r.user_id !== null ? String(r.user_id) : undefined;
    return {
      externalEventId: `${this.cfg.deviceId}-${id}`,
      deviceId: this.cfg.deviceId,
      deviceSerialNumber: this.cfg.deviceSerialNumber,
      employeeExternalId: userId && userId !== "0" ? userId : undefined,
      date: sp.date,
      time: sp.time,
      timestamp: ts.toISOString(),
      kind: "MARK",
      origin: "IDFACE",
      originalEventRef: String(id),
    };
  }

  // ── Comandos Web → Agent → iDFace ────────────────────────────────────────

  async executeCommand(cmd: AgentCommand): Promise<CommandResult> {
    try {
      if (this._mock) return this._mockExecute(cmd);
      switch (cmd.commandType) {
        case "SYNC_NOW":
          return { ok: true, result: { skipped: "Sync executado pelo loop principal; comando confirmado." } };

        case "TEST_DEVICE": {
          const loginOk = await this.login();
          if (!loginOk) return { ok: false, error: "Login no iDFace falhou (verifique IP/usuário/senha)" };
          const status = await this.getStatus();
          return { ok: status.online, result: status as unknown as Record<string, unknown> };
        }

        case "REBOOT_DEVICE": {
          // POST /reboot.fcgi?session= (body null) — doc oficial.
          await this.postAuthed("/reboot.fcgi", null);
          this.dropSession(); // equipamento reinicia → sessão morre
          return { ok: true, result: { requested: true } };
        }

        case "SET_DEVICE_TIME": {
          const iso = (cmd.payload as CommandPayloads["SET_DEVICE_TIME"]).iso;
          const when = new Date(iso);
          if (!Number.isFinite(when.getTime())) return { ok: false, error: `ISO inválido: ${iso}` };
          const sp = spParts(when); // horário LOCAL do equipamento (America/Sao_Paulo)
          // POST /set_system_time.fcgi?session= — doc oficial.
          await this.postAuthed("/set_system_time.fcgi", {
            day: sp.day,
            month: sp.month,
            year: sp.year,
            hour: sp.hour,
            minute: sp.minute,
            second: sp.second,
          });
          return { ok: true, result: { iso, appliedLocal: `${sp.date} ${sp.time}:${String(sp.second).padStart(2, "0")}` } };
        }

        case "PULL_ALL_EVENTS": {
          const events = await this.getNewEvents((cmd.payload as CommandPayloads["PULL_ALL_EVENTS"]).fromIso);
          return { ok: true, result: { pulledCount: events.length } };
        }

        case "ENROLL_USER": {
          const p = cmd.payload as CommandPayloads["ENROLL_USER"];
          // POST /create_objects.fcgi?session= — doc oficial.
          const created = await this.postAuthed<Record<string, unknown>>("/create_objects.fcgi", {
            object: "users",
            values: [{ name: p.name, registration: p.employeeExternalId }],
          });
          const ids = (created as { ids?: Array<number | string> } | null)?.ids;
          const userId = Array.isArray(ids) && ids.length ? Number(ids[0]) : null;
          // Cartão (identifier) é opcional; cards.value é int64 no equipamento.
          if (userId && p.identifier && /^\d+$/.test(p.identifier)) {
            await this.postAuthed("/create_objects.fcgi", {
              object: "cards",
              values: [{ value: Number(p.identifier), user_id: userId }],
            });
          }
          return { ok: true, result: { userId, registration: p.employeeExternalId, card: !!p.identifier } };
        }

        default:
          return { ok: false, error: `Comando não implementado: ${cmd.commandType}` };
      }
    } catch (e) {
      return {
        ok: false,
        error: errMsg(e),
        result: { retryable: true },
      };
    }
  }

  // ── MOCK MODE (MOCK=true — testes sem hardware) ─────────────────────────

  private _genMockEvents(sinceIso?: string): IDFaceTimeEvent[] {
    const sinceMs = sinceIso ? new Date(sinceIso).getTime() : this._startupAt.getTime();
    const now = Date.now();
    const items: IDFaceTimeEvent[] = [];
    const mockUsers = ["U1001", "U1002", "U1003", "U1004"];
    const perUserPerDay = 4;
    let cursor = sinceMs;
    while (cursor < now && items.length < this.cfg.readEventsBatchSize) {
      for (const u of mockUsers) {
        for (let i = 0; i < perUserPerDay && items.length < this.cfg.readEventsBatchSize; i++) {
          const hour = i === 0 ? 8 + Math.floor(Math.random() * 2) : i === 1 ? 12 : i === 2 ? 13 + Math.floor(Math.random() * 2) : 18;
          const d = new Date(cursor);
          d.setHours(hour, Math.floor(Math.random() * 30), Math.floor(Math.random() * 60), 0);
          if (d.getTime() > now) break;
          const sp = spParts(d);
          const eid = `MOCK-${this.cfg.deviceId}-${d.getTime()}-${this._mockSeq++}`;
          items.push({
            externalEventId: eid,
            deviceId: this.cfg.deviceId,
            deviceSerialNumber: this.cfg.deviceSerialNumber,
            employeeExternalId: u,
            date: sp.date,
            time: sp.time,
            timestamp: d.toISOString(),
            kind: i % 2 === 0 ? "ENTRY" : "EXIT",
            origin: "IDFACE",
            originalEventRef: eid,
            note: "GERADO POR MOCK MODE",
          });
        }
      }
      cursor += 24 * 3600 * 1000;
    }
    return items;
  }

  private _mockExecute(cmd: AgentCommand): CommandResult {
    log.debug({ cmdId: cmd.id, type: cmd.commandType }, "MOCK execute command");
    switch (cmd.commandType) {
      case "SYNC_NOW":
        return { ok: true, result: { mock: true, acknowledged: true, ts: new Date().toISOString() } };
      case "TEST_DEVICE":
        return { ok: true, result: { mock: true, online: true, serial: this.cfg.deviceSerialNumber, ts: new Date().toISOString() } };
      case "REBOOT_DEVICE":
        return { ok: true, result: { mock: true, rebooted: true, ts: new Date().toISOString() } };
      case "SET_DEVICE_TIME":
        return { ok: true, result: { mock: true, iso: (cmd.payload as CommandPayloads["SET_DEVICE_TIME"]).iso, ts: new Date().toISOString() } };
      case "PULL_ALL_EVENTS": {
        const evs = this._genMockEvents();
        return { ok: true, result: { mock: true, pulledCount: evs.length } };
      }
      case "ENROLL_USER":
        return { ok: true, result: { mock: true, user: (cmd.payload as CommandPayloads["ENROLL_USER"]).employeeExternalId } };
      default:
        return { ok: false, error: `Comando não implementado em MOCK: ${cmd.commandType}` };
    }
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length ? v : undefined;
}

/**
 * Detecta recusa de sessão pelo equipamento: HTTP 401/403 ou resposta HTML
 * (firmware devolve a tela de login quando a sessão é inválida/expirada).
 */
function isSessionError(e: unknown): boolean {
  if (!axios.isAxiosError(e)) return false;
  const status = e.response?.status;
  if (status === 401 || status === 403) return true;
  const ct = String(e.response?.headers?.["content-type"] ?? "");
  return ct.includes("text/html");
}
