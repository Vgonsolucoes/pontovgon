import { test } from "node:test";
import assert from "node:assert/strict";
import { timeSheetPrintHtml } from "../lib/print-time-sheet";
import { buildSheet } from "../server/lib/attendance";
test("documento de impressão preserva os 31 dias e escapa dados pessoais e observações", () => {
  const report = buildSheet({ month: "2026-10", schedule: null, entries: [], holidays: [], absences: [], admissionDate: null, now: new Date("2026-11-02T12:00:00Z") });
  const html = timeSheetPrintHtml({ ...report, rules: '<script>alert("x")</script>', employee: { name: '<img src=x onerror="alert(1)">', registration: '123" onclick="x', department: "RH & Administrativo", schedule: null } });
  assert.ok(html.includes("size: A4 portrait"));
  assert.equal((html.match(/<tr>/g) || []).length,32);
  assert.ok(!html.includes("<script>")); assert.ok(!html.includes("<img"));
  assert.ok(html.includes("&lt;script&gt;")); assert.ok(html.includes("RH &amp; Administrativo"));
  assert.ok(html.includes("31/10/2026")); assert.ok(html.includes("01/10/2026"));
});
