import { test as base, expect, type Page } from "@playwright/test"
import { e2eBaseUrl } from "./env"
import { isLoginSurface, isSessionEndedScreen } from "./login-helper"
import { persistSuiteSession } from "./localization-helpers"
import { markSuiteTestFailed } from "./run-outcome"

// Shared `test` for the whole suite. Specs import from here instead of
// "@playwright/test" so the headed-mode pause applies everywhere.
//
// Headed runs hold the browser open for a moment after each test finishes, so
// the end state is actually watchable instead of vanishing the instant the
// assertions pass. Headless runs (CI, plain `npm test`) are untouched.
//
//   E2E_PAUSE_MS=0      disable
//   E2E_PAUSE_MS=30000  hold longer
//   E2E_PAUSE_MS=3000 npm test   force it on in headless too

function pauseMs(isHeaded: boolean): number {
  const configured = process.env.E2E_PAUSE_MS

  if (configured !== undefined && configured !== "") {
    const parsed = Number(configured)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  return isHeaded ? 10_000 : 0
}

/**
 * Every test starts from the suite's saved session (fixtures/localization-session.json). IAM rotates the
 * refresh token when the app refreshes its access token, and a replayed old refresh token ends the whole
 * session. A test that outlives the access token therefore has to hand its rotated token on, or the next
 * test starts on "Your session has ended". Saved only while the page is still signed in on this app.
 */
async function keepSuiteSessionCurrent(page: Page) {
  if (page.isClosed()) return
  try {
    if (new URL(page.url()).origin !== new URL(e2eBaseUrl()).origin) return
  } catch {
    return
  }
  if ((await isLoginSurface(page)) || (await isSessionEndedScreen(page))) return
  await persistSuiteSession(page).catch(() => {})
}

export const test = base.extend<{ pauseAfterEachTest: void }>({
  pauseAfterEachTest: [
    async ({ page }, use, testInfo) => {
      const isHeaded = testInfo.project.use.headless === false
      const ms = pauseMs(isHeaded)

      if (ms > 0) testInfo.setTimeout(testInfo.timeout + ms)

      await use()

      if (testInfo.project.name === "localization") {
        if (testInfo.status !== "passed" && testInfo.status !== "skipped") {
          markSuiteTestFailed()
        }
        await keepSuiteSessionCurrent(page)
      }

      if (ms > 0 && !page.isClosed()) {
        await page.waitForTimeout(ms)
      }
    },
    { auto: true },
  ],
})

export { expect }
