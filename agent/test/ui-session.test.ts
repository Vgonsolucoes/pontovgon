import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import http from "node:http";

test("shortcut authorizes a session; plain URL works afterward but untrusted clients stay blocked", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vgon-ui-session-"));
  process.env.VGON_AGENT_DATA_DIR = dir;
  const { startUiServer } = require("../src/ui/server") as typeof import("../src/ui/server");
  const server = startUiServer({ mode: "standalone", getRuntimeStatus: () => null, syncNow: async () => "test" }, 0);
  await once(server, "listening");
  const port = (server.address() as import("node:net").AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(base + "/api/config")).status, 401);
    const token = fs.readFileSync(path.join(dir, "ui-token"), "utf8");
    const auth = await fetch(base + "/?token=" + token, { redirect: "manual" });
    assert.equal(auth.status, 303);
    assert.equal(auth.headers.get("location"), "/");
    const setCookie = auth.headers.get("set-cookie")!;
    assert.match(setCookie, /HttpOnly/); assert.match(setCookie, /SameSite=Strict/);
    assert.ok(!setCookie.includes(token));
    const cookie = setCookie.split(";")[0];
    const page = await fetch(base, { headers: { cookie } });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /VGON PONTO Agent/);
    assert.equal((await fetch(base + "/api/ping", { headers: { cookie } })).status, 200);
    const invalidTest = await fetch(base + "/api/test/idface", {
      method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ config: { idface: { url: "invalid" } } }),
    });
    assert.equal(invalidTest.status, 400);
    assert.equal((await invalidTest.json() as { ok: boolean }).ok, false);
    assert.equal((await fetch(base + "/api/ping", { headers: { "x-ui-token": token } })).status, 200);
    assert.equal((await fetch(base + "/api/ping", { headers: { "x-ui-token": "invalid" } })).status, 401);
    assert.equal((await fetch(base + "/api/ping", { headers: { cookie: "vgon_ui_session=invalid" } })).status, 401);
    assert.equal((await fetch(base + "/api/ping", { headers: { cookie, origin: "https://untrusted.invalid" } })).status, 403);
    const rebound = await new Promise<number>((resolve, reject) => {
      const request = http.get(base + "/api/ping", { headers: { host: "untrusted.invalid", cookie } }, response => {
        response.resume(); resolve(response.statusCode!);
      });
      request.on("error", reject);
    });
    assert.equal(rebound, 403);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
