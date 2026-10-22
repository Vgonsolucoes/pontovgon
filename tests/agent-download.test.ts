import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

test("published installer matches manifest, package version, PE header and SHA-256", () => {
  const root = path.join(process.cwd(), "public", "downloads");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "agent-manifest.json"), "utf8"));
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), "agent", "package.json"), "utf8"));
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.fileName, `VGON-PONTO-Agent-Setup-${pkg.version}.exe`);
  assert.equal(manifest.arch, "windows-x64");
  assert.ok(Number.isFinite(Date.parse(manifest.builtAt)));
  const bytes = fs.readFileSync(path.join(root, manifest.fileName));
  assert.equal(bytes.length, manifest.sizeBytes);
  assert.equal(bytes.toString("ascii", 0, 2), "MZ");
  assert.equal(bytes.toString("ascii", bytes.readUInt32LE(0x3c), bytes.readUInt32LE(0x3c) + 4), "PE\0\0");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), manifest.sha256);
  assert.ok(fs.readFileSync(path.join(root, "SHA256SUMS.txt"), "utf8").includes(`${manifest.sha256}  ${manifest.fileName}`));
});
