import { test, expect } from "../../support/test-base";
import { OverviewPage } from "../../support/pages/overview.page";
import { openLocalizationConsole, openProjectDashboard } from "../../support/localization-helpers";

test.describe("Overview", () => {
  test("Overview — full flow", async ({ page }) => {
    const overview = new OverviewPage(page);

    await test.step("Console shows the project list with at least one environment to enter", async () => {
      await openLocalizationConsole(page);
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

    await test.step("Direct open /app/{id}/dashboard reaches Project Details", async () => {
      await openProjectDashboard(page);
      await overview.expectPageLoaded();
      await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/);
    });

    await test.step("Project/Environment switcher buttons reflect the current context", async () => {
      const projectSwitcher = page.getByRole("button", { name: /^Project/ });
      const environmentSwitcher = page.getByRole("button", { name: /^Environment/ });
      await expect(projectSwitcher).toBeVisible();
      await expect(environmentSwitcher).toBeVisible();
      await expect(projectSwitcher).toBeDisabled();
      await expect(environmentSwitcher).toBeDisabled();
    });

    await test.step("Switching theme to Dark applies it, then Light restores it", async () => {
      await overview.switchThemeToDark();
      await overview.switchThemeToLight();
    });

    await test.step("Language selector lists EN/German/French with non-English disabled", async () => {
      await overview.openLanguageSelector();
      await overview.expectLanguageOptionVisible("English");
      await overview.expectLanguageOptionDisabled("German");
      await overview.expectLanguageOptionDisabled("French");
      await overview.closeLanguageSelector();
    });

    await test.step("Notification bell opens the popover and 'Mark all as read' is usable", async () => {
      await overview.openNotificationBell();
      await overview.markAllNotificationsAsRead();
      await overview.closeNotificationPopover();
    });

    await test.step("App switcher opens the SELISE Blocks apps list", async () => {
      await overview.openAppSwitcher();
      await overview.closeAppSwitcher();
    });

    await test.step("X-Blocks-Key is masked and can be copied", async () => {
      await overview.copyXBlocksKey();
    });

    await test.step("Core APIs section lists endpoint groups and expands on click", async () => {
      await overview.expectCoreApisVisible();
      await overview.expectEndpointsCountVisible();
      const groupButtons = page.getByRole("button", { name: /^[A-Za-z]+\s+\d+$/ });
      const groupCount = await groupButtons.count();
      expect(groupCount).toBeGreaterThan(1);

      const firstGroupButton = groupButtons.first();
      await overview.expectApiGroupExpanded(firstGroupButton, false);
      await overview.expandApiGroup("Assistant");
      await overview.expectApiGroupExpanded(firstGroupButton, true);

      const secondGroupButton = groupButtons.nth(1);
      await overview.expectApiGroupExpanded(secondGroupButton, false);
      await overview.expandApiGroup("Config");
      await overview.expectApiGroupExpanded(secondGroupButton, true);
      await overview.expectApiGroupExpanded(firstGroupButton, true);
    });

    await test.step("'Copy as cURL' on an endpoint copies something to the clipboard", async () => {
      await overview.copyAsCurl();
    });

    await test.step("Sidebar PROJECT/ENVIRONMENT context survives a reload", async () => {
      await overview.expectEnvironmentSwitcherVisible();
      await overview.reloadPage();
      await overview.expectEnvironmentSwitcherVisible();
    });

    await test.step("Returning to console shows the project list again", async () => {
      await overview.goBackToConsole();
    });
  });
});
