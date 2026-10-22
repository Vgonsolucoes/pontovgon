import { test } from "node:test";
import assert from "node:assert/strict";
import { agentConfigSchema } from "../src/config";

test("mock requires both an isolated environment and explicit opt-in", () => {
  const env = process.env.NODE_ENV, allow = process.env.VGON_ALLOW_MOCK;
  const config = { apiUrl: "http://localhost:3000", agentToken: "test-only-token", idface: { url: "http://localhost" }, mock: true };
  try {
    for (const mode of [undefined, "production", "development", "test"]) {
      if (mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = mode;
      delete process.env.VGON_ALLOW_MOCK;
      assert.equal(agentConfigSchema.safeParse(config).success, false);
      process.env.VGON_ALLOW_MOCK = "true";
      assert.equal(agentConfigSchema.safeParse(config).success, mode === "development" || mode === "test");
    }
    assert.equal(agentConfigSchema.safeParse({ ...config, mock: "false" }).success, false);
    assert.equal(agentConfigSchema.safeParse({ ...config, mock: false }).success, true);
  } finally {
    if (env === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = env;
    if (allow === undefined) delete process.env.VGON_ALLOW_MOCK; else process.env.VGON_ALLOW_MOCK = allow;
  }
});
