import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { pino } from "pino";

const log = pino({ name: "sqlite", level: process.env.LOG_LEVEL ?? "info" });

export interface PendingEvent {
  id: number;
  payload_json: string;
  created_at: string;
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  external_event_id: string | null;
  next_attempt_at: string | null;
}

export interface SentEvent {
  id: number;
  external_event_id: string;
  payload_json: string;
  server_response_json: string | null;
  created_at: string;
  sent_at: string;
}

export interface KvEntry {
  key: string;
  value: string;
  updated_at: string;
}

let _db: Database.Database | null = null;

export function getDb(dbPath: string): Database.Database {
  if (_db) return _db;
  const dir = path.dirname(path.resolve(dbPath));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  _db = new Database(dbPath);
  _db.pragma("journal_mode = WAL");
  _db.pragma("busy_timeout = 5000");
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  log.info("SQLite DB ready at %s", dbPath);
  return _db;
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TEXT,
      external_event_id TEXT,
      next_attempt_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sent_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      external_event_id TEXT NOT NULL UNIQUE,
      payload_json TEXT NOT NULL,
      server_response_json TEXT,
      created_at TEXT NOT NULL,
      sent_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  // Bancos criados por versões antigas: adiciona colunas novas se ausentes
  const cols = db.prepare("PRAGMA table_info(pending_events)").all() as Array<{ name: string }>;
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("external_event_id")) {
    db.exec("ALTER TABLE pending_events ADD COLUMN external_event_id TEXT");
  }
  if (!names.has("next_attempt_at")) {
    db.exec("ALTER TABLE pending_events ADD COLUMN next_attempt_at TEXT");
  }

  // Backfill do external_event_id a partir do payload (idempotência retroativa)
  const missing = db
    .prepare("SELECT id, payload_json FROM pending_events WHERE external_event_id IS NULL")
    .all() as Array<{ id: number; payload_json: string }>;
  if (missing.length) {
    const upd = db.prepare("UPDATE pending_events SET external_event_id = ? WHERE id = ?");
    for (const r of missing) {
      try {
        const ee = (JSON.parse(r.payload_json) as { externalEventId?: unknown })?.externalEventId;
        if (typeof ee === "string" && ee.length > 0) upd.run(ee, r.id);
      } catch {
        // payload inválido — permanece com external_event_id NULL
      }
    }
  }

  // Dedupe de fila legada: remove pendências já enviadas (confirmadas em sent_events)
  // e duplicatas internas mantendo apenas o menor id por external_event_id.
  // Nenhum evento único e não confirmado é removido aqui.
  db.exec(`
    DELETE FROM pending_events
    WHERE external_event_id IS NOT NULL
      AND external_event_id IN (SELECT external_event_id FROM sent_events);

    DELETE FROM pending_events
    WHERE external_event_id IS NOT NULL
      AND id NOT IN (
        SELECT MIN(id) FROM pending_events
        WHERE external_event_id IS NOT NULL
        GROUP BY external_event_id
      );
  `);

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_external ON pending_events(external_event_id);
    CREATE INDEX IF NOT EXISTS idx_pending_next_attempt ON pending_events(next_attempt_at, id);
    CREATE INDEX IF NOT EXISTS idx_pending_attempts ON pending_events(attempts, id);
    CREATE INDEX IF NOT EXISTS idx_sent_created ON sent_events(created_at DESC);
  `);
}

export function getKv(db: Database.Database, key: string): string | null {
  const row = db.prepare("SELECT value FROM kv_store WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setKv(db: Database.Database, key: string, value: string) {
  db.prepare(
    "INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
  ).run(key, value);
}

/**
 * Enfileira evento de forma idempotente: se o payload tiver externalEventId,
 * usa INSERT OR IGNORE na coluna única external_event_id — re-leituras do
 * iDFace (ex.: após crash antes de avançar o cursor) não duplicam a fila.
 * Retorna true se o evento foi efetivamente inserido.
 */
export function queuePendingEvent(db: Database.Database, payload: unknown): boolean {
  const payloadJson = JSON.stringify(payload);
  let externalId: string | null = null;
  try {
    const ee = (payload as { externalEventId?: unknown } | null)?.externalEventId;
    if (typeof ee === "string" && ee.length > 0) externalId = ee;
  } catch {
    externalId = null;
  }
  const res = externalId
    ? db
        .prepare("INSERT OR IGNORE INTO pending_events (payload_json, external_event_id) VALUES (?, ?)")
        .run(payloadJson, externalId)
    : db.prepare("INSERT INTO pending_events (payload_json) VALUES (?)").run(payloadJson);
  return res.changes > 0;
}

/**
 * Retorna lote FIFO respeitando backoff: só eventos cujo next_attempt_at
 * já venceu (ou nunca tentaram) são elegíveis.
 */
export function takePendingBatch(db: Database.Database, limit = 500): PendingEvent[] {
  return db
    .prepare(
      `SELECT * FROM pending_events
       WHERE next_attempt_at IS NULL
          OR next_attempt_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now')
       ORDER BY id ASC
       LIMIT ?`,
    )
    .all(limit) as PendingEvent[];
}

const BACKOFF_BASE_SEC = 5;
const BACKOFF_MAX_SEC = 15 * 60; // 15 min

/**
 * Registra tentativa falha e agenda a próxima com backoff exponencial
 * (5s, 10s, 20s, ... teto 15min). O evento NUNCA é descartado — apenas
 * aguarda a próxima janela de retry (offline-first).
 */
export function markPendingAttempt(
  db: Database.Database,
  id: number,
  error: string | null,
) {
  const row = db.prepare("SELECT attempts FROM pending_events WHERE id = ?").get(id) as
    | { attempts: number }
    | undefined;
  if (!row) return;
  const attempts = row.attempts + 1;
  const delaySec = Math.min(
    BACKOFF_BASE_SEC * 2 ** Math.min(attempts - 1, 12),
    BACKOFF_MAX_SEC,
  );
  const nextAt = new Date(Date.now() + delaySec * 1000).toISOString();
  db.prepare(
    "UPDATE pending_events SET attempts = ?, last_error = ?, last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), next_attempt_at = ? WHERE id = ?",
  ).run(attempts, error, nextAt, id);
}

export function movePendingToSent(
  db: Database.Database,
  pending: PendingEvent[],
  processedExternalIds: string[],
  serverResponse: unknown,
) {
  const tx = db.transaction((rows: PendingEvent[]) => {
    const del = db.prepare("DELETE FROM pending_events WHERE id = ?");
    const insSent = db.prepare(
      "INSERT OR IGNORE INTO sent_events (external_event_id, payload_json, server_response_json, created_at) VALUES (?, ?, ?, ?)",
    );
    for (const r of rows) del.run(r.id);
    const respJson = JSON.stringify(serverResponse ?? null);
    for (const extId of processedExternalIds) {
      const row = rows.find((r) => {
        try {
          return JSON.parse(r.payload_json).externalEventId === extId;
        } catch {
          return false;
        }
      });
      const payloadJson = row?.payload_json ?? "{}";
      const created =
        row?.created_at ?? new Date().toISOString().replace("Z", "");
      insSent.run(extId, payloadJson, respJson, created);
    }
  });
  tx(pending);
}

/**
 * Diagnóstico: conta eventos com muitas tentativas (NUNCA os remove).
 * Eventos ficam retidos em pending_events até confirmação do servidor,
 * independente do número de tentativas.
 */
export function countStuckEvents(db: Database.Database, minAttempts = 25): number {
  const row = db
    .prepare("SELECT COUNT(*) AS c FROM pending_events WHERE attempts >= ?")
    .get(minAttempts) as { c: number };
  if (row.c > 0) {
    log.warn("%d eventos com >= %d tentativas seguem retidos na fila (nunca descartados)", row.c, minAttempts);
  }
  return row.c;
}
