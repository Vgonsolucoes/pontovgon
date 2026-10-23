const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const app = path.resolve(process.argv[2]);
const load = createRequire(path.join(app, 'package.json'));
const Database = load('better-sqlite3');
const db = new Database(':memory:');
try {
  db.exec('CREATE TABLE installer_check (value INTEGER)');
  db.prepare('INSERT INTO installer_check VALUES (?)').run(42);
  assert.equal(db.prepare('SELECT value FROM installer_check').get().value, 42);
} finally { db.close(); }
assert.equal(typeof load('./dist/ui/server.js').startUiServer, 'function');
assert.equal(typeof load('./dist/services/ControlIdService.js').ControlIdService, 'function');
assert.equal(typeof load('./dist/services/enrollment.js').enrollEmployee, 'function');
assert.equal(typeof load('./dist/index.js').AgentRuntime, 'function');
assert.equal(load('./dist/version.js').AGENT_VERSION, load('./package.json').version);
console.log('Installer smoke test passed: embedded Node, native SQLite, UI and device client.');
