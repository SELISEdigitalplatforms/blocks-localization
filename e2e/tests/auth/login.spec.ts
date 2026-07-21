import { test, expect } from "../../support/test-base";

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

test.describe("Authentication", () => {
  test.beforeAll(() => {
    if (!username || !password) {
      throw new Error(
        "E2E_USERNAME / E2E_PASSWORD are not set. Fill them in e2e/.env.e2e before running.",
      );
    }
  });

  test("logs in through dev-iam and lands on the console", async ({ page }) => {
    // Extend the test timeout to cover an optional inspection hold at the end.
    const holdMs = Number(process.env.E2E_HOLD_MS ?? 0);
    if (holdMs > 0) test.setTimeout(holdMs + 60_000);

    // 1. Blocks Localization login page — a single CTA that starts the OIDC flow.
    await page.goto("/login");
    await page.getByRole("button", { name: "Log in to your account" }).click();

    // 2. Redirected to the dev-iam OIDC login page (/oidc/login, cross-origin).
    //    Selectors come from blocks-idp oidc-login-form.tsx (stable field ids).
    const emailField = page.locator("#oidc-email");
    await emailField.waitFor({ timeout: 30_000 });
    await emailField.fill(username!);
    await page.locator("#oidc-password").fill(password!);
    await page.getByRole("button", { name: "Login", exact: true }).click();

    // 3. Back on Blocks Localization, authenticated → console.
    await page.waitForURL("**/app/console", { timeout: 45_000 });
    await expect(page).toHaveURL(/\/app\/console/);

    // Assert the console actually rendered — not just that the route changed.
    // router.tsx renders <ConsolePage /> with no `canCreateProject` prop, and
    // the kit defaults it to false, so the empty-state "Welcome to SELISE
    // Blocks" branch is unreachable here: the heading is always this one.
    await expect(
      page.getByRole("heading", { name: "Your Blocks Projects" }),
    ).toBeVisible({ timeout: 20_000 });

    // Persist the authenticated session for future specs to reuse.
    await page.context().storageState({ path: "fixtures/auth.json" });

    // Optionally keep the browser open to inspect the result before it closes.
    // e.g. E2E_HOLD_MS=120000 npm run test:headed
    if (holdMs > 0) {
      await page.waitForTimeout(holdMs);
    }
  });
});
