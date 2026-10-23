import { test } from "node:test";
import assert from "node:assert/strict";
import { deviceInput, holidayInput } from "../server/lib/catalog-input";
test("cadastro de dispositivos não aceita credenciais, vínculos ou estado online injetados", () => {
  const value = { name: "Equipamento isolado", serialNumber: "ISOLATED", deviceUniqueId: "ISOLATED", manufacturer: "Control iD", model: "iDFace", location: "", enabled: true };
  assert.equal(deviceInput.safeParse(value).success,true);
  for (const patch of [{ config: { password: "invalid" } }, { agentId: "other" }, { status: "ONLINE" }, { serialNumber: "" }]) assert.equal(deviceInput.safeParse({ ...value, ...patch }).success,false);
});
test("feriados validam datas e IDs importados e preservam a escolha de não repetir datas móveis", () => {
  const value = { id: "cmholiday2026202603270000", description: "Jubileu de Nossa Senhora das Dores", date: "2026-03-27", scope: "MUNICIPAL", recurring: false, active: true };
  assert.equal(holidayInput.safeParse(value).success,true);
  assert.equal(holidayInput.safeParse({ ...value, date: "2026-02-30" }).success,false);
  assert.equal(holidayInput.safeParse({ ...value, scope: "FACULTATIVO" }).success,false);
});
