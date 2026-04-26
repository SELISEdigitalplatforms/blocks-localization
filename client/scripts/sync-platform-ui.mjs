#!/usr/bin/env node
/**
 * Copies monolith `src/components/ui-kits` + allowlisted sibling folders into
 * `client/src/platform/ui/components` and applies import transforms.
 */
import { execSync } from "node:child_process";
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

if (!fs.existsSync(UI_KITS)) {
  console.error("Missing monolith ui-kits:", UI_KITS);
  process.exit(1);
}

fs.rmSync(TARGET, { recursive: true, force: true });
fs.mkdirSync(TARGET, { recursive: true });

execSync(`cp -r "${UI_KITS}/." "${TARGET}/"`);

for (const dir of EXTRA_COMPONENT_TOP_LEVEL_DIRS) {
  const src = path.join(COMPONENTS, dir);
  if (!fs.existsSync(src)) {
    console.warn("Optional: missing monolith folder (skipped):", src);
    continue;
  }
  const dest = path.join(TARGET, dir);
  fs.mkdirSync(dest, { recursive: true });
  execSync(`cp -r "${src}/." "${dest}/"`);
}

const FILE_UPLOADER = path.join(COMPONENTS, "file-uploader");
const DEST_FILE_UPLOADER = path.join(TARGET, "file-uploader");
if (fs.existsSync(FILE_UPLOADER)) {
  fs.mkdirSync(DEST_FILE_UPLOADER, { recursive: true });
  execSync(`cp -r "${FILE_UPLOADER}/." "${DEST_FILE_UPLOADER}/"`);
  console.log("Synced file-uploader →", path.relative(CLIENT_ROOT, DEST_FILE_UPLOADER));
} else {
  console.warn("Optional: missing monolith file-uploader (skipped):", FILE_UPLOADER);
}

/**
 * @param {string} filePath absolute path under TARGET
 */
function monolithRelPathForTargetFile(filePath) {
  const relFromTarget = path.relative(TARGET, filePath).replace(/\\/g, "/");
  if (fs.existsSync(path.join(UI_KITS, relFromTarget))) {
    return `ui-kits/${relFromTarget}`;
  }
  if (relFromTarget.startsWith("file-uploader/") || relFromTarget === "file-uploader") {
    return relFromTarget;
  }
  for (const dir of EXTRA_COMPONENT_TOP_LEVEL_DIRS) {
    if (relFromTarget === dir || relFromTarget.startsWith(`${dir}/`)) {
      return relFromTarget;
    }
  }
  console.warn("Could not map to monolith path, assuming ui-kits:", relFromTarget);
  return `ui-kits/${relFromTarget}`;
}

function walkTransform(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkTransform(p);
    } else if (p.endsWith(".ts") || p.endsWith(".tsx")) {
      const raw = fs.readFileSync(p, "utf8");
      const monolithRel = monolithRelPathForTargetFile(p);
      fs.writeFileSync(p, transformMonolithSource(raw, monolithRel));
    }
  }
}

walkTransform(TARGET);

/** UILM-only files under `src/platform/ui/sync-preserves/components` merged on top (not from monolith). */
const SYNC_PRESERVES = path.join(CLIENT_ROOT, "src", "platform", "ui", "sync-preserves", "components");
if (fs.existsSync(SYNC_PRESERVES)) {
  execSync(`cp -r "${SYNC_PRESERVES}/." "${TARGET}/"`);
  console.log("Merged sync-preserves →", path.relative(CLIENT_ROOT, TARGET));
}

console.log("Synced platform UI components →", path.relative(CLIENT_ROOT, TARGET));
