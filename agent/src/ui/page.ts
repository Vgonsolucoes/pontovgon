/**
 * Tela local "VGON PONTO Agent — Configurações".
 * HTML autocontido (CSS/JS inline, sem build de frontend) servido em 127.0.0.1.
 */
export function renderConfigPage(token: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>VGON PONTO Agent — Configurações</title>
<style>
  :root { --blue:#1d4ed8; --bg:#f1f5f9; --card:#ffffff; --text:#0f172a; --muted:#64748b; --ok:#16a34a; --err:#dc2626; --warn:#d97706; }
  * { box-sizing:border-box; }
  body { margin:0; font-family:"Segoe UI", system-ui, sans-serif; background:var(--bg); color:var(--text); }
  header { background:var(--blue); color:#fff; padding:14px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; }
  header h1 { font-size:18px; margin:0; font-weight:600; }
  header .badge { background:rgba(255,255,255,.18); padding:4px 10px; border-radius:999px; font-size:12px; }
  main { max-width:980px; margin:24px auto; padding:0 16px 48px; display:grid; gap:16px; }
  .card { background:var(--card); border:1px solid #e2e8f0; border-radius:12px; padding:18px 20px; box-shadow:0 1px 2px rgba(15,23,42,.04); }
  .card h2 { margin:0 0 12px; font-size:15px; display:flex; align-items:center; gap:8px; }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  @media (max-width:720px){ .grid2,.grid3 { grid-template-columns:1fr; } }
  label { display:block; font-size:12px; color:var(--muted); margin-bottom:4px; }
  input, select { width:100%; padding:8px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:13px; background:#fff; }
  input:focus, select:focus { outline:2px solid var(--blue); outline-offset:-1px; }
  .row { margin-bottom:12px; }
  .btns { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
  button { border:0; border-radius:8px; padding:9px 14px; font-size:13px; font-weight:600; cursor:pointer; background:var(--blue); color:#fff; }
  button.ghost { background:#e2e8f0; color:var(--text); }
  button.danger { background:var(--err); }
  button:disabled { opacity:.5; cursor:not-allowed; }
  .kv { display:grid; grid-template-columns:auto 1fr; gap:6px 16px; font-size:13px; }
  .kv dt { color:var(--muted); } .kv dd { margin:0; font-family:Consolas,monospace; }
  .pill { display:inline-block; padding:2px 10px; border-radius:999px; font-size:12px; font-weight:700; }
  .pill.ok { background:#dcfce7; color:var(--ok); } .pill.err { background:#fee2e2; color:var(--err); } .pill.warn { background:#fef3c7; color:var(--warn); }
  #console { background:#0f172a; color:#e2e8f0; border-radius:10px; padding:14px; font-family:Consolas,monospace; font-size:12px; white-space:pre-wrap; max-height:280px; overflow:auto; margin:0; }
  .hint { font-size:12px; color:var(--muted); margin-top:6px; }
  .check { display:flex; align-items:center; gap:8px; } .check input { width:auto; }
</style>
</head>
<body>
<header>
  <h1>VGON PONTO Agent — Configurações</h1>
  <span class="badge" id="hdrBadge">carregando…</span>
</header>
<main>
  <section class="card">
    <h2>Status</h2>
    <dl class="kv">
      <dt>Serviço Windows</dt><dd id="stService">—</dd>
      <dt>Modo desta tela</dt><dd id="stMode">—</dd>
      <dt>Versão do Agent</dt><dd id="stVersion">—</dd>
      <dt>Eventos pendentes</dt><dd id="stPending">—</dd>
      <dt>Última captura</dt><dd id="stLast">—</dd>
      <dt>Arquivo de config</dt><dd id="stPath">—</dd>
    </dl>
  </section>

  <section class="card">
    <h2>Equipamento — Control iD iDFace</h2>
    <div class="grid2">
      <div class="row"><label>URL do iDFace (LAN)</label><input id="f_url" placeholder="http://192.168.1.150" /></div>
      <div class="row"><label>Porta</label><input id="f_port" type="number" min="1" max="65535" value="80" /></div>
      <div class="row"><label>Usuário</label><input id="f_user" /></div>
      <div class="row"><label>Senha</label><input id="f_pass" type="password" /></div>
      <div class="row"><label>Device ID</label><input id="f_deviceId" /></div>
      <div class="row"><label>Número de Série</label><input id="f_serial" /></div>
    </div>
    <div class="btns">
      <button class="ghost" onclick="testIdface()">Testar iDFace</button>
    </div>
  </section>

  <section class="card">
    <h2>Servidor VGON PONTO (API)</h2>
    <div class="grid2">
      <div class="row"><label>URL da API</label><input id="f_apiUrl" placeholder="https://vgonponto-web.54myeq.easypanel.host" /></div>
      <div class="row"><label>Token do Agent</label><input id="f_token" type="password" /></div>
    </div>
    <div class="btns">
      <button class="ghost" onclick="testServer()">Testar Servidor</button>
    </div>
  </section>

  <section class="card">
    <h2>Avançado</h2>
    <div class="grid3">
      <div class="row"><label>Sync (s)</label><input id="f_sync" type="number" min="5" max="600" /></div>
      <div class="row"><label>Poll comandos (s)</label><input id="f_poll" type="number" min="5" max="600" /></div>
      <div class="row"><label>Heartbeat (s)</label><input id="f_hb" type="number" min="5" max="600" /></div>
      <div class="row"><label>Nível de log</label>
        <select id="f_logLevel"><option>info</option><option>debug</option><option>warn</option><option>error</option><option>trace</option><option>fatal</option></select>
      </div>
      <div class="row"><label>Banco local (SQLite)</label><input id="f_dbPath" /></div>
      <div class="row"><label>&nbsp;</label><span class="check"><input id="f_mock" type="checkbox" /> <label for="f_mock" style="margin:0">Modo MOCK (sem iDFace real)</label></span></div>
    </div>
    <p class="hint">Após salvar, reinicie o serviço para aplicar as alterações.</p>
    <div class="btns">
      <button onclick="saveCfg()">Salvar Configuração</button>
    </div>
  </section>

  <section class="card">
    <h2>Ações</h2>
    <div class="btns">
      <button class="ghost" onclick="syncNow()">Sincronizar Agora</button>
      <button class="ghost" onclick="svc('start')">Iniciar Serviço</button>
      <button class="ghost" onclick="svc('restart')">Reiniciar Serviço</button>
      <button class="danger" onclick="svc('stop')">Parar Serviço</button>
      <button class="ghost" onclick="showLogs()">Ver Logs</button>
    </div>
  </section>

  <section class="card">
    <h2>Console</h2>
    <pre id="console">Pronto.</pre>
  </section>
</main>
<script>
var TOKEN = ${JSON.stringify(token)};
function api(path, opts) {
  opts = opts || {};
  opts.headers = Object.assign({ "x-ui-token": TOKEN, "Content-Type": "application/json" }, opts.headers || {});
  return fetch(path, opts).then(function (r) { return r.json().catch(function () { return { ok: false, error: "resposta não-JSON (HTTP " + r.status + ")" }; }); });
}
function say(msg) {
  var el = document.getElementById("console");
  el.textContent = "[" + new Date().toLocaleTimeString("pt-BR") + "] " + (typeof msg === "string" ? msg : JSON.stringify(msg, null, 2)) + "\\n\\n" + el.textContent;
}
function v(id) { return document.getElementById(id).value; }
function setV(id, val) { document.getElementById(id).value = (val === undefined || val === null) ? "" : val; }

function collectConfig() {
  return {
    apiUrl: v("f_apiUrl").trim(),
    agentToken: v("f_token").trim(),
    syncIntervalSec: Number(v("f_sync")) || 30,
    pollCommandsIntervalSec: Number(v("f_poll")) || 30,
    heartbeatIntervalSec: Number(v("f_hb")) || 30,
    mock: document.getElementById("f_mock").checked,
    dbPath: v("f_dbPath").trim() || "./data/agent.db",
    logLevel: v("f_logLevel") || "info",
    idface: {
      url: v("f_url").trim(),
      port: Number(v("f_port")) || 80,
      user: v("f_user").trim() || "admin",
      password: v("f_pass"),
      deviceId: v("f_deviceId").trim(),
      deviceSerialNumber: v("f_serial").trim() || undefined,
      readEventsBatchSize: 500,
      readEventsFromMinutesAgo: 1440
    }
  };
}

function loadStatus() {
  api("/api/status").then(function (s) {
    if (!s.ok) { say(s); return; }
    var svc = s.service.installed ? s.service.state : "NÃO INSTALADO";
    var el = document.getElementById("stService");
    var running = svc === "RUNNING";
    el.innerHTML = '<span class="pill ' + (running ? "ok" : "err") + '">' + svc + "</span>";
    document.getElementById("hdrBadge").textContent = running ? "Serviço ativo" : "Serviço " + svc.toLowerCase();
    document.getElementById("stMode").textContent = s.mode === "embedded" ? "Dentro do serviço" : "Launcher (serviço parado)";
    document.getElementById("stVersion").textContent = s.version;
    var rt = s.runtime;
    document.getElementById("stPending").textContent = rt && rt.pendingEvents !== undefined ? String(rt.pendingEvents) : "—";
    document.getElementById("stLast").textContent = rt && rt.lastCaptureIso ? rt.lastCaptureIso : "—";
    document.getElementById("stPath").textContent = s.paths.config;
  });
}

function loadCfg() {
  api("/api/config").then(function (r) {
    if (!r.ok) { say(r); return; }
    var c = r.config;
    if (!c) { say("Config ainda não criada ou inválida: " + (r.error || "")); return; }
    setV("f_apiUrl", c.apiUrl); setV("f_token", c.agentToken);
    setV("f_sync", c.syncIntervalSec); setV("f_poll", c.pollCommandsIntervalSec); setV("f_hb", c.heartbeatIntervalSec);
    setV("f_dbPath", c.dbPath); setV("f_logLevel", c.logLevel);
    document.getElementById("f_mock").checked = !!c.mock;
    setV("f_url", c.idface.url); setV("f_port", c.idface.port);
    setV("f_user", c.idface.user); setV("f_pass", c.idface.password);
    setV("f_deviceId", c.idface.deviceId); setV("f_serial", c.idface.deviceSerialNumber);
  });
}

function saveCfg() {
  api("/api/config", { method: "POST", body: JSON.stringify({ config: collectConfig() }) }).then(function (r) {
    if (r.ok) { say("Configuração salva em " + r.path + "\\nReinicie o serviço para aplicar."); }
    else { say(r); }
  });
}
function testIdface() {
  say("Testando iDFace em " + v("f_url") + " …");
  api("/api/test/idface", { method: "POST", body: JSON.stringify({ config: collectConfig() }) }).then(function (r) { say(r); });
}
function testServer() {
  say("Testando API " + v("f_apiUrl") + " …");
  api("/api/test/server", { method: "POST", body: JSON.stringify({ config: collectConfig() }) }).then(function (r) { say(r); });
}
function syncNow() {
  say("Solicitando sincronização imediata…");
  api("/api/sync-now", { method: "POST", body: "{}" }).then(function (r) { say(r); loadStatus(); });
}
function svc(op) {
  var label = { start: "Iniciando", stop: "Parando", restart: "Reiniciando" }[op] || op;
  say(label + " serviço " + "VgonPontoAgent …");
  api("/api/service", { method: "POST", body: JSON.stringify({ op: op }) }).then(function (r) {
    say(r);
    setTimeout(loadStatus, 3000);
  });
}
function showLogs() {
  api("/api/logs?tail=120").then(function (r) {
    if (!r.ok) { say(r); return; }
    if (!r.lines || !r.lines.length) { say("Nenhum log encontrado (o serviço já foi executado?)"); return; }
    say("— " + r.file + " (últimas " + r.lines.length + " linhas) —\\n" + r.lines.join("\\n"));
  });
}

loadStatus();
loadCfg();
setInterval(loadStatus, 15000);
</script>
</body>
</html>`;
}
