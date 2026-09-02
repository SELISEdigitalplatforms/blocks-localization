import { type Page, type Locator, expect } from "@playwright/test";

export class OverviewPage {
  readonly page: Page;

  private readonly projectDetailsHeading: Locator;
  private readonly xBlocksKeyLabel: Locator;
  private readonly coreApisHeading: Locator;
  private readonly assistantApiButton: Locator;
  private readonly configApiButton: Locator;
  private readonly glossaryApiButton: Locator;
  private readonly keyApiButton: Locator;
  private readonly languageApiButton: Locator;
  private readonly moduleApiButton: Locator;
  private readonly themeTablist: Locator;
  private readonly darkTab: Locator;
  private readonly lightTab: Locator;
  private readonly languageButton: Locator;
  private readonly notificationBell: Locator;
  private readonly appsSwitcherButton: Locator;
  private readonly backToConsoleButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.projectDetailsHeading = page.getByRole("heading", { name: "Project Details" });
    this.xBlocksKeyLabel = page.getByText(/X-Blocks-Key/);
    this.coreApisHeading = page.getByRole("heading", { name: "Core APIs" });
    this.assistantApiButton = page.getByRole("button", { name: /Assistant \d+/ });
    this.configApiButton = page.getByRole("button", { name: /Config \d+/ });
    this.glossaryApiButton = page.getByRole("button", { name: /Glossary \d+/ });
    this.keyApiButton = page.getByRole("button", { name: /Key \d+/ });
    this.languageApiButton = page.getByRole("button", { name: /Language \d+/ });
    this.moduleApiButton = page.getByRole("button", { name: /Module \d+/ });
    this.themeTablist = page.getByRole("tablist").first();
    this.darkTab = this.themeTablist.locator('[aria-controls$="-content-dark"]');
    this.lightTab = this.themeTablist.locator('[aria-controls$="-content-light"]');
    this.languageButton = page.getByRole("button", { name: /^en$/i });
    this.notificationBell = page.getByTestId("notification-bell");
    this.appsSwitcherButton = page.getByRole("button", { name: "SELISE Blocks apps" });
    this.backToConsoleButton = page.getByRole("button", { name: "Back to console" });
  }

  async expectPageLoaded() {
    await expect(this.projectDetailsHeading).toBeVisible({ timeout: 15_000 });
    await expect(this.xBlocksKeyLabel).toBeVisible();
  }

  async expectCoreApisVisible() {
    await expect(this.coreApisHeading).toBeVisible({ timeout: 15_000 });
  }

  async expectEndpointsCountVisible() {
    await expect(this.page.getByText(/^\d+ Endpoints$/)).toBeVisible();
  }

  async expandApiGroup(name: "Assistant" | "Config" | "Glossary" | "Key" | "Language" | "Module") {
    const button =
      name === "Assistant"
        ? this.assistantApiButton
        : name === "Config"
          ? this.configApiButton
          : name === "Glossary"
            ? this.glossaryApiButton
            : name === "Key"
              ? this.keyApiButton
              : name === "Language"
                ? this.languageApiButton
                : this.moduleApiButton;
    await button.click();
  }

  async expectApiGroupExpanded(button: Locator, expanded: boolean) {
    await expect(button).toHaveAttribute("aria-expanded", expanded ? "true" : "false");
  }

  async switchThemeToDark() {
    await this.darkTab.click();
    await expect(this.page.locator("html")).toHaveClass(/dark/);
  }

  async switchThemeToLight() {
    await this.lightTab.click();
    await expect(this.page.locator("html")).not.toHaveClass(/dark/);
  }

  async openLanguageSelector() {
    await this.languageButton.click();
  }

  async expectLanguageOptionVisible(language: string) {
    await expect(this.page.getByRole("menuitem", { name: language })).toBeVisible();
  }

  async expectLanguageOptionDisabled(language: string) {
    await expect(this.page.getByRole("menuitem", { name: language })).toHaveAttribute("aria-disabled", "true");
  }

  async closeLanguageSelector() {
    await this.page.keyboard.press("Escape");
  }

  async openNotificationBell() {
    await this.notificationBell.click();
    await expect(this.page.getByText("Notifications", { exact: true })).toBeVisible({ timeout: 15_000 });
  }

  async markAllNotificationsAsRead() {
    const markAllRead = this.page.getByRole("button", { name: "Mark all as read" });
    if (await markAllRead.isVisible().catch(() => false)) {
      await markAllRead.click({ force: true, timeout: 10_000 }).catch(() => {});
    }
  }

  async closeNotificationPopover() {
    await this.page.keyboard.press("Escape");
  }

  async openAppSwitcher() {
    await this.appsSwitcherButton.click();
    await expect(this.page.getByText("SELISE Blocks", { exact: true })).toBeVisible();
  }

  async closeAppSwitcher() {
    await this.page.keyboard.press("Escape");
  }

  async copyXBlocksKey() {
    await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const keyRow = this.page.getByText("X-Blocks-Key", { exact: true }).locator("..");
    await expect(keyRow).toContainText("*");
    const copyButton = keyRow.getByRole("button");
    const copyTooltip = keyRow.locator("span").filter({ hasText: /^(Copy|Copied!)$/ });
    await copyButton.hover();
    await copyButton.click();
    await expect(copyTooltip).toHaveText("Copied!", { timeout: 10_000 });
  }

  async copyAsCurl() {
    const curlRow = this.page.getByText("Copy as cURL").first().locator("..");
    const copyCurlButton = curlRow.getByRole("button", { name: "Copy" });
    if (await copyCurlButton.isVisible().catch(() => false)) {
      await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      await copyCurlButton.click();
      await expect
        .poll(() => this.page.evaluate(() => navigator.clipboard.readText()), { timeout: 15_000 })
        .not.toBe("");
    }
  }

  async reloadPage() {
    await this.page.reload();
    await expect(this.projectDetailsHeading).toBeVisible({ timeout: 30_000 });
  }

  async expectEnvironmentSwitcherVisible() {
    await expect(this.page.getByRole("button", { name: /Environment/i })).toBeVisible();
  }

  async goBackToConsole() {
    if (await this.backToConsoleButton.isVisible().catch(() => false)) {
      await this.backToConsoleButton.click();
      await expect(this.page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
        timeout: 30_000,
      });
    }
  }
}
