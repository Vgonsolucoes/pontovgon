import axios, { AxiosInstance } from "axios";
import type { AgentConfig, IDFaceConfig } from "../config";
import { pino } from "pino";

export interface IDFaceTimeEvent {
  externalEventId: string;
  deviceId: string;
  deviceSerialNumber?: string;
  employeeExternalId?: string;
  employeeId?: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  timestamp: string; // ISO
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

export class ControlIdService {
  private http: AxiosInstance;
  private _mock: boolean;
  private cfg: IDFaceConfig;
  private _lastSession: string | null = null;
  private _mockSeq = 1;
  private _startupAt = new Date();

  constructor(config: AgentConfig) {
    this.cfg = config.idface;
    this._mock = !!config.mock;
    this.http = axios.create({
      baseURL: `${this.cfg.url.replace(/\/$/, "")}:${this.cfg.port}`,
      timeout: 6000,
      headers: { "User-Agent": "VGON-PONTO-Agent/0.1.0" },
    });
  }

  get isMock(): boolean {
    return this._mock;
  }

  async login(): Promise<boolean> {
    if (this._mock) {
      this._lastSession = "mock-session-" + Date.now();
      return true;
    }
    try {
      // TODO (doc oficial Control iD firmware 6.18.6): POST /api.cgi?action=login&user=admin&pwd=BASE64(senha)
      // Resposta: { session: "xxxx" }
      const res = await this.http.get("/api.cgi", {
        params: { action: "login", user: this.cfg.user, pwd: Buffer.from(this.cfg.password).toString("base64") },
      });
      const sess = (res.data as any)?.session;
      if (sess) {
        this._lastSession = sess;
        return true;
      }
      log.warn({ data: res.data }, "Resposta login iDFace sem session");
      return false;
    } catch (e) {
      log.debug({ err: e instanceof Error ? e.message : String(e) }, "Login iDFace falhou");
      return false;
    }
  }

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
      const res = await this.http.get("/api.cgi", {
        params: { action: "get_device_status", session: this._lastSession },
      });
      const d = res.data as any;
      return {
        online: true,
        serialNumber: d?.serial_number ?? this.cfg.deviceSerialNumber,
        firmware: d?.firmware ?? this.cfg.deviceFirmware,
        mac: d?.mac ?? this.cfg.deviceMac,
        deviceUniqueId: d?.device_id ?? this.cfg.deviceId,
        lastCommunication: new Date().toISOString(),
        pendingInQueue: Number(d?.pending_events ?? 0),
      };
    } catch (e) {
      return {
        online: false,
        pendingInQueue: 0,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async getNewEvents(sinceIso?: string): Promise<IDFaceTimeEvent[]> {
    if (this._mock) return this._genMockEvents(sinceIso);

    // TODO (doc Control iD): GET /api.cgi?action=get_events&from=ISO&limit=XXX&session=...
    // Resposta: { events: [ {id, user_id, date, time, type, ...} ] }
    const from = sinceIso ?? new Date(Date.now() - 1000 * 60 * this.cfg.readEventsFromMinutesAgo).toISOString();
    const res = await this.http.get("/api.cgi", {
      params: {
        action: "get_events",
        session: this._lastSession,
        from,
        limit: this.cfg.readEventsBatchSize,
      },
    });
    const arr: unknown[] = (res.data as any)?.events ?? [];
    const out: IDFaceTimeEvent[] = [];
    for (const raw of arr) {
      const e = raw as any;
      const ts = new Date(e.timestamp ?? new Date().toISOString());
      out.push({
        externalEventId: String(e.id ?? `${this.cfg.deviceId}-${ts.getTime()}-${Math.random().toString(36).slice(2, 8)}`),
        deviceId: this.cfg.deviceId,
        deviceSerialNumber: this.cfg.deviceSerialNumber,
        employeeExternalId: e.user_id ?? undefined,
        date: ts.toISOString().slice(0, 10),
        time: ts.toISOString().slice(11, 16),
        timestamp: ts.toISOString(),
        kind: e.type,
        origin: "IDFACE",
        originalEventRef: String(e.id ?? ""),
      });
    }
    return out;
  }

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
          const eid = `MOCK-${this.cfg.deviceId}-${d.getTime()}-${this._mockSeq++}`;
          items.push({
            externalEventId: eid,
            deviceId: this.cfg.deviceId,
            deviceSerialNumber: this.cfg.deviceSerialNumber,
            employeeExternalId: u,
            date: d.toISOString().slice(0, 10),
            time: d.toISOString().slice(11, 16),
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

  async executeCommand(cmd: AgentCommand): Promise<CommandResult> {
    try {
      if (this._mock) return this._mockExecute(cmd);
      switch (cmd.commandType) {
        case "SYNC_NOW":
          return { ok: true, result: { skipped: "Real sync handled by loop. Command acknowledges." } };
        case "TEST_DEVICE":
          return { ok: true, result: { login: await this.login(), status: await this.getStatus() } };
        case "REBOOT_DEVICE": {
          await this.http.get("/api.cgi", {
            params: { action: "reboot", session: this._lastSession, reason: (cmd.payload as any).reason ?? "admin" },
          });
          return { ok: true, result: { requested: true } };
        }
        case "SET_DEVICE_TIME": {
          const iso = (cmd.payload as any).iso;
          await this.http.get("/api.cgi", {
            params: { action: "set_time", session: this._lastSession, iso },
          });
          return { ok: true, result: { iso } };
        }
        case "PULL_ALL_EVENTS": {
          const events = await this.getNewEvents((cmd.payload as any).fromIso);
          return { ok: true, result: { pulledCount: events.length } };
        }
        case "ENROLL_USER": {
          const p = cmd.payload as CommandPayloads["ENROLL_USER"];
          await this.http.get("/api.cgi", {
            params: {
              action: "enroll_user",
              session: this._lastSession,
              user_id: p.employeeExternalId,
              name: p.name,
              identifier: p.identifier ?? "",
            },
          });
          return { ok: true, result: { user: p.employeeExternalId, name: p.name } };
        }
        default:
          return { ok: false, error: `Comando não implementado: ${cmd.commandType}` };
      }
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        result: { retryable: true },
      };
    }
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
        return { ok: true, result: { mock: true, iso: (cmd.payload as any).iso, ts: new Date().toISOString() } };
      case "PULL_ALL_EVENTS": {
        const evs = this._genMockEvents();
        return { ok: true, result: { mock: true, pulledCount: evs.length } };
      }
      case "ENROLL_USER":
        return { ok: true, result: { mock: true, user: (cmd.payload as any).employeeExternalId } };
      default:
        return { ok: false, error: `Comando não implementado em MOCK: ${cmd.commandType}` };
    }
  }
}
