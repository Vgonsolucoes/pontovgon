import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSheet, employeeScope, entryFilters, localToday, sheetFilters, type SheetEntry } from "../server/lib/attendance";
import { csvContent } from "../lib/attendance-display";
const schedule = () => ({ name: "Comercial", model: "CINCOXDOIS", toleranceMinutes: 5, days: Array.from({ length: 7 }, (_, weekday) => ({ weekday, isDayOff: weekday === 0 || weekday === 6, entryTime: "08:00", breakStartTime: "12:00", breakEndTime: "13:00", departureTime: weekday === 5 ? "17:00" : "18:00" })) });
const punch = (date: string, time: string, patch: Partial<SheetEntry> = {}): SheetEntry => ({ id: `${date}-${time}`, date, time, timestamp: null, kind: "MARK", status: "VALIDO", origin: "IDFACE", ...patch });
const base = () => ({ month: "2026-10", schedule: schedule(), entries: [] as SheetEntry[], holidays: [] as string[], absences: [] as { start: string; end: string; label: string; partial: boolean }[], admissionDate: null, now: new Date("2026-10-23T15:00:00Z") });
test("espelho calcula a jornada real de 44h usando as quatro batidas, sem descontar intervalo fictício", () => {
  const input = base(); input.entries = ["08:00", "12:00", "13:00", "18:00"].map(time => punch("2026-10-19", time));
  const row = buildSheet(input).rows.find(row => row.date === "2026-10-19")!;
  assert.equal(row.expectedMinutes, 540); assert.equal(row.workedMinutes, 540); assert.equal(row.balanceMinutes, 0);
  input.entries = ["08:00", "18:00"].map(time => punch("2026-10-19", time));
  assert.equal(buildSheet(input).rows.find(row => row.date === "2026-10-19")!.workedMinutes, 600);
});
test("metadados do cadastro não invalidam a jornada carregada do banco", () => {
  const saved = { ...schedule(), deletedAt: null };
  const report = buildSheet({ ...base(), schedule: saved });
  assert.equal(report.rows.find(row => row.date === "2026-10-19")!.expectedMinutes, 540);
});
test("batida ímpar, excluída, inconsistente e direção invertida não produzem saldo confirmado", () => {
  for (const entries of [
    [punch("2026-10-19", "08:00")],
    [punch("2026-10-19", "08:00"), punch("2026-10-19", "18:00", { status: "EXCLUIDO_LOGICAMENTE" })],
    [punch("2026-10-19", "08:00", { status: "INCONSISTENTE" }), punch("2026-10-19", "18:00")],
    [punch("2026-10-19", "08:00", { kind: "OUT" }), punch("2026-10-19", "18:00", { kind: "IN" })],
  ]) {
    const row = buildSheet({ ...base(), entries }).rows.find(row => row.date === "2026-10-19")!;
    assert.equal(row.workedMinutes, null); assert.equal(row.balanceMinutes, null);
  }
});
test("hoje e futuro não geram débito; antes da admissão, feriados e afastamentos aprovados dispensam previstas", () => {
  const input = base(); input.admissionDate = "2026-10-15"; input.holidays = ["2026-10-19"];
  input.absences = [{ start: "2026-10-20", end: "2026-10-21", label: "Ausência aprovada", partial: false }];
  const report = buildSheet(input), day = (date: string) => report.rows.find(row => row.date === date)!;
  for (const date of ["2026-10-01", "2026-10-19", "2026-10-20", "2026-10-21"]) assert.equal(day(date).expectedMinutes, 0);
  assert.equal(day("2026-10-23").balanceMinutes, null); assert.equal(day("2026-10-26").balanceMinutes, null);
  assert.equal(day("2026-10-22").balanceMinutes, -540); assert.equal(day("2026-10-24").status, "Previsto");
});
test("sem jornada, semana incompleta e 12x36 sem escala mantêm as batidas mas não inventam horas previstas", () => {
  for (const value of [null, { ...schedule(), days: [] }, { ...schedule(), model: "DOZEXTRINTASEIS" }]) {
    const row = buildSheet({ ...base(), schedule: value, entries: [punch("2026-10-19", "08:00"), punch("2026-10-19", "17:00")] }).rows.find(row => row.date === "2026-10-19")!;
    assert.equal(row.expectedMinutes, null); assert.equal(row.balanceMinutes, null); assert.equal(row.workedMinutes, 540);
  }
});
test("jornada noturna usa o dia de entrada, inclusive batidas do mês seguinte", () => {
  const input = base(); input.month = "2026-07"; input.now = new Date("2026-08-03T15:00:00Z");
  input.schedule.days = input.schedule.days.map(day => ({ ...day, entryTime: "22:00", breakStartTime: "02:00", breakEndTime: "03:00", departureTime: "07:00" }));
  input.entries = [punch("2026-07-31", "22:00"), punch("2026-08-01", "02:00"), punch("2026-08-01", "03:00"), punch("2026-08-01", "07:00")];
  const row = buildSheet(input).rows.find(row => row.date === "2026-07-31")!;
  assert.equal(row.workedMinutes, 480); assert.equal(row.balanceMinutes, 0); assert.equal(row.punches.filter(p => p.nextDay).length, 3);
});
test("timestamp divergente, futuro ou minuto duplicado exige conferência", () => {
  for (const entries of [
    [punch("2026-10-19", "08:00", { timestamp: "2026-10-19T08:00:00Z" }), punch("2026-10-19", "17:00")],
    [punch("2026-10-26", "08:00"), punch("2026-10-26", "17:00")],
    [punch("2026-10-19", "08:00"), punch("2026-10-19", "08:00", { id: "other" })],
  ]) assert.ok(buildSheet({ ...base(), entries }).rows.some(row => row.status === "Inconsistente" && row.balanceMinutes === null));
});
test("justificativa parcial impede saldo automático e a tolerância diária limita pequenas diferenças", () => {
  const input = base(); input.entries = ["08:00", "12:00", "13:00", "17:57"].map(time => punch("2026-10-19", time));
  assert.equal(buildSheet(input).rows.find(row => row.date === "2026-10-19")!.balanceMinutes, 0);
  input.absences = [{ start: "2026-10-19", end: "2026-10-19", label: "Parcial", partial: true }];
  assert.equal(buildSheet(input).rows.find(row => row.date === "2026-10-19")!.balanceMinutes, null);
});
test("períodos inválidos são rejeitados e datas usam Brasília sem perder o último dia", () => {
  for (const range of [{ start: "2026-02-30", end: "2026-03-01" }, { start: "2026-10-20", end: "2026-10-01" }, { start: "2026-01-01", end: "2026-10-01" }]) assert.equal(entryFilters.safeParse(range).success, false);
  assert.equal(localToday(new Date("2026-10-23T01:00:00Z")), "2026-10-22");
  assert.equal(sheetFilters.safeParse({ employeeId: "cm12345678901234567890123", month: "2026-13" }).success, false);
  assert.equal(buildSheet({ ...base(), month: "2024-02" }).rows.length, 29);
});
test("escopo de consulta limita gestor à equipe e funcionário à própria identidade, inclusive sem vínculo", () => {
  assert.deepEqual(employeeScope({ id: "user", role: "MASTER", employeeId: null }), {});
  assert.deepEqual(employeeScope({ id: "user", role: "GESTOR", employeeId: "manager" }), { managerId: "manager" });
  assert.deepEqual(employeeScope({ id: "user", role: "FUNCIONARIO", employeeId: "own" }), { id: "own" });
  assert.notDeepEqual(employeeScope({ id: "user", role: "GESTOR", employeeId: null }), {});
  assert.notDeepEqual(employeeScope({ id: "user", role: "FUNCIONARIO", employeeId: null }), {});
});
test("CSV preserva aspas e acentos e neutraliza fórmulas em nomes ou matrículas", () => {
  const csv = csvContent([["José; Silva", '=HYPERLINK("x")', "@SUM(1)", " +1", "normal"]]);
  assert.ok(csv.startsWith("\uFEFF")); assert.ok(csv.includes('"José; Silva"')); assert.ok(csv.includes('"\'=HYPERLINK(""x"")"')); assert.ok(csv.includes('"\'@SUM(1)"')); assert.ok(csv.includes('"\' +1"'));
});
