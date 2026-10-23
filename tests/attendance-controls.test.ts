import { test } from "node:test";
import assert from "node:assert/strict";
import { insideWindow, policyDefaults, policyInput } from "../server/lib/attendance-policy";
import { adjustmentInput } from "../server/lib/adjustment-input";
import { bankInput, bankLedger, type BankMovement } from "../server/lib/hour-bank";
import { buildSheet, type SheetEntry } from "../server/lib/attendance";
const schedule = { name: "Comercial", model: "CINCOXDOIS", toleranceMinutes: 5, days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, isDayOff: weekday === 0 || weekday === 6, entryTime: "08:00", breakStartTime: "12:00", breakEndTime: "13:00", departureTime: weekday === 5 ? "17:00" : "18:00" })) };
test("janela de 30 minutos é inclusiva, respeita sexta curta e folgas, sem restringir almoço", () => {
  for (const time of ["07:30", "08:00", "12:30", "18:30"]) assert.equal(insideWindow("2026-10-19", time, schedule, policyDefaults), true);
  for (const time of ["07:29", "18:31"]) assert.equal(insideWindow("2026-10-19", time, schedule, policyDefaults), false);
  assert.equal(insideWindow("2026-10-23", "17:30", schedule, policyDefaults), true);
  assert.equal(insideWindow("2026-10-23", "17:31", schedule, policyDefaults), false);
  assert.equal(insideWindow("2026-10-24", "08:00", schedule, policyDefaults), false);
  assert.equal(insideWindow("2026-10-19", "08:00", null, policyDefaults), false);
  assert.equal(insideWindow("2026-10-19", "06:00", null, { ...policyDefaults, windowEnabled: false }), true);
});
test("janela funciona na madrugada e antes de um turno que começa à meia-noite", () => {
  const night = { ...schedule, days: schedule.days.map(day => ({ ...day, entryTime: "22:00", departureTime: "07:00", breakStartTime: "02:00", breakEndTime: "03:00" })) };
  assert.equal(insideWindow("2026-10-20", "07:30", night, policyDefaults), true);
  assert.equal(insideWindow("2026-10-20", "07:31", night, policyDefaults), false);
  const midnight = { ...schedule, days: schedule.days.map(day => ({ ...day, entryTime: "00:15", departureTime: "09:15", breakStartTime: "04:00", breakEndTime: "05:00" })) };
  assert.equal(insideWindow("2026-10-18", "23:45", midnight, policyDefaults), true);
  assert.equal(insideWindow("2026-10-18", "23:44", midnight, policyDefaults), false);
});
test("repetida preservada não invalida nem aumenta as quatro batidas originais no espelho", () => {
  const entries: SheetEntry[] = ["08:00", "12:00", "13:00", "18:00"].map(time => ({ id: time, date: "2026-10-19", time, timestamp: null, kind: "MARK", status: "VALIDO", origin: "IDFACE" }));
  entries.push({ ...entries[0], id: "repeat", time: "08:01", status: "INCONSISTENTE", reviewFlags: ["DUPLICATE"] });
  const report = buildSheet({ month: "2026-10", schedule, entries, holidays: [], absences: [], admissionDate: null, now: new Date("2026-10-23T15:00:00Z") });
  const day = report.rows.find(row => row.date === "2026-10-19")!;
  assert.equal(day.punches.length, 4); assert.equal(day.workedMinutes, 540); assert.equal(day.balanceMinutes, 0); assert.ok(day.notes.some(note => note.includes("repetida")));
});
test("ajustes exigem justificativa e alvo consistente e não aceitam aprovação injetada na solicitação", () => {
  const request = { operation: "request", employeeId: "cm12345678901234567890123", type: "INSERT", date: "2026-10-19", time: "08:00", justification: "Esqueci de registrar na entrada" };
  assert.equal(adjustmentInput.safeParse(request).success, true);
  for (const patch of [{ justification: "" }, { type: "REPLACE" }, { type: "EXCLUDE" }, { date: "2026-02-30" }, { status: "APROVADO" }, { approvedById: "other" }]) assert.equal(adjustmentInput.safeParse({ ...request, ...patch }).success, false);
  assert.equal(adjustmentInput.safeParse({ operation: "review", id: request.employeeId, decision: "REJECT", note: "" }).success, false);
});
test("banco reconstrói abertura e saldo em ordem cronológica e preserva estorno como movimento inverso", () => {
  const row = (id: string, date: string, deltaMinutes: number, origin = "MANUAL_ADJUST"): BankMovement => ({ id, date, deltaMinutes, origin, note: "Conferência isolada", createdAt: date + "T12:00:00Z", needsRecalculation: false, reversalOfId: null });
  const report = bankLedger([row("b", "2026-10-20", -30), row("a", "2026-09-30", 120), { ...row("d", "2026-10-22", -60, "REVERSAL"), reversalOfId: "c" }, row("c", "2026-10-21", 60), row("future", "2026-11-01", 500)], "2026-10-01", "2026-10-31");
  assert.equal(report.openingBalance, 120); assert.equal(report.closingBalance, 90); assert.deepEqual(report.rows.map(row => row.balanceMinutes), [90, 150, 90]); assert.equal(report.creditMinutes, 60); assert.equal(report.debitMinutes, -90);
});
test("validação do banco rejeita valores nulos, datas inválidas e lançamento sem referência de repetição", () => {
  const value = { operation: "manual", employeeId: "cm12345678901234567890123", date: "2026-10-19", minutes: 60, reason: "Compensação conferida com responsável", submissionKey: "b7a635a7-6783-4cf3-a243-321889b4576d" };
  assert.equal(bankInput.safeParse(value).success, true);
  for (const patch of [{ minutes: 0 }, { minutes: 1.5 }, { date: "2026-02-30" }, { submissionKey: "" }, { reason: "" }, { origin: "DAILY_CALC" }]) assert.equal(bankInput.safeParse({ ...value, ...patch }).success, false);
  assert.equal(policyInput.safeParse({ ...policyDefaults, duplicateMinutes: -1 }).success, false);
});
