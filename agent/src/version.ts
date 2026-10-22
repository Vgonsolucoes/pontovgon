import fs from "node:fs";
import path from "node:path";

export const AGENT_VERSION: string = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
).version;
