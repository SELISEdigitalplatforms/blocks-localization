#!/usr/bin/env node
/**
 * Copy monolith `public/assets` (+ common logos) into `client/public/`
 * so PNGs referenced by auth UI exist when this package is checked out alone.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..");
const monolithPublic = path.resolve(clientRoot, "..", "public");
const clientPublic = path.resolve(clientRoot, "public");

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[sync-public-assets] skip (missing): ${src}`);
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn(`[sync-public-assets] skip (missing dir): ${srcDir}`);
    return;
  }
  fs.cpSync(srcDir, destDir, { recursive: true });
}

copyDir(path.join(monolithPublic, "assets"), path.join(clientPublic, "assets"));

for (const name of ["Logo.svg", "Logo_White.svg", "Favicon-new.svg", "favicon.svg"]) {
  copyIfExists(path.join(monolithPublic, name), path.join(clientPublic, name));
}

console.info("[sync-public-assets] copied monolith public/assets → client/public/assets");
