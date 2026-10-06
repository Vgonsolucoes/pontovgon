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
      last_attempt_at TEXT
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

export function queuePendingEvent(db: Database.Database, payload: unknown) {
  db.prepare("INSERT INTO pending_events (payload_json) VALUES (?)").run(
    JSON.stringify(payload),
  );
}

export function takePendingBatch(db: Database.Database, limit = 500): PendingEvent[] {
  return db
    .prepare(
      "SELECT * FROM pending_events ORDER BY attempts ASC, id ASC LIMIT ?",
    )
    .all(limit) as PendingEvent[];
}

export function markPendingAttempt(
  db: Database.Database,
  id: number,
  error: string | null,
) {
  db.prepare(
    "UPDATE pending_events SET attempts = attempts + 1, last_error = ?, last_attempt_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
  ).run(error, id);
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

export function deleteFailed(db: Database.Database, maxAttempts = 25) {
  const result = db
    .prepare("DELETE FROM pending_events WHERE attempts >= ?")
    .run(maxAttempts);
  if (result.changes > 0) log.warn("Purged %d events with >= %d attempts", result.changes, maxAttempts);
}
