import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleInput, scheduleLoads } from "../server/lib/work-schedules";
const week = () => Array.from({ length: 7 }, (_, weekday) => ({ weekday, isDayOff: weekday === 0 || weekday === 6, entryTime: "08:00", breakStartTime: "12:00", breakEndTime: "13:00", departureTime: "17:00" }));
const input = () => ({ name: "Semana", model: "CINCOXDOIS", toleranceMinutes: 5, active: true, observations: "", days: week() });
test("jornada calcula carga líquida e limpa horários das folgas", () => {
  const result = scheduleInput.parse(input());
  assert.deepEqual(scheduleLoads(result.days), { dailyLoadMinutes: 480, weeklyLoadMinutes: 2400 });
  assert.equal(result.days[0].entryTime, null);
});
test("turno noturno e intervalo depois da meia-noite", () => {
  const value = input();
  value.days = value.days.map(day => ({ ...day, entryTime: "22:00", breakStartTime: "02:00", breakEndTime: "03:00", departureTime: "07:00" }));
  assert.equal(scheduleLoads(scheduleInput.parse(value).days).weeklyLoadMinutes, 2400);
});
test("rejeita intervalo invertido, parcial, externo e turno vazio", () => {
  for (const patch of [{ breakEndTime: "11:00" }, { breakEndTime: null }, { breakEndTime: "18:00" }, { departureTime: "08:00" }, { entryTime: "25:00" }]) {
    const value = input(); Object.assign(value.days[1], patch);
    assert.equal(scheduleInput.safeParse(value).success, false);
  }
});
test("rejeita semana incompleta, dias duplicados e modelo incoerente", () => {
  const value = input(); value.days[0].weekday = 1;
  assert.equal(scheduleInput.safeParse(value).success, false);
  assert.equal(scheduleInput.safeParse({ ...input(), days: week().slice(1) }).success, false);
  assert.equal(scheduleInput.safeParse({ ...input(), model: "SEISXUM" }).success, false);
  assert.equal(scheduleInput.safeParse({ ...input(), model: "DOZEXTRINTASEIS" }).success, false);
});
test("rejeita sobreposição entre turno noturno e dia seguinte inclusive domingo", () => {
  const value = input(); value.model = "PERSONALIZADA";
  Object.assign(value.days[6], { isDayOff: false, entryTime: "22:00", departureTime: "09:00", breakStartTime: null, breakEndTime: null });
  Object.assign(value.days[0], { isDayOff: false });
  assert.equal(scheduleInput.safeParse(value).success, false);
});
