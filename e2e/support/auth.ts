import { expect, type Page } from "@playwright/test"
import { AUTHENTICATED_APP_URL } from "./constants"

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD

/**
 * Drive the app's OIDC login flow against E2E_USERNAME / E2E_PASSWORD.
 * Lives in support/ so specs call it from `test.beforeEach` (avoids the
 * storageState handoff a separate "setup" project would otherwise require).
 */
export async function login(page: Page): Promise<void> {
  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME / E2E_PASSWORD are not set. Fill them in e2e/.env.e2e before running.",
    )
  }

  await page.goto("/login")
  await page.waitForLoadState("domcontentloaded")
  await page.getByRole("button", { name: "Log in to your account" }).click()

  const emailField = page.locator("#oidc-email")
  // Dev-iam cross-origin redirect can take >30s in CI/slow networks.
  await emailField.waitFor({ timeout: 60_000 })
  await emailField.fill(username)
  await page.locator("#oidc-password").fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()

  await page.waitForURL(AUTHENTICATED_APP_URL, { timeout: 45_000 })
}

/**
 * Login and open the configured project via Development.
 */
export async function loginToProject(
  page: Page,
  projectName = process.env.E2E_PROJECT_NAME ?? "test",
): Promise<void> {
  await login(page)

  if (/\/app\/[0-9a-f-]{36}\/(dashboard|services)/.test(page.url())) {
    await page
      .getByRole("link", { name: "Modules" })
      .waitFor({ state: "visible", timeout: 20_000 })
    return
  }

  if (/\/app\/console\/?$/.test(new URL(page.url()).pathname)) {
    await expect(
      page.getByRole("heading", { name: "Your Blocks Projects" }),
    ).toBeVisible({ timeout: 20_000 })

    const projectCard = page
      .getByRole("main")
      .locator("div")
      .filter({ has: page.getByText(projectName, { exact: true }) })
      .filter({ has: page.getByRole("button", { name: "Development" }) })
      .first()

    await projectCard.getByRole("button", { name: "Development" }).click()
    await page.waitForURL(/\/app\/[0-9a-f-]{36}\/dashboard/, {
      timeout: 45_000,
    })
  }

  await page
    .getByRole("link", { name: "Modules" })
    .waitFor({ state: "visible", timeout: 45_000 })
}

/**
 * Login, open the configured project via Development, and land on Translations.
 */
export async function loginToTranslations(
  page: Page,
  projectName = process.env.E2E_PROJECT_NAME ?? "test",
): Promise<void> {
  await loginToProject(page, projectName)

  if (page.url().includes("/services/language")) {
    await expect(
      page.getByRole("tab", { name: "Translation Keys" }),
    ).toBeVisible({ timeout: 20_000 })
    return
  }

  const translationsLink = page.getByRole("link", { name: "Translations" })
  await translationsLink.waitFor({ state: "visible", timeout: 45_000 })
  await translationsLink.click()
  await page.waitForURL(/\/services\/language/, { timeout: 45_000 })
  await expect(
    page.getByRole("tab", { name: "Translation Keys" }),
  ).toBeVisible({ timeout: 20_000 })
}
