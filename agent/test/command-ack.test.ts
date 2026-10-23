import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AgentRuntime } from "../src/index";
import { agentConfigSchema } from "../src/config";
import { getDb, getKv, closeDb } from "../src/db/sqlite";
test("an executed command survives restart and retries its acknowledgement without repeating device writes", async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "vgon-ack-"));
  const cfg = agentConfigSchema.parse({ apiUrl: "http://localhost", agentToken: "test-only-token", dbPath: path.join(folder, "test.sqlite"), logLevel: "fatal", idface: { url: "http://localhost" } });
  let executed = 0, acked = 0;
  const first = new AgentRuntime(cfg);
  first.ctrl = { executeCommand: async () => { executed++; return { ok: true, result: { confirmed: true } }; } } as any;
  first.api = { finishCommand: async () => { acked++; throw new Error("network unavailable"); } } as any;
  first.cmdQueue.push({ id: "isolated-command", commandType: "TEST_DEVICE", payload: {}, attempts: 1, createdAt: new Date().toISOString() });
  try {
    await first.commandsTick(); assert.equal(executed, 1); assert.ok(getKv(getDb(cfg.dbPath), "pending_command_ack"));
    closeDb();
    const restarted = new AgentRuntime(cfg);
    restarted.api = { finishCommand: async () => { acked++; return { command: { status: "SUCCESS" } }; }, pollNextCommand: async () => null } as any;
    await restarted.commandsTick();
    assert.equal(acked, 2); assert.equal(executed, 1); assert.equal(getKv(getDb(cfg.dbPath), "pending_command_ack"), "");
  } finally { closeDb(); fs.rmSync(folder, { recursive: true, force: true }); }
});
