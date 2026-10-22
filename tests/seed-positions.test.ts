import { test } from "node:test";
import assert from "node:assert/strict";
import { ensureSeedPosition } from "../prisma/seed-positions";

test("cargo sem setor usa null em filtro comum e não usa upsert composto", async () => {
  let created = 0;
  const store = {
    async findFirst(args: unknown) { assert.deepEqual(args, { where: { name: "Cargo de teste", departmentId: null } }); return null; },
    async create(args: unknown) { assert.deepEqual(args, { data: { name: "Cargo de teste", departmentId: null, active: true } }); created++; },
    async upsert() { assert.fail("Não pode usar chave composta sem setor"); },
  };
  await ensureSeedPosition(store, "Cargo de teste");
  assert.equal(created, 1);
});
test("cargo sem setor existente permanece intacto em reexecuções", async () => {
  const store = {
    async findFirst() { return { id: "existing" }; },
    async create() { assert.fail("Não deve duplicar"); },
    async upsert() { assert.fail("Não deve atualizar"); },
  };
  await ensureSeedPosition(store, "Cargo de teste");
  await ensureSeedPosition(store, "Cargo de teste");
});
test("cargo com setor utiliza chave composta string e preserva registro existente", async () => {
  const store = {
    async findFirst() { assert.fail("Não precisa consultar filtro nullable"); },
    async create() { assert.fail("Deve usar upsert"); },
    async upsert(args: unknown) { assert.deepEqual(args, { where: { name_departmentId: { name: "Cargo de teste", departmentId: "department" } }, create: { name: "Cargo de teste", departmentId: "department", active: true }, update: {} }); },
  };
  await ensureSeedPosition(store, "Cargo de teste", "department");
});
