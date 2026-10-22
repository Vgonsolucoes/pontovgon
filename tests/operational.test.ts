import { test } from "node:test";
import assert from "node:assert/strict";
import { isRecentCommunication } from "../server/lib/operational";
import { acknowledgedBatch } from "../agent/src/services/acknowledgement";

test("online requires recent, valid communication, never a future timestamp", () => {
  const now = Date.now();
  assert.equal(isRecentCommunication(null, now), false);
  assert.equal(isRecentCommunication("invalid", now), false);
  assert.equal(isRecentCommunication(new Date(now + 1000), now), false);
  assert.equal(isRecentCommunication(new Date(now - 120001), now), false);
  assert.equal(isRecentCommunication(new Date(now - 1000), now), true);
});
test("only explicitly confirmed successes leave the queue", () => {
  assert.deepEqual(acknowledgedBatch({ ok: true, received: 2, created: 1, duplicated: 0, failed: 1, failedItems: [{ externalEventId: "b" }] }, ["a", "b"]), ["a"]);
  assert.deepEqual(acknowledgedBatch({ ok: true, received: 2, created: 0, duplicated: 2, failed: 0 }, ["a", "b"]), ["a", "b"]);
});
test("truncated failure lists, invalid counts and unknown IDs preserve the entire batch", () => {
  for (const response of [
    { ok: false, received: 2, created: 2, duplicated: 0, failed: 0 },
    { ok: true, received: 2, created: 0, duplicated: 0, failed: 2, failedItems: [{ externalEventId: "a" }] },
    { ok: true, received: 2, created: 1, duplicated: 0, failed: 1, failedItems: [{ externalEventId: "unknown" }] },
    { ok: true, received: 1, created: 1, duplicated: 0, failed: 0 },
  ]) assert.throws(() => acknowledgedBatch(response, ["a", "b"]));
});
