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
    "E2E_BASE_URL is not set. Copy e2e/.env.e2e.example to e2e/.env.e2e and set E2E_BASE_URL to your target host.",
  );
}

// Set E2E_NO_WEBSERVER=1 to skip auto-start — required when pointing at the
// remote dev host, and useful when you already run the app yourself.
const autoStartServer = process.env.E2E_NO_WEBSERVER !== "1";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial: these tests drive real backend state on dev, so running them in
  // parallel would race.
  workers: 1,
  // The login spec alone waits up to 45s on the OIDC round trip; Playwright's
  // 30s default would expire first and look like a broken login. Real runs
  // against dev land in the 25-45s range.
  timeout: 120_000,
  reporter: [["html", { open: "never" }], ["list"]],
  // Only relevant for a local build — see global-setup.ts.
  globalSetup: "./global-setup.ts",
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
  // Local-build mode only: start the .NET server (run.sh -b), wait for
  // baseURL, run the tests, tear it down. If a server is already listening at
  // baseURL it is reused instead.
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
          // Documented override (Program.cs): FrontendRuntime__BLOCKS_* env
          // vars win over the DB-backed config, so a fresh build also bakes
          // the local host into window.__BLOCKS_ENV__.
          env: {
            FrontendRuntime__BLOCKS_LOCALIZATION_BASE_URL: baseURL,
          },
        },
      }
    : {}),
  projects: [
    // Setup: performs the real login once and saves the session to
    // fixtures/auth.json (see login.spec.ts).
    {
      name: "setup",
      testMatch: /auth[\\/]login\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    // All other tests run authenticated by reusing that saved session, and
    // only after "setup" (login) has succeeded.
    {
      name: "chromium",
      testIgnore: /auth[\\/]login\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "fixtures/auth.json",
      },
    },
  ],
});
