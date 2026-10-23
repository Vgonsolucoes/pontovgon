import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { agentConfigSchema } from "../src/config";
import { ControlIdService } from "../src/services/ControlIdService";

test("employee + face contract is idempotent, rejects wrong identity and requires explicit facial success", async () => {
  const users: Array<{ id: number; registration: string; name: string }> = [];
  let creates = 0, photoCalls = 0, photoSuccess = true, loseCreateReply = false;
  const fixture = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const server = http.createServer(async (req, res) => {
    let raw = ""; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    res.setHeader("Content-Type", "application/json");
    if (req.url === "/login.fcgi") { res.end(JSON.stringify({ session: "isolated-session" })); return; }
    const endpoint = req.url!.split("?")[0];
    if (endpoint === "/system_information.fcgi") { res.end(JSON.stringify({ serial: "ISOLATED-SERIAL" })); return; }
    if (endpoint === "/load_objects.fcgi") {
      assert.deepEqual(body.fields, ["id", "name", "registration"]);
      const filter = body.where.users;
      res.end(JSON.stringify({ users: users.filter(user => Object.entries(filter).every(([key, value]) => user[key as keyof typeof user] === value)) }));
    } else if (endpoint === "/create_objects.fcgi") {
      creates++; const user = { id: creates, ...body.values[0] }; users.push(user);
      res.end(JSON.stringify(loseCreateReply ? {} : { ids: [user.id] })); loseCreateReply = false;
    } else if (endpoint === "/modify_objects.fcgi") {
      const user = users.find(user => user.id === body.where.users.id)!;
      Object.assign(user, body.values); res.end(JSON.stringify({ changes: 1 }));
    } else if (endpoint === "/user_set_image_list.fcgi") {
      photoCalls++; assert.equal(body.match, true); assert.equal(body.user_images.length, 1);
      assert.equal(body.user_images[0].image, fixture.toString("base64"));
      assert.equal(typeof body.user_images[0].timestamp, "number");
      res.end(JSON.stringify({ results: [{ user_id: body.user_images[0].user_id, success: photoSuccess, ...(photoSuccess ? {} : { errors: [{ code: 8, message: "Low sharpness" }] }) }] }));
    } else { res.statusCode = 404; res.end("{}"); }
  });
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try {
    const port = (server.address() as import("node:net").AddressInfo).port;
    const cfg = agentConfigSchema.parse({ apiUrl: "http://localhost", agentToken: "test-only-token", idface: { url: `http://127.0.0.1:${port}`, deviceId: "isolated-device" } });
    const client = new ControlIdService(cfg);
    const payload = { employeeId: "isolated-employee", deviceId: "server-device", deviceUniqueId: "isolated-device", deviceSerialNumber: "ISOLATED-SERIAL", registration: "TEST-001", name: "Isolated test", expectedUserId: null, imageBase64: fixture.toString("base64"), imageHash: createHash("sha256").update(fixture).digest("hex"), timestamp: 1700000000 };
    const send = (overrides = {}) => client.executeCommand({ id: "isolated-command", commandType: "SYNC_EMPLOYEE", createdAt: new Date().toISOString(), attempts: 1, payload: { ...payload, ...overrides } });
    assert.equal((await send()).ok, true);
    assert.equal((await send({ name: "Updated name" })).ok, true);
    assert.equal(creates, 1); assert.equal(users[0].name, "Updated name");
    photoSuccess = false;
    const rejected = await send(); assert.equal(rejected.ok, false); assert.equal(rejected.result?.userConfirmed, true); assert.equal(rejected.result?.photoRegistered, false); assert.match(rejected.error!, /nitidez/);
    const calls = photoCalls;
    assert.equal((await send({ deviceUniqueId: "another-device" })).ok, false);
    assert.equal((await send({ deviceSerialNumber: "wrong-serial" })).ok, false);
    assert.equal((await send({ expectedUserId: 999 })).ok, false);
    assert.equal((await send({ imageHash: "0".repeat(64) })).ok, false);
    assert.equal(photoCalls, calls);
    loseCreateReply = true; photoSuccess = true;
    assert.equal((await send({ registration: "TEST-002" })).ok, false);
    assert.equal((await send({ registration: "TEST-002" })).ok, true);
    assert.equal(creates, 2);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
