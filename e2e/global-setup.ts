import fs from "fs";
import path from "path";

/**
 * Point a locally-served Blocks Localization at itself, not the remote dev host.
 *
 * The built index.html carries runtime config in `window.__BLOCKS_ENV__`. The
 * .NET host bakes `BLOCKS_LOCALIZATION_BASE_URL` from the DB-backed
 * "FrontendRuntime" config section (see server/Api/Program.cs), which is the
 * deployed host. When the app runs locally on :5000, the SPA would otherwise
 * send its API calls to the remote dev server. This patches the served
 * index.html so BLOCKS_LOCALIZATION_BASE_URL === E2E_BASE_URL.
 *
 * Idempotent and order-independent: it rewrites the concrete value (or the
 * `__BLOCKS_LOCALIZATION_BASE_URL__` placeholder), so it holds whether it runs
 * before or after the host's own startup replacement.
 *
 * When testing the remote dev host there is no local wwwroot build, so this
 * logs a skip and does nothing — that warning is expected, not a failure.
 */
export default function globalSetup() {
  const baseURL = process.env.E2E_BASE_URL;
  if (!baseURL) return; // playwright.config.ts already throws when unset

  const indexHtml = path.resolve(__dirname, "../server/Api/wwwroot/index.html");
  if (!fs.existsSync(indexHtml)) {
    console.warn(
      `[e2e] index.html not found at ${indexHtml} — skipping BLOCKS_LOCALIZATION_BASE_URL patch. ` +
        `Expected when testing a remote host; for a local run build the FE first (cd client && npm run build).`,
    );
    return;
  }

  const original = fs.readFileSync(indexHtml, "utf8");
  const patched = original.replace(
    /(BLOCKS_LOCALIZATION_BASE_URL:\s*")([^"]*)(")/g,
    `$1${baseURL}$3`,
  );

  if (patched === original) {
    console.log(`[e2e] BLOCKS_LOCALIZATION_BASE_URL already "${baseURL}" — no patch needed.`);
    return;
  }

  fs.writeFileSync(indexHtml, patched);
  console.log(`[e2e] Patched BLOCKS_LOCALIZATION_BASE_URL -> "${baseURL}" in served index.html.`);
}
