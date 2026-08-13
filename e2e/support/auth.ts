import { type Page } from "@playwright/test";
import { AUTHENTICATED_APP_URL } from "./constants";

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

/**
 * Drive the app's OIDC login flow against E2E_USERNAME / E2E_PASSWORD.
 *
 * Only used by `tests/auth/login.spec.ts` (the setup project). Specs in the
 * chromium project start authenticated via the storageState the setup wrote,
 * so they never call this.
 */
export async function login(page: Page): Promise<void> {
  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME / E2E_PASSWORD are not set. Fill them in e2e/.env.e2e before running.",
    );
  }

  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await page.getByRole("button", { name: "Log in to your account" }).click();

  const emailField = page.locator("#oidc-email");
  await emailField.waitFor({ timeout: 60_000 });
  await emailField.fill(username);
  await page.locator("#oidc-password").fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await page.waitForURL(AUTHENTICATED_APP_URL, { timeout: 45_000 });
}