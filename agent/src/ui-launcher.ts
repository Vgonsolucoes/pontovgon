/**
 * VGON PONTO Agent — Launcher da tela de Configurações (atalho do Windows).
 *
 * Fluxo:
 *  1. Se o serviço está rodando (UI embedded na porta 3737), só abre o navegador.
 *  2. Se não, sobe a UI em modo standalone (permite configurar e INICIAR o serviço).
 *  3. Sem permissão de leitura do token (ACL do ProgramData), relança elevado (UAC).
 */
import http from "node:http";
import { exec, spawn } from "node:child_process";
import { once } from "node:events";
import { getUiToken } from "./config";
import { startUiServer, UI_PORT } from "./ui/server";

function ping(port: number, token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        host: "127.0.0.1",
        port,
        path: "/api/ping",
        method: "GET",
        headers: { "x-ui-token": token },
        timeout: 1500,
      },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}

function openBrowser(url: string) {
  exec(`start "" "${url}"`, { windowsHide: true });
}

/** Relança este launcher elevado (UAC) e encerra o processo atual. */
function relaunchElevated(): never {
  const scriptPath = process.argv[1] ?? "";
  const quote = (s: string) => "'" + s.replace(/'/g, "''") + "'";
  const ps = `Start-Process -FilePath ${quote(process.execPath)} -ArgumentList ${quote('"' + scriptPath + '" --elevated')} -Verb RunAs -WindowStyle Hidden`;
  spawn("powershell.exe", ["-NoProfile", "-Command", ps], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  }).unref();
  process.exit(0);
}

async function main() {
  let token: string;
  try {
    token = getUiToken();
  } catch (e) {
    // Sem permissão na pasta do ProgramData (ACL restrita a Admins/SYSTEM)
    if (["EACCES", "EPERM"].includes((e as NodeJS.ErrnoException).code ?? "") && !process.argv.includes("--elevated")) relaunchElevated();
    throw e;
  }

  const url = `http://127.0.0.1:${UI_PORT}/?token=${encodeURIComponent(token)}`;

  if (await ping(UI_PORT, token)) {
    openBrowser(url);
    return;
  }

  const server = startUiServer({
    mode: "standalone",
    getRuntimeStatus: () => null,
    syncNow: () => Promise.reject(new Error("Serviço parado — inicie o serviço para sincronizar")),
  });

  try { await once(server, "listening"); }
  catch (e) {
    // Another launcher/service may have bound the port while we were starting.
    for (let n = 0; n < 10; n++) {
      if (await ping(UI_PORT, token)) { openBrowser(url); return; }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw e;
  }
  openBrowser(url);
  console.log(`VGON PONTO Agent — Configurações (modo standalone) em http://127.0.0.1:${UI_PORT}`);
  console.log("O serviço está parado: configure e use 'Iniciar Serviço' na tela.");
}

void main().catch(e => { console.error("Não foi possível abrir a configuração do Agent:", e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
