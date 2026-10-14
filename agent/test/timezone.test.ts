/**
 * Testes automatizados de data/hora — America/Sao_Paulo (seção 6 do escopo).
 *
 * Cenários cobertos:
 * - Conversão UTC → horário local do equipamento (iDFace opera em SP).
 * - Fronteiras de dia/mês/ano (meia-noite UTC ≠ meia-noite em SP).
 * - Epoch Unix (segundos) retornado pelos access_logs do iDFace.
 * - Horário de verão histórico (DST vigia até 2019; IANA deve tratar).
 * - Ausência de deslocamento indevido de 3h (dupla conversão).
 * - Determinismo (mesma entrada → mesma saída, sempre).
 *
 * Execução: npm test (Node 20+, via tsx — sem dependências extras).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spParts, SP_TZ } from "../src/services/timezone";

test("SP_TZ é America/Sao_Paulo", () => {
  assert.equal(SP_TZ, "America/Sao_Paulo");
});

test("conversão básica UTC → America/Sao_Paulo (UTC-3)", () => {
  const sp = spParts(new Date("2026-01-15T12:00:00.000Z"));
  assert.equal(sp.date, "2026-01-15");
  assert.equal(sp.time, "09:00");
  assert.equal(sp.hour, 9);
  assert.equal(sp.minute, 0);
});

test("meia-noite UTC ainda é dia anterior em SP (sem virada de data indevida)", () => {
  const antes = spParts(new Date("2026-03-01T02:59:59.000Z"));
  assert.equal(antes.date, "2026-02-28");
  assert.equal(antes.time, "23:59");
  assert.equal(antes.second, 59);
});

test("03:00 UTC vira 00:00 em SP (normalização de hour '24' → 0)", () => {
  const sp = spParts(new Date("2026-03-01T03:00:00.000Z"));
  assert.equal(sp.date, "2026-03-01");
  assert.equal(sp.time, "00:00");
  assert.equal(sp.hour, 0);
});

test("virada de ano: 00:00 UTC de 01/jan ainda é 31/dez em SP", () => {
  const sp = spParts(new Date("2027-01-01T00:00:00.000Z"));
  assert.equal(sp.date, "2026-12-31");
  assert.equal(sp.time, "21:00");
  assert.equal(sp.year, 2026);
  assert.equal(sp.month, 12);
  assert.equal(sp.day, 31);
});

test("epoch Unix em SEGUNDOS (formato dos access_logs do iDFace) converte corretamente", () => {
  // 2026-10-14T15:30:00.000Z ≡ 12:30 em America/Sao_Paulo.
  const epochSec = Math.floor(Date.UTC(2026, 9, 14, 15, 30, 0) / 1000);
  const sp = spParts(new Date(epochSec * 1000));
  assert.equal(sp.date, "2026-10-14");
  assert.equal(sp.time, "12:30");
});

test("horário de verão histórico (2018, UTC-2) é respeitado pela base IANA", () => {
  // Em 15/11/2018 vigia horário de verão (UTC-2). 12:00 UTC ≡ 10:00 local.
  const sp = spParts(new Date("2018-11-15T12:00:00.000Z"));
  assert.equal(sp.date, "2018-11-15");
  assert.equal(sp.time, "10:00");
});

test("sem deslocamento indevido de 3h: ISO com offset -03:00 mantém a hora local", () => {
  // Cenário SET_DEVICE_TIME / parsing de ISO local: 08:00-03:00 deve ser 08:00 em SP.
  const sp = spParts(new Date("2026-06-10T08:00:00-03:00"));
  assert.equal(sp.time, "08:00");
  assert.equal(sp.hour, 8);
});

test("timestamp ISO permanece em UTC (não há dupla conversão no envio)", () => {
  const ts = new Date("2026-10-14T12:30:00-03:00");
  assert.equal(ts.toISOString(), "2026-10-14T15:30:00.000Z");
  // E a conversão para exibição local volta a 12:30.
  assert.equal(spParts(ts).time, "12:30");
});

test("campos numéricos para set_system_time.fcgi (day/month/year/hour/minute/second)", () => {
  const sp = spParts(new Date("2026-06-10T11:05:09.000Z")); // 08:05:09 SP
  assert.deepEqual(
    { day: sp.day, month: sp.month, year: sp.year, hour: sp.hour, minute: sp.minute, second: sp.second },
    { day: 10, month: 6, year: 2026, hour: 8, minute: 5, second: 9 },
  );
});

test("determinismo: mesma entrada produz exatamente a mesma saída", () => {
  const d = new Date("2026-10-14T18:45:30.000Z");
  assert.deepEqual(spParts(d), spParts(new Date(d.getTime())));
});
