import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "path";

// Load credentials + target host from the gitignored .env.e2e file.
dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });

const baseURL = process.env.E2E_BASE_URL;

// No localhost fallback on purpose: the app is served on a named domain, so a
// missing value should fail loudly instead of silently hitting the wrong host.
if (!baseURL) {
  throw new Error(
    "E2E_BASE_URL is not set. Copy e2e/.env.e2e.example to e2e/.env.e2e and set E2E_BASE_URL to your named domain.",
  );
}

// Set E2E_NO_WEBSERVER=1 to skip auto-start (e.g. when testing the remote dev
// host, when you already have the app running yourself, or on a machine
// without Git Bash's `bash` on PATH).
const autoStartServer = process.env.E2E_NO_WEBSERVER !== "1";
const flowSessionPath = path.resolve(__dirname, "fixtures/flow-session.json");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial: these tests exercise shared backend state on a live dev host, so
  // running them in parallel would race.
  workers: 1,
  // The login spec drives a full cross-origin OIDC round trip against the
  // remote dev host — observed 26-41s in real runs. Playwright's 30s default
  // would expire before the spec's own 45s waitForURL ever got the chance to.
  timeout: 120_000,
  reporter: [["html", { open: "never" }], ["list"]],
  // Patches a locally-built index.html so BLOCKS_LOCALIZATION_BASE_URL points at
  // E2E_BASE_URL instead of the remote dev server. No-op against remote hosts.
  globalSetup: "./global-setup.ts",
  // Removes the project the setup project created after the suite finishes.
  // Best-effort: logs and continues if anything goes wrong, so cleanup
  // failures never mask the real test result.
  globalTeardown: "./global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    // Slow each action down so the flow is watchable in headed mode.
    // e.g. E2E_SLOWMO=600 npm run test:headed
    launchOptions: {
      slowMo: process.env.E2E_SLOWMO ? Number(process.env.E2E_SLOWMO) : 0,
    },
  },
  // Local-build mode only: start the API (run.sh -b), wait until baseURL
  // responds, run the tests, then tear the server down. If a server is already
  // listening at baseURL it is reused instead.
  ...(autoStartServer
    ? {
        webServer: {
          command: "bash run.sh -b",
          cwd: path.resolve(__dirname, ".."),
          url: baseURL,
          reuseExistingServer: true,
          ignoreHTTPSErrors: true,
          timeout: 600_000,
          stdout: "pipe" as const,
          stderr: "pipe" as const,
          // Documented override (Program.cs): FrontendRuntime__BLOCKS_* env vars
          // win over the Mongo secret. Ensures a fresh build (run.sh -a) also
          // bakes the local host. No-op for -b (no placeholder left).
          env: {
            FrontendRuntime__BLOCKS_LOCALIZATION_BASE_URL: baseURL,
          },
        },
      }
    : {}),
  projects: [
    // Login/logout smoke test. Saves fixtures/auth.json but then logs out --
    // that file is proof the OIDC round trip works, not a reusable session.
    {
      name: "setup",
      testMatch: /auth[\\/]login\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], headless: false },
    },
    // Real session source for the flow specs: logs in fresh and saves
    // fixtures/flow-session.json without ever logging out (mirrors
    // blocks-logic's workflow-setup / workflow-session.json split).
    {
      name: "flow-setup",
      testMatch: /flows[\\/]flow\.setup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], headless: false },
    },
    // All other tests run authenticated by reusing that saved session, and
    // only after "flow-setup" (login) has succeeded.
    {
      name: "chromium",
      testIgnore: /auth[\\/]login\.spec\.ts|flows[\\/]flow\.setup\.spec\.ts/,
      dependencies: ["flow-setup"],
      use: {
        ...devices["Desktop Chrome"],
        headless: false,
        storageState: flowSessionPath,
      },
    },
  ],
});
