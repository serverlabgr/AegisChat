#!/usr/bin/env node
/**
 * Bump app version in package.json, tauri.conf.json, Cargo.toml
 * Usage: node scripts/bump-version.mjs 0.1.1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Usage: node scripts/bump-version.mjs X.Y.Z");
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const pkgPath = join(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

const tauriPath = join(root, "src-tauri", "tauri.conf.json");
const tauri = JSON.parse(readFileSync(tauriPath, "utf8"));
tauri.version = version;
writeFileSync(tauriPath, JSON.stringify(tauri, null, 2) + "\n");

const cargoPath = join(root, "src-tauri", "Cargo.toml");
let cargo = readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version\s*=\s*"[^"]+"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

console.log(`version -> ${version}`);
console.log("Next:");
console.log(`  git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml`);
console.log(`  git commit -m "release: v${version}"`);
console.log(`  git tag v${version} && git push origin HEAD v${version}`);
