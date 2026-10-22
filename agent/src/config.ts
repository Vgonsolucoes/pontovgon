import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

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
  mock: z.boolean().default(false),
  dbPath: z.string().default("./data/agent.db"),
  logLevel: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  idface: idfaceConfigSchema,
}).superRefine((cfg, ctx) => {
  if (cfg.mock && (!["test", "development"].includes(process.env.NODE_ENV ?? "") || process.env.VGON_ALLOW_MOCK !== "true")) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mock"], message: "Simulação exige NODE_ENV=test/development e VGON_ALLOW_MOCK=true em ambiente isolado." });
  }
});

export type IDFaceConfig = z.output<typeof idfaceConfigSchema>;
export type AgentConfig = z.output<typeof agentConfigSchema>;

/** Diretório de dados do Agent quando instalado como serviço Windows. */
export const PROGRAMDATA_DIR =
  process.env.VGON_AGENT_DATA_DIR ?? "C:\\ProgramData\\VGON\\Ponto Agent";

/** Caminho efetivo do arquivo de configuração (env tem prioridade). */
export function resolveConfigPath(): string {
  return process.env.VGON_AGENT_CONFIG ?? path.join(PROGRAMDATA_DIR, "agent.config.json");
}

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
  if (process.env.VGON_AGENT_CONFIG) candidates.push(process.env.VGON_AGENT_CONFIG);
  candidates.push(path.join(PROGRAMDATA_DIR, "agent.config.json"));
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
        mock: envMock ?? false,
        idface: {
          url: process.env.IDFACE_URL ?? "",
          deviceId: process.env.IDFACE_DEVICE_ID ?? "",
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

/**
 * Persiste a configuração validada no caminho efetivo (ProgramData por padrão).
 * Cria o diretório se necessário. NUNCA loga o conteúdo (contém segredos).
 */
export function saveConfig(cfg: AgentConfig, targetPath?: string): string {
  const dest = targetPath ?? resolveConfigPath();
  const dir = path.dirname(dest);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(cfg, null, 2) + "\n", "utf-8");
  return dest;
}

/**
 * Token de acesso da UI local (http://127.0.0.1:3737). Persistido em
 * ProgramData (pasta com ACL restrita pelo instalador) e compartilhado entre
 * o serviço (modo embedded) e o launcher (modo standalone).
 * Gerado com crypto.randomBytes — não é ID de evento de ponto.
 */
export function getUiToken(): string {
  const tokenPath = path.join(PROGRAMDATA_DIR, "ui-token");
  try {
    const existing = fs.readFileSync(tokenPath, "utf-8").trim();
    if (existing.length >= 32) return existing;
  } catch {
    // não existe ou sem permissão — tenta criar abaixo
  }
  const token = randomBytes(24).toString("hex");
  const dir = path.dirname(tokenPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tokenPath, token, { encoding: "utf-8", mode: 0o600 });
  return token;
}
