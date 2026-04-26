#!/usr/bin/env node
/**
 * Verifies client `src/platform/ui/components` matches monolith sources after transforms.
 * Exit 1 on first mismatch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  EXTRA_COMPONENT_TOP_LEVEL_DIRS,
  transformMonolithSource,
} from "./platform-ui-monolith-transform.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_ROOT = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CLIENT_ROOT, "..");
const UI_KITS = path.join(REPO_ROOT, "src", "components", "ui-kits");
const COMPONENTS = path.join(REPO_ROOT, "src", "components");
const TARGET = path.join(CLIENT_ROOT, "src", "platform", "ui", "components");

function normalizeEol(s) {
  return s.replace(/\r\n/g, "\n");
}

function walkFiles(root, pred) {
  /** @type {string[]} */
  const out = [];
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (pred(p)) out.push(p);
    }
  }
  walk(root);
  return out;
}

let checked = 0;

/**
 * @param {string} monolithAbs
 * @param {string} monolithRel posix from src/components/
 * @param {string} targetAbs
 */
function compareOne(monolithAbs, monolithRel, targetAbs) {
  if (!fs.existsSync(targetAbs)) {
    console.error("Missing in client:", path.relative(CLIENT_ROOT, targetAbs));
    process.exit(1);
  }
  const src = normalizeEol(fs.readFileSync(monolithAbs, "utf8"));
  const expected = normalizeEol(transformMonolithSource(src, monolithRel));
  const actual = normalizeEol(fs.readFileSync(targetAbs, "utf8"));
  if (expected !== actual) {
    console.error("Mismatch:", monolithRel);
    console.error("  monolith:", monolithAbs);
    console.error("  client:  ", targetAbs);
    process.exit(1);
  }
  checked += 1;
}

if (!fs.existsSync(UI_KITS)) {
  console.error("Missing monolith ui-kits:", UI_KITS);
  process.exit(1);
}

const kitFiles = walkFiles(
  UI_KITS,
  (p) => p.endsWith(".ts") || p.endsWith(".tsx"),
);
for (const abs of kitFiles) {
  const rel = path.relative(UI_KITS, abs).replace(/\\/g, "/");
  const monolithRel = `ui-kits/${rel}`;
  const targetAbs = path.join(TARGET, rel);
  compareOne(abs, monolithRel, targetAbs);
}

for (const dir of EXTRA_COMPONENT_TOP_LEVEL_DIRS) {
  const root = path.join(COMPONENTS, dir);
  if (!fs.existsSync(root)) continue;
  const files = walkFiles(root, (p) => p.endsWith(".ts") || p.endsWith(".tsx"));
  for (const abs of files) {
    const rel = path.relative(COMPONENTS, abs).replace(/\\/g, "/");
    compareOne(abs, rel, path.join(TARGET, rel));
  }
}

const fu = path.join(COMPONENTS, "file-uploader");
if (fs.existsSync(fu)) {
  const files = walkFiles(fu, (p) => p.endsWith(".ts") || p.endsWith(".tsx"));
  for (const abs of files) {
    const rel = path.relative(COMPONENTS, abs).replace(/\\/g, "/");
    const targetAbs = path.join(TARGET, rel);
    compareOne(abs, rel, targetAbs);
  }
}

const SYNC_PRESERVES = path.join(CLIENT_ROOT, "src", "platform", "ui", "sync-preserves", "components");
if (fs.existsSync(SYNC_PRESERVES)) {
  const preserved = walkFiles(
    SYNC_PRESERVES,
    (p) => p.endsWith(".ts") || p.endsWith(".tsx"),
  );
  for (const abs of preserved) {
    const rel = path.relative(SYNC_PRESERVES, abs).replace(/\\/g, "/");
    const targetAbs = path.join(TARGET, rel);
    if (!fs.existsSync(targetAbs)) {
      console.error("Missing merged preserve:", path.relative(CLIENT_ROOT, targetAbs));
      process.exit(1);
    }
    const exp = normalizeEol(fs.readFileSync(abs, "utf8"));
    const act = normalizeEol(fs.readFileSync(targetAbs, "utf8"));
    if (exp !== act) {
      console.error("Mismatch vs sync-preserves:", rel, "(run npm run sync:ui)");
      process.exit(1);
    }
    checked += 1;
  }
}

console.log(`verify-platform-ui: OK (${checked} files)`);
