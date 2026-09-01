import { expect, type Page } from "@playwright/test";
import { e2eBaseUrl, e2eCredentials } from "./env";

function oidcEmailField(page: Page) {
  return page.locator("#oidc-email").or(page.getByRole("textbox", { name: "Work Email" }));
}

function oidcPasswordField(page: Page) {
  return page.locator("#oidc-password").or(page.getByRole("textbox", { name: "Password" }));
}

const consoleHeading = (page: Page) =>
  page.getByRole("heading", {
    name: /Your Blocks Projects|Welcome to SELISE Blocks/,
  });

async function fillCredentialsAndSubmit(page: Page) {
  const { email, password } = e2eCredentials();
  const emailField = oidcEmailField(page);
  await emailField.fill(email);
  const passwordField = oidcPasswordField(page);
  await expect(passwordField).toBeVisible({ timeout: 10_000 });
  await passwordField.fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

export async function loginThroughOidc(page: Page, options?: { loginPath?: string }) {
  const base = e2eBaseUrl();
  const loginPath = options?.loginPath ?? `${base}/login`;

  await page.goto(loginPath, { waitUntil: "domcontentloaded" });

  for (let attempt = 0; attempt < 3; attempt++) {
    if (
      await consoleHeading(page)
        .isVisible({ timeout: 3_000 })
        .catch(() => false)
    ) {
      return;
    }

    const loginButton = page.getByRole("button", { name: "Log in to your account" });
    if (await loginButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      try {
        await loginButton.click({ timeout: 8_000 });
      } catch {
        if (
          await consoleHeading(page)
            .isVisible({ timeout: 3_000 })
            .catch(() => false)
        )
          return;
        await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" });
        continue;
      }

      const emailField = oidcEmailField(page);
      await Promise.race([
        emailField.waitFor({ state: "visible", timeout: 30_000 }),
        consoleHeading(page).waitFor({ state: "visible", timeout: 30_000 }),
        page.waitForURL(/\/app\/console/, { timeout: 30_000 }),
      ]).catch(() => {});

      if (
        await consoleHeading(page)
          .isVisible()
          .catch(() => false)
      ) {
        return;
      }

      if (await emailField.isVisible().catch(() => false)) {
        await fillCredentialsAndSubmit(page);
        await page.waitForURL(/\/app\/console/, { timeout: 45_000 });
        return;
      }

      await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" });
      continue;
    }

    await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" });
  }

  await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" });
  await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 });
}

export async function ensureAuthenticated(page: Page) {
  const base = e2eBaseUrl();
  await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" });

  if (
    await consoleHeading(page)
      .isVisible({ timeout: 15_000 })
      .catch(() => false)
  ) {
    return;
  }

  await loginThroughOidc(page);
}

export async function ensureAuthenticatedOnCurrentOrigin(page: Page) {
  const href = page.url();
  if (!/^https?:/.test(href)) {
    await ensureAuthenticated(page);
    return;
  }

  const origin = new URL(href).origin;
  await page.goto(`${origin}/app/console`, { waitUntil: "domcontentloaded" });

  if (
    await consoleHeading(page)
      .isVisible({ timeout: 15_000 })
      .catch(() => false)
  ) {
    return;
  }

  await loginThroughOidc(page, { loginPath: `${origin}/login` });
}

export async function loginFresh(page: Page) {
  await loginThroughOidc(page, { loginPath: e2eBaseUrl() });
}

/**
 * Opens the Development environment from the console project list.
 *
 * The dev-iam session occasionally bounces back to /login right after this
 * click (short-lived token refresh race — "Session expired" during
 * impersonation). Re-authenticate and retry once instead of failing the
 * whole flow on a transient redirect.
 */
export async function openDevelopmentEnvironment(page: Page) {
  const base = e2eBaseUrl();
  const environmentButton = page.getByRole("button", { name: /Development|Production/ }).first();
  const projectDetailsHeading = page.getByRole("heading", { name: "Project Details" });

  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(environmentButton).toBeVisible({ timeout: 15_000 });
    await environmentButton.scrollIntoViewIfNeeded();
    // Plain .click() can silently no-op here (an overlay/animation over the
    // card intercepts the pointer event), which just strands the page on
    // /app/console with no navigation and no error. Force it, matching the
    // equivalent click in create-and-delete-project.ts.
    await environmentButton.click({ force: true });

    if (
      await Promise.race([
        projectDetailsHeading.waitFor({ state: "visible", timeout: 15_000 }).then(() => true),
        page.waitForURL(/\/dashboard/, { timeout: 15_000 }).then(() => true),
      ]).catch(() => false)
    ) {
      // The /dashboard URL (or an in-flight heading match) can still bounce to
      // /login a moment later on a token-refresh race, so re-check for that
      // bounce explicitly instead of trusting the race result at face value.
      if (
        await projectDetailsHeading
          .isVisible({ timeout: 15_000 })
          .catch(() => false)
      ) {
        return;
      }
    }

    const stillOnConsole = /\/app\/console\/?$/.test(new URL(page.url()).pathname);
    if (/\/login(?:$|[/?])/.test(new URL(page.url()).pathname)) {
      // Session expired mid-navigation. Log in again immediately rather than
      // going through ensureAuthenticated's console-heading check, which
      // would just re-observe the same login page and waste the timeout.
      await loginThroughOidc(page);
    } else if (!stillOnConsole) {
      await ensureAuthenticated(page);
    }
    // If still on console, the click just didn't register (no bounce to
    // chase) -- reload before the next attempt so the card and any covering
    // overlay are freshly rendered instead of retrying the click as-is.
    if (stillOnConsole) {
      await page.reload({ waitUntil: "domcontentloaded" });
    } else {
      await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" });
    }
  }

  await expect(environmentButton).toBeVisible({ timeout: 15_000 });
  await environmentButton.click();
  await expect(projectDetailsHeading).toBeVisible({ timeout: 30_000 });
}
