// Isolated in-memory PostgreSQL. Never reads DATABASE_URL or production credentials.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { refreshBalances } from '../server/lib/hour-bank.ts';
const { PGlite } = await import(new URL('../agent/installer/Output/attendance-db-tests/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url).href);
const db = new PGlite();
after(async () => db.close());
await db.exec(await readFile(new URL('../prisma/migrations/0000_init/migration.sql', import.meta.url), 'utf8'));
await db.exec(`INSERT INTO employees(id,name,cpf,registration,"updatedAt") VALUES ('isolated-employee','Teste somente em memória','ISOLATED-NOT-A-PERSON','ISOLATED',now());
INSERT INTO devices(id,name,"serialNumber","updatedAt") VALUES ('isolated-device','Equipamento isolado','ISOLATED',now());
INSERT INTO time_entries(id,"employeeId","deviceId","externalEventId",date,time) VALUES ('original','isolated-employee','isolated-device','event-1','2026-10-19','08:00');`);
await db.exec(await readFile(new URL('../prisma/migrations/202610230001_attendance_controls/migration.sql', import.meta.url), 'utf8'));
const catalogMigration = await readFile(new URL('../prisma/migrations/202610230002_devices_holidays/migration.sql', import.meta.url), 'utf8');
await db.exec(catalogMigration);
test('calendário oficial importa doze feriados sem facultativos e não duplica na repetição', async () => {
  const rows = (await db.query('SELECT id,date::text,scope,recurring,active FROM holidays ORDER BY date')).rows;
  assert.equal(rows.length,12); assert.equal(rows.filter(row => row.scope === 'NACIONAL').length,9); assert.equal(rows.filter(row => row.scope === 'MUNICIPAL').length,3);
  assert.ok(rows.every(row => row.active && !row.recurring));
  for (const date of ['2026-02-16','2026-02-17','2026-08-30','2026-12-24','2026-12-31']) assert.ok(!rows.some(row => row.date === date));
  for (const date of ['2026-03-27','2026-04-03','2026-06-04']) assert.ok(rows.some(row => row.date === date && row.scope === 'MUNICIPAL'));
  const insert = catalogMigration.slice(catalogMigration.indexOf('INSERT INTO'), catalogMigration.indexOf('UPDATE "hour_bank"'));
  await db.exec(insert);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM holidays')).rows[0].count,12);
  assert.equal((await db.query(`SELECT enabled FROM devices WHERE id='isolated-device'`)).rows[0].enabled,true);
});
test('migração preserva evento anterior e mantém unicidade do identificador original', async () => {
  const { rows } = await db.query(`SELECT time,"reviewFlags" FROM time_entries WHERE id='original'`);
  assert.equal(rows[0].time,'08:00'); assert.deepEqual(rows[0].reviewFlags,[]);
  await db.exec(`INSERT INTO time_entries(id,"employeeId","deviceId","externalEventId",date,time,"reviewFlags","duplicateOfId",status) VALUES ('repeated','isolated-employee','isolated-device','event-2','2026-10-19','08:00',ARRAY['DUPLICATE'],'original','INCONSISTENTE')`);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM time_entries')).rows[0].count,2);
  await assert.rejects(db.exec(`INSERT INTO time_entries(id,"deviceId","externalEventId",date,time) VALUES ('wrong','isolated-device','event-1','2026-10-19','09:00')`), error => error.code === '23505');
});
test('configuração usa janela de 30 minutos e rejeita limites inválidos no PostgreSQL', async () => {
  await db.exec(`INSERT INTO attendance_settings(id,"updatedAt") VALUES ('default',now())`);
  const policy = (await db.query('SELECT * FROM attendance_settings')).rows[0];
  assert.equal(policy.windowEnabled,true); assert.equal(policy.minutesBefore,30); assert.equal(policy.minutesAfter,30);
  await assert.rejects(db.exec(`UPDATE attendance_settings SET "duplicateMinutes"=-1`),error => error.code === '23514');
});
test('chave diária evita duplicar apuração e saldo é recomposto pelo SQL utilizado em produção', async () => {
  const insert = `INSERT INTO hour_bank(id,"employeeId",date,"deltaMinutes","balanceMinutes",origin,"calculationKey") VALUES ('calc','isolated-employee','2026-10-19',60,0,'DAILY_CALC','daily:isolated:2026-10-19') ON CONFLICT ("calculationKey") DO UPDATE SET "deltaMinutes"=EXCLUDED."deltaMinutes"`;
  await db.exec(insert); await db.exec(insert);
  assert.equal((await db.query('SELECT count(*)::int AS count FROM hour_bank')).rows[0].count,1);
  await db.exec(`INSERT INTO hour_bank(id,"employeeId",date,"deltaMinutes","balanceMinutes",origin) VALUES ('manual','isolated-employee','2026-10-20',-30,999,'MANUAL_ADJUST')`);
  const adapter = { async $executeRaw(parts,...values) { const sql = parts.reduce((text,part,index) => text + (index ? '$'+index : '') + part,''); return (await db.query(sql,values)).affectedRows; } };
  await refreshBalances(adapter,'isolated-employee');
  assert.deepEqual((await db.query('SELECT "balanceMinutes" AS balance FROM hour_bank ORDER BY date,id')).rows.map(row => row.balance),[60,30]);
  await db.exec(`UPDATE hour_bank SET "deltaMinutes"=120 WHERE id='calc'`);
  await refreshBalances(adapter,'isolated-employee');
  assert.deepEqual((await db.query('SELECT "balanceMinutes" AS balance FROM hour_bank ORDER BY date,id')).rows.map(row => row.balance),[120,90]);
});
test('estorno só pode referenciar o original uma vez e transação falha preserva a batida', async () => {
  await db.exec(`INSERT INTO hour_bank(id,"employeeId",date,"deltaMinutes","balanceMinutes",origin,"reversalOfId") VALUES ('reversal','isolated-employee','2026-10-21',30,0,'REVERSAL','manual')`);
  await assert.rejects(db.exec(`INSERT INTO hour_bank(id,"employeeId",date,"deltaMinutes","balanceMinutes",origin,"reversalOfId") VALUES ('again','isolated-employee','2026-10-21',30,0,'REVERSAL','manual')`), error => error.code === '23505');
  await db.exec('BEGIN');
  await db.exec(`UPDATE time_entries SET status='EXCLUIDO_LOGICAMENTE' WHERE id='original'`);
  await assert.rejects(db.exec(`INSERT INTO time_entries(id,date,time) VALUES ('original','2026-10-19','09:00')`));
  await db.exec('ROLLBACK');
  assert.equal((await db.query(`SELECT status FROM time_entries WHERE id='original'`)).rows[0].status,'VALIDO');
});
