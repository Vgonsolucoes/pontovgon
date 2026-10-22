import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { loadOrCreateUiToken } from "../src/ui/token-store";

test("simultaneous processes share one complete token without overwriting it", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vgon-token-race-"));
  const file = path.join(dir, "ui-token");
  try {
    const modulePath = path.resolve(__dirname, "../src/ui/token-store.ts");
    const tokens = await Promise.all(Array.from({ length: 8 }, () => new Promise<string>((resolve, reject) => {
      const script = `process.stdout.write(require(${JSON.stringify(modulePath)}).loadOrCreateUiToken(process.argv[1]))`;
      const child = spawn(process.execPath, ["--require", require.resolve("tsx/cjs"), "-e", script, file], { windowsHide: true });
      let output = "", error = "";
      child.stdout.on("data", b => output += b); child.stderr.on("data", b => error += b);
      child.on("error", reject); child.on("exit", code => code === 0 ? resolve(output) : reject(new Error(error)));
    })));
    assert.match(tokens[0], /^[a-f0-9]{48}$/);
    assert.equal(new Set(tokens).size, 1);
    assert.equal(loadOrCreateUiToken(file), tokens[0]);
    assert.deepEqual(fs.readdirSync(dir), ["ui-token"]);
    fs.writeFileSync(file, "invalid");
    assert.throws(() => loadOrCreateUiToken(file), /inválido/);
    assert.equal(fs.readFileSync(file, "utf8"), "invalid");
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
