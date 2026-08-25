import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

dotenv.config({ path: path.resolve(__dirname, ".env.e2e") })

const baseURL = process.env.E2E_BASE_URL

if (!baseURL) {
  throw new Error(
    "E2E_BASE_URL is not set. Copy e2e/.env.e2e.example to e2e/.env.e2e and set E2E_BASE_URL to your named domain.",
  )
}

const autoStartServer = process.env.E2E_NO_WEBSERVER !== "1"
const localizationSessionPath = path.resolve(__dirname, "fixtures/localization-session.json")

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: [["html", { open: "never" }], ["list"]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    launchOptions: {
      slowMo: process.env.E2E_SLOWMO ? Number(process.env.E2E_SLOWMO) : 0,
    },
  },
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
          env: {
            FrontendRuntime__BLOCKS_LOCALIZATION_BASE_URL: baseURL,
          },
        },
      }
    : {}),
  projects: [
    {
      name: "setup",
      testMatch: /auth[\\/]login\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "localization-setup",
      testMatch: /suite\.setup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "localization",
      testMatch: /.*\.spec\.ts/,
      testIgnore: [
        /auth[\\/]login\.spec\.ts/,
        /suite\.(setup|teardown)\.spec\.ts/,
      ],
      dependencies: ["localization-setup"],
      use: {
        ...devices["Desktop Chrome"],
        ...(fs.existsSync(localizationSessionPath)
          ? { storageState: "fixtures/localization-session.json" }
          : {}),
      },
    },
    {
      name: "localization-teardown",
      testMatch: /suite\.teardown\.spec\.ts/,
      dependencies: ["localization"],
      use: {
        ...devices["Desktop Chrome"],
        ...(fs.existsSync(localizationSessionPath)
          ? { storageState: "fixtures/localization-session.json" }
          : {}),
      },
    },
  ],
})
