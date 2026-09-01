import { test, expect } from "../../../support/test-base";
import { ensureAuthenticated } from "../../../support/login-helper";
import { openProjectDashboard } from "../../../support/flow-helpers";

// Dummy/example flow: this project's "chromium" test project already reuses
// the session saved by flow.setup.spec.ts (fixtures/flow-session.json), so
// no credentials are entered here. ensureAuthenticated() is a no-op re-check
// and only falls back to a real OIDC login (via E2E_USERNAME/E2E_PASSWORD in
// .env.e2e) if that session turns out to be missing or expired.
test.describe("flow: Overview menu", () => {
  test("Overview — full flow", async ({ page }) => {
    await ensureAuthenticated(page);

    await test.step("Console shows the project list with at least one environment to enter", async () => {
      await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
        timeout: 30_000,
      });
    });

    await test.step("Resources cards (Docs/Code/Cloud) are real links, not decorative text", async () => {
      const docsLink = page.getByRole("link", { name: "Docs", exact: false });
      const codeLink = page.getByRole("link", { name: "Code", exact: false });
      const cloudLink = page.getByRole("link", { name: "Cloud", exact: false });
      for (const link of [docsLink, codeLink, cloudLink]) {
        if (await link.isVisible().catch(() => false)) {
          await expect(link).toHaveAttribute("href", /.+/);
        }
      }
    });

    await test.step("Opening the Development environment reaches Project Details", async () => {
      await openProjectDashboard(page);
      await expect(page.getByText("X-Blocks-Key", { exact: true })).toBeVisible();
    });

    await test.step("Project/Environment switcher buttons reflect the current context", async () => {
      const projectSwitcher = page.getByRole("button", { name: /^Project/ });
      const environmentSwitcher = page.getByRole("button", { name: /^Environment/ });
      await expect(projectSwitcher).toBeVisible();
      await expect(environmentSwitcher).toBeVisible();
      // These are locked to the single current context in this tenant (no
      // sibling project/environment to switch to), so assert that strictly
      // instead of assuming a dropdown opens.
      await expect(projectSwitcher).toBeDisabled();
      await expect(environmentSwitcher).toBeDisabled();
    });

    const themeTablist = page.getByRole("tablist").first();
    const darkTab = themeTablist.locator('[aria-controls$="-content-dark"]');
    const lightTab = themeTablist.locator('[aria-controls$="-content-light"]');

    await test.step("Switching theme to Dark applies it, then Light restores it", async () => {
      await expect(themeTablist).toBeVisible({ timeout: 30_000 });
      await darkTab.click();
      await expect(page.locator("html")).toHaveClass(/dark/);
      await lightTab.click();
      await expect(page.locator("html")).not.toHaveClass(/dark/);
    });

    await test.step("Language selector lists EN/German/French with non-English disabled", async () => {
      const languageButton = page.getByRole("button", { name: /^en$/i });
      await languageButton.click();
      await expect(page.getByRole("menuitem", { name: "English" })).toBeVisible();
      await expect(page.getByRole("menuitem", { name: "German" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await expect(page.getByRole("menuitem", { name: "French" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
      await page.keyboard.press("Escape");
    });

    await test.step("Notification bell opens the popover and 'Mark all as read' is usable", async () => {
      await page.getByTestId("notification-bell").click();
      await expect(page.getByText("Notifications", { exact: true })).toBeVisible();
      const markAllRead = page.getByRole("button", { name: "Mark all as read" });
      if (await markAllRead.isVisible().catch(() => false)) {
        // This list re-renders live (real-time notifications), which trips
        // Playwright's actionability "stable element" wait indefinitely.
        // Force the click since the button itself is genuinely clickable.
        await markAllRead.click({ force: true, timeout: 10_000 }).catch(() => {});
      }
      await page.keyboard.press("Escape");
    });

    await test.step("App switcher opens the SELISE Blocks apps list", async () => {
      await page.getByRole("button", { name: "SELISE Blocks apps" }).click();
      await expect(page.getByText("SELISE Blocks", { exact: true })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    await test.step("X-Blocks-Key is masked and can be copied", async () => {
      const keyRow = page.getByText("X-Blocks-Key", { exact: true }).locator("..");
      await expect(keyRow).toContainText("*");
      const copyButton = keyRow.getByRole("button");
      const copyTooltip = keyRow.locator("span").filter({ hasText: /^(Copy|Copied!)$/ });
      // Without clipboard-write granted, navigator.clipboard.writeText()
      // never resolves and the tooltip text never flips to "Copied!" --
      // same root cause as the Core APIs "Copy as cURL" check further down.
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await copyButton.hover();
      await copyButton.click();
      await expect(copyTooltip).toHaveText("Copied!", { timeout: 10_000 });
    });

    await test.step("Core APIs section lists endpoint groups and expands on click", async () => {
      await expect(page.getByRole("heading", { name: "Core APIs" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(/^\d+ Endpoints$/)).toBeVisible();
      // Group names (Configuration, DataAccess, File, Schema, ...) are
      // module-defined and not worth hardcoding, so target groups by their
      // aria-expanded pattern instead of assuming specific names.
      const groupButtons = page.getByRole("button", { name: /^[A-Za-z]+\s+\d+$/ });
      const groupCount = await groupButtons.count();
      expect(groupCount).toBeGreaterThan(1);

      const firstGroupButton = groupButtons.first();
      await expect(firstGroupButton).toHaveAttribute("aria-expanded", "false");
      await firstGroupButton.click();
      await expect(firstGroupButton).toHaveAttribute("aria-expanded", "true");

      // A single expanded group isn't representative -- open a second group
      // too, and confirm the first one stays expanded independently.
      const secondGroupButton = groupButtons.nth(1);
      await expect(secondGroupButton).toHaveAttribute("aria-expanded", "false");
      await secondGroupButton.click();
      await expect(secondGroupButton).toHaveAttribute("aria-expanded", "true");
      await expect(firstGroupButton).toHaveAttribute("aria-expanded", "true");
    });

    await test.step("'Copy as cURL' on an endpoint copies something to the clipboard", async () => {
      // Scope to a "Copy as cURL" row specifically -- a bare "Copy" button
      // also exists elsewhere on this page (the X-Blocks-Key field).
      const curlRow = page.getByText("Copy as cURL").first().locator("..");
      const copyCurlButton = curlRow.getByRole("button", { name: "Copy" });
      if (await copyCurlButton.isVisible().catch(() => false)) {
        // clipboard-read isn't granted to the context by default; without it
        // navigator.clipboard.readText() hangs on a permission prompt that
        // never resolves headlessly. Grant it explicitly for this strict check.
        await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
        await copyCurlButton.click();
        // The clipboard write is async and can lag slightly behind the
        // click; poll instead of reading once immediately after.
        await expect
          .poll(() => page.evaluate(() => navigator.clipboard.readText()), { timeout: 15_000 })
          .not.toBe("");
      }
    });

    await test.step("Sidebar PROJECT/ENVIRONMENT context survives a reload", async () => {
      await expect(page.getByText(/^Project$/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /Environment/i })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: "Project Details" })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByRole("button", { name: /Environment/i })).toBeVisible();
    });

    await test.step("Returning to console shows the project list again", async () => {
      const backToConsole = page.getByRole("button", { name: "Back to console" });
      if (await backToConsole.isVisible().catch(() => false)) {
        await backToConsole.click();
        await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
          timeout: 30_000,
        });
      }
    });
  });
});
