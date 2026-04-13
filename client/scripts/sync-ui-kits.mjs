#!/usr/bin/env node
/** @deprecated Use `npm run sync:ui` → `sync-platform-ui.mjs`. Kept for documentation links. */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = spawnSync(process.execPath, [path.join(__dirname, "sync-platform-ui.mjs")], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
