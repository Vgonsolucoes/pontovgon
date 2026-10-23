import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { agentConfigSchema } from "../src/config";
import { ControlIdService } from "../src/services/ControlIdService";
import { parseServiceState } from "../src/ui/service-state";
import { renderConfigPage } from "../src/ui/page";
import vm from "node:vm";

test("status sends an object accepted by firmware and reads official serial/version fields", async () => {
  let reply: unknown = { serial: "TEST-SERIAL", version: "6.18.6", network: { mac: "TEST-MAC" } };
  let statusBody = "";
  const server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/login.fcgi") {
      res.end(JSON.stringify({ session: "test-session" }));
      return;
    }
    assert.equal(req.url, "/system_information.fcgi?session=test-session");
    statusBody = body;
    if (body === "null") {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid POST data (object expected)" }));
    } else res.end(typeof reply === "string" ? reply : JSON.stringify(reply));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as import("node:net").AddressInfo).port;
    const config = agentConfigSchema.parse({ apiUrl: "http://localhost", agentToken: "test-only-token", idface: { url: `http://127.0.0.1:${port}`, user: "test", password: "test" } });
    const client = new ControlIdService(config);
    const status = await client.getStatus();
    assert.equal(status.online, true);
    assert.deepEqual(JSON.parse(statusBody), {});
    assert.equal(status.serialNumber, "TEST-SERIAL");
    assert.equal(status.firmware, "6.18.6");
    reply = "<html>login</html>";
    assert.equal((await client.getStatus()).online, false);
    reply = { error: "Invalid session" };
    assert.equal((await client.getStatus()).online, false);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test("service status supports Portuguese and English sc output", () => {
  assert.equal(parseServiceState("    ESTADO             : 4  RUNNING"), "RUNNING");
  assert.equal(parseServiceState("    STATE              : 1  STOPPED"), "STOPPED");
  assert.equal(parseServiceState("    ESTADO             : 3  STOP_PENDING"), "STOP_PENDING");
  assert.equal(parseServiceState("    TYPE               : 10 WIN32_OWN_PROCESS"), "UNKNOWN");
});

test("UI displays network failure and disables actions after stopping its own service", async () => {
  const elements = new Map<string, any>();
  const buttons = [{ disabled: false }, { disabled: false }];
  const context = vm.createContext({
    document: {
      getElementById: (id: string) => {
        if (!elements.has(id)) elements.set(id, { textContent: "", value: "", checked: false });
        return elements.get(id);
      },
      querySelectorAll: () => buttons,
    },
    AbortController, setTimeout, clearTimeout,
    setInterval: () => 1, clearInterval: () => {},
    fetch: async () => { throw new Error("connection refused"); },
  });
  const script = renderConfigPage("test-token").match(/<script>([\s\S]*?)<\/script>/)![1];
  vm.runInContext(script, context);
  const failure = await vm.runInContext('api("/api/test/idface")', context);
  assert.equal(failure.ok, false);
  assert.match(failure.error, /menu Iniciar/);
  context.fetch = async () => ({ json: async () => ({ ok: true, requiresLauncher: true }) });
  vm.runInContext('svc("stop")', context);
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(buttons.every(button => button.disabled));
  assert.match(elements.get("hdrBadge").textContent, /menu Iniciar/);
});
