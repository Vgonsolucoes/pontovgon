import { z } from "zod";
import fs from "node:fs";
import path from "node:path";

export const idfaceConfigSchema = z.object({
  url: z.string().min(1).url({ message: "idface.url deve ser uma URL LAN válida (ex: http://192.168.1.150)" }),
  port: z.coerce.number().int().positive().default(80),
  user: z.string().min(1).default("admin"),
  password: z.string().min(1).default("admin"),
  deviceId: z.string().min(1).default("4408801109279099"),
  deviceSerialNumber: z.string().optional(),
  deviceFirmware: z.string().optional(),
  deviceMac: z.string().optional(),
  readEventsBatchSize: z.coerce.number().int().positive().default(500),
  readEventsFromMinutesAgo: z.coerce.number().int().positive().default(1440),
});

export const agentConfigSchema = z.object({
  apiUrl: z.string().min(1).url({ message: "apiUrl inválida" }),
  agentToken: z.string().min(10).max(200),
  syncIntervalSec: z.coerce.number().int().min(5).max(600).default(30),
  pollCommandsIntervalSec: z.coerce.number().int().min(5).max(600).default(30),
  heartbeatIntervalSec: z.coerce.number().int().min(5).max(600).default(30),
  mock: z.coerce.boolean().default(false),
  dbPath: z.string().default("./data/agent.db"),
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  idface: idfaceConfigSchema,
});

export type IDFaceConfig = z.output<typeof idfaceConfigSchema>;
export type AgentConfig = z.output<typeof agentConfigSchema>;

const DEFAULT_CANDIDATES = [
  "agent.config.json",
  "./agent.config.json",
  path.resolve(process.cwd(), "agent.config.json"),
  path.resolve(process.cwd(), "config", "agent.config.json"),
];

export function loadConfig(overridePath?: string): AgentConfig {
  const envMock = process.env.MOCK ? process.env.MOCK !== "false" : undefined;
  const envToken = process.env.AGENT_TOKEN;
  const envApi = process.env.API_URL;

  const candidates: string[] = [];
  if (overridePath) candidates.push(overridePath);
  candidates.push(...DEFAULT_CANDIDATES);

  let raw: Record<string, unknown> | null = null;
  let usedPath: string | null = null;
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const buf = fs.readFileSync(p, "utf-8");
        raw = JSON.parse(buf);
        usedPath = p;
        break;
      }
    } catch {
      // ignore
    }
  }
  if (!raw) {
    if (envToken && envApi) {
      raw = {
        apiUrl: envApi,
        agentToken: envToken,
        mock: envMock ?? true,
        idface: {
          url: process.env.IDFACE_URL ?? "http://127.0.0.1",
          deviceId: process.env.IDFACE_DEVICE_ID ?? "mock",
        },
      };
    } else {
      throw new Error(
        "Nenhum agent.config.json encontrado em: " +
          candidates.join(", ") +
          ". Copie agent.config.json.example para agent.config.json e preencha.",
      );
    }
  }
  if (envToken) (raw as any).agentToken = envToken;
  if (envApi) (raw as any).apiUrl = envApi;
  if (envMock !== undefined) (raw as any).mock = envMock;
  const parsed = agentConfigSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      "agent.config.json inválido (path: " +
        usedPath +
        "): " +
        JSON.stringify(parsed.error.flatten(), null, 2),
    );
  }
  return parsed.data;
}
