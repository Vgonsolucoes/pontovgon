import { test } from "node:test";
import assert from "node:assert/strict";
import { employeeInput, userInput, userWriteError, validCpf, type PeopleActor } from "../server/lib/people";

const employee = { name: "Pessoa de teste isolado", cpf: "529.982.247-25", registration: "ISOLATED-001" };
const user = { name: "Conta de teste isolado", email: " TEST@EXAMPLE.INVALID ", password: "test-only-password", role: "FUNCIONARIO" };
test("employee registration validates CPF and calendar dates, normalizes optional fields", () => {
  const parsed = employeeInput.parse(employee);
  assert.equal(parsed.cpf, "52998224725");
  assert.equal(parsed.status, "ATIVO");
  assert.equal(parsed.departmentId, null);
  assert.equal(parsed.externalIdDevice, null);
  for (const cpf of ["11111111111", "52998224726", "", "123", "52998224725abc"]) assert.equal(employeeInput.safeParse({ ...employee, cpf }).success, false);
  for (const date of ["2026-02-30", "2026-13-01", "yesterday"]) assert.equal(employeeInput.safeParse({ ...employee, admissionDate: date }).success, false);
  assert.equal(employeeInput.safeParse({ ...employee, admissionDate: "2024-02-29" }).success, true);
  assert.equal(employeeInput.safeParse({ ...employee, registration: " " }).success, false);
  assert.equal(validCpf("52998224725"), true);
});
test("user registration requires a password only on creation and rejects bcrypt truncation", () => {
  assert.equal(userInput.parse(user).email, "test@example.invalid");
  assert.equal(userInput.safeParse({ ...user, password: "" }).success, false);
  assert.equal(userInput.safeParse({ ...user, password: "1234567" }).success, false);
  assert.equal(userInput.safeParse({ ...user, password: "á".repeat(37) }).success, false);
  assert.equal(userInput.safeParse({ ...user, id: "cm12345678901234567890123", password: "" }).success, true);
  assert.equal(userInput.safeParse({ ...user, passwordHash: "injected" }).success, false);
  assert.equal(employeeInput.safeParse({ ...employee, deletedAt: new Date().toISOString() }).success, false);
});
test("administrative permissions prevent escalation, self lockout and loss of the active Master", () => {
  const admin: PeopleActor = { id: "admin", role: "ADMIN", employeeId: null };
  const master: PeopleActor = { id: "master", role: "MASTER", employeeId: null };
  for (const role of ["MASTER", "ADMIN"]) assert.ok(userWriteError(admin, null, { role, active: true }));
  assert.ok(userWriteError(admin, { id: "master", role: "MASTER" }, { role: "RH", active: true }));
  assert.equal(userWriteError(admin, null, { role: "RH", active: true }), null);
  assert.equal(userWriteError(admin, { id: "admin", role: "ADMIN" }, { role: "ADMIN", active: true }), null);
  assert.ok(userWriteError(admin, { id: "admin", role: "ADMIN" }, { role: "ADMIN", active: false }));
  assert.ok(userWriteError(master, { id: "master", role: "MASTER" }, { role: "RH", active: true }));
  assert.ok(userWriteError(master, { id: "master", role: "MASTER" }, { role: "MASTER", active: false }));
  assert.equal(userWriteError(master, null, { role: "ADMIN", active: true }), null);
  for (const role of ["RH", "GESTOR", "FUNCIONARIO"] as const) assert.ok(userWriteError({ ...admin, role }, null, { role: "FUNCIONARIO", active: true }));
});
