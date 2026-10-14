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
  const ps = `Start-Process -FilePath '${process.execPath}' -ArgumentList '"${scriptPath}"' -Verb RunAs`;
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
  } catch {
    // Sem permissão na pasta do ProgramData (ACL restrita a Admins/SYSTEM)
    relaunchElevated();
  }

  const url = `http://127.0.0.1:${UI_PORT}/?token=${token}`;

  if (await ping(UI_PORT, token)) {
    openBrowser(url);
    return;
  }

  startUiServer({
    mode: "standalone",
    getRuntimeStatus: () => null,
    syncNow: () => Promise.reject(new Error("Serviço parado — inicie o serviço para sincronizar")),
  });

  // aguarda a porta abrir antes de abrir o navegador
  setTimeout(() => openBrowser(url), 400);
  console.log(`VGON PONTO Agent — Configurações (modo standalone) em http://127.0.0.1:${UI_PORT}`);
  console.log("O serviço está parado: configure e use 'Iniciar Serviço' na tela.");
}

void main();
