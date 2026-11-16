import { expect, type Page } from "@playwright/test"
import { e2eBaseUrl, e2eCredentials } from "./env"

function oidcEmailField(page: Page) {
  return page.locator("#oidc-email").or(page.getByRole("textbox", { name: "Work Email" }))
}

function oidcPasswordField(page: Page) {
  return page.locator("#oidc-password").or(page.getByRole("textbox", { name: "Password" }))
}

const consoleHeading = (page: Page) =>
  page.getByRole("heading", {
    name: /Your Blocks Projects|Welcome to SELISE Blocks/,
  })

/**
 * True when the genesis-os project guard shows that the session can no longer be used: "Your session has
 * ended" (IAM refused the refresh token), "Couldn't return to the console" (the project session could not
 * be stopped) or "Couldn't open <project>" (it could not be started). None of them recovers by itself;
 * the caller needs a fresh login.
 */
export async function isSessionEndedScreen(page: Page): Promise<boolean> {
  return page
    .getByRole("heading", { name: /^(Your session has ended|Couldn't return to the console|Couldn't open .+)$/ })
    .first()
    .isVisible({ timeout: 1_000 })
    .catch(() => false)
}

/** Signs in again from scratch after the session ended: drops the dead cookies, then logs in. */
export async function loginAfterSessionEnded(page: Page) {
  await page.context().clearCookies()
  await loginThroughOidc(page)
}

/** True when the page is the product login gate or OIDC credential form. */
export async function isLoginSurface(page: Page): Promise<boolean> {
  if (
    await page
      .getByRole("button", { name: "Log in to your account" })
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    return true
  }

  if (await oidcEmailField(page).isVisible({ timeout: 500 }).catch(() => false)) {
    return true
  }

  try {
    if (/\/login\/?$/i.test(new URL(page.url()).pathname)) return true
  } catch {
    // ignore invalid URL
  }

  return false
}

type Credentials = { email: string; password: string }

async function fillCredentialsAndSubmit(page: Page, credentials: Credentials = e2eCredentials()) {
  const { email, password } = credentials
  const emailField = oidcEmailField(page)
  await emailField.fill(email)
  const passwordField = oidcPasswordField(page)
  await expect(passwordField).toBeVisible({ timeout: 10_000 })
  await passwordField.fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()
}

export async function loginThroughOidc(
  page: Page,
  options?: { loginPath?: string; credentials?: Credentials },
) {
  const base = e2eBaseUrl()
  const loginPath = options?.loginPath ?? `${base}/login`

  await page.goto(loginPath, { waitUntil: "domcontentloaded" })

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await consoleHeading(page).isVisible({ timeout: 3_000 }).catch(() => false)) {
      return
    }

    const loginButton = page.getByRole("button", { name: "Log in to your account" })
    if (await loginButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      try {
        await loginButton.click({ timeout: 8_000 })
      } catch {
        if (await consoleHeading(page).isVisible({ timeout: 3_000 }).catch(() => false)) return
        await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
        continue
      }

      const emailField = oidcEmailField(page)
      await Promise.race([
        emailField.waitFor({ state: "visible", timeout: 30_000 }),
        consoleHeading(page).waitFor({ state: "visible", timeout: 30_000 }),
        page.waitForURL(/\/app\/console/, { timeout: 30_000 }),
      ]).catch(() => {})

      if (await consoleHeading(page).isVisible().catch(() => false)) {
        return
      }

      if (await emailField.isVisible().catch(() => false)) {
        await fillCredentialsAndSubmit(page, options?.credentials)
        await page.waitForURL(/\/app\/console/, { timeout: 45_000 })
        return
      }

      await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
      continue
    }

    await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
  }

  await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
  await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 })
}

export async function ensureAuthenticated(page: Page) {
  const base = e2eBaseUrl()
  await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })

  if (await consoleHeading(page).isVisible({ timeout: 15_000 }).catch(() => false)) {
    return
  }

  await loginThroughOidc(page)
}

export async function ensureAuthenticatedOnCurrentOrigin(page: Page) {
  const href = page.url()
  if (!/^https?:/.test(href)) {
    await ensureAuthenticated(page)
    return
  }

  const origin = new URL(href).origin
  await page.goto(`${origin}/app/console`, { waitUntil: "domcontentloaded" })

  if (await consoleHeading(page).isVisible({ timeout: 15_000 }).catch(() => false)) {
    return
  }

  await loginThroughOidc(page, { loginPath: `${origin}/login` })
}
