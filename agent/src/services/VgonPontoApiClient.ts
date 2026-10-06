import axios, { AxiosInstance } from "axios";
import type { AgentConfig } from "../config";
import type { IDFaceTimeEvent, AgentCommand, CommandResult } from "./ControlIdService";
import { pino } from "pino";

export interface HeartbeatInput {
  version?: string;
  computerName?: string;
  localIp?: string;
  osVersion?: string;
  pendingEvents: number;
  agentStatus?: "ONLINE" | "OFFLINE" | "SYNCING" | "AUTH_ERROR" | "API_OFFLINE";
  raw?: Record<string, unknown>;
}

const log = pino({ name: "api-client", level: process.env.LOG_LEVEL ?? "info" });

export class VgonPontoApiClient {
  private http: AxiosInstance;
  private token: string;
  public baseUrl: string;

  constructor(config: AgentConfig) {
    this.token = config.agentToken;
    this.baseUrl = config.apiUrl.replace(/\/$/, "");
    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "User-Agent": "VGON-PONTO-Agent/0.1.0",
        "Content-Type": "application/json",
      },
    });
  }

  async heartbeat(hb: HeartbeatInput) {
    const { data } = await this.http.post("/api/agents/heartbeat", hb);
    return data as {
      ok: boolean;
      serverNow: string;
      agentId: string;
      heartbeatId: string;
      nextHeartbeatSec: number;
      commands: { pollIntervalSec: number };
    };
  }

  async pollNextCommand(): Promise<AgentCommand | null> {
    const { data } = await this.http.get("/api/agents/commands/next");
    return (data.command as AgentCommand | null) ?? null;
  }

  async finishCommand(id: string, res: CommandResult) {
    const payload: {
      status: "SUCCESS" | "FAILED";
      result?: Record<string, unknown> | null;
      error?: string | null;
    } = {
      status: res.ok ? "SUCCESS" : "FAILED",
      result: res.result ?? null,
      error: res.error ?? null,
    };
    const { data } = await this.http.patch(`/api/agents/commands/${id}`, payload);
    return data as { ok: boolean; command: { id: string; status: string } };
  }

  async sendTimeEntriesBatch(params: {
    events: IDFaceTimeEvent[];
    deviceUniqueId: string;
    deviceSerialNumber?: string;
    startedAt?: string;
    syncId?: string;
  }) {
    const { data } = await this.http.post("/api/agents/time-entries/batch", {
      deviceUniqueId: params.deviceUniqueId,
      deviceSerialNumber: params.deviceSerialNumber,
      syncId: params.syncId,
      startedAt: params.startedAt ?? new Date().toISOString(),
      items: params.events,
    });
    return data as {
      ok: boolean;
      syncLogId: string;
      serverNow: string;
      received: number;
      created: number;
      duplicated: number;
      failed: number;
      failedItems?: Array<{ idx: number; externalEventId: string; error: string }>;
    };
  }
}
