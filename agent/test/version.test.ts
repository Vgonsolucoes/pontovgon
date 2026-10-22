import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AGENT_VERSION } from "../src/version";

test("heartbeat and API client use the packaged agent version", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.equal(AGENT_VERSION, pkg.version);
  assert.match(AGENT_VERSION, /^\d+\.\d+\.\d+$/);
});
