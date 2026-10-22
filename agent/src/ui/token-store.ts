import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** Publish a fully written token atomically; concurrent launchers never replace it. */
export function loadOrCreateUiToken(tokenPath: string): string {
  function read() {
    const token = fs.readFileSync(tokenPath, "utf8").trim();
    if (!/^[a-f0-9]{48}$/i.test(token)) throw new Error("Arquivo ui-token inválido; verifique a instalação como administrador.");
    return token;
  }
  try { return read(); }
  catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
  const temp = `${tokenPath}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`;
  fs.writeFileSync(temp, randomBytes(24).toString("hex"), { flag: "wx", mode: 0o600 });
  try {
    try { fs.linkSync(temp, tokenPath); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
    return read();
  } finally { fs.unlinkSync(temp); }
}
