import { test, expect } from "../../support/test-base"
import { e2eBaseUrl, e2eCredentials } from "../../support/env"
import { isLoginSurface, loginThroughOidc } from "../../support/login-helper"

test.describe("Authentication", () => {
  test.beforeAll(() => {
    e2eCredentials()
  })

  test("logs in through dev-iam and lands on the console", async ({ page }) => {
    const holdMs = Number(process.env.E2E_HOLD_MS ?? 0)
    if (holdMs > 0) test.setTimeout(holdMs + 120_000)

    await loginThroughOidc(page)

    await expect(
      page.getByRole("heading", {
        name: /Your Blocks Projects|Welcome to SELISE Blocks/,
      }),
    ).toBeVisible({ timeout: 20_000 })

    // Save the authenticated session once for all downstream e2e projects.
    await page.context().storageState({ path: "fixtures/auth.json" })

    await page.getByRole("button", { name: "Open user menu" }).click()
    await page.getByText("Log out").click()
    await expect(page.getByRole("heading", { name: "blocks Localization" })).toBeVisible({
      timeout: 30_000,
    })

    if (holdMs > 0) {
      await page.waitForTimeout(holdMs)
    }
  })

  test("redirects logged-out visitors of a protected route to the login surface", async ({ page }) => {
    const base = e2eBaseUrl()

    await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })

    await expect
      .poll(
        async () => (await isLoginSurface(page)) || /\/login/i.test(page.url()),
        { timeout: 20_000, intervals: [500, 1000] },
      )
      .toBe(true)

    const loginGateButton = page.getByRole("button", { name: "Log in to your account" })
    const oidcEmail = page.locator("#oidc-email").or(page.getByRole("textbox", { name: "Work Email" }))
    await expect(loginGateButton.or(oidcEmail)).toBeVisible({ timeout: 10_000 })

    await expect(page.getByRole("heading", { name: /Your Blocks Projects/ })).toHaveCount(0)
  })
})
