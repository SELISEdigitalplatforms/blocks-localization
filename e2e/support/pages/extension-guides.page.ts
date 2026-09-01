import { type Page, type Locator, expect } from "@playwright/test";

export class ExtensionGuidesPage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly setupHeading: Locator;
  private readonly jsonSetupHeading: Locator;
  private readonly manageSavedInstancesHeading: Locator;
  private readonly connectBlocksText: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "Extension Guides" });
    this.setupHeading = page.getByRole("heading", { name: "Set up a Blocks instance" });
    this.jsonSetupHeading = page.getByRole("heading", { name: "JSON setup" });
    this.manageSavedInstancesHeading = page.getByRole("heading", { name: "Manage saved instances" });
    this.connectBlocksText = page.getByText(/Connect SELISE Blocks/);
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.setupHeading).toBeVisible();
    await expect(this.jsonSetupHeading).toBeVisible();
    await expect(this.manageSavedInstancesHeading).toBeVisible();
  }

  async expectConnectBlocksVisible() {
    await expect(this.connectBlocksText).toBeVisible();
  }

  getAccordionButton(name: string): Locator {
    return this.page.getByRole("button", { name });
  }

  async expectAccordionCollapsed(button: Locator) {
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toHaveAttribute("data-state", "closed");
  }

  async expandAccordion(button: Locator) {
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(button).toHaveAttribute("data-state", "open");
  }

  async collapseAccordion(button: Locator) {
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(button).toHaveAttribute("data-state", "closed");
  }

  async clickChromeWebStoreLink() {
    const page3Promise = this.page.waitForEvent("popup");
    await this.page.getByRole("link", { name: "Chrome Web Store" }).click();
    return page3Promise;
  }

  async expectChromeStoreHeadingVisible(popupPage: Page) {
    await popupPage.waitForLoadState("domcontentloaded");
    await expect(
      popupPage.getByRole("heading", {
        name: "SELISE Blocks Assistant",
        exact: true,
      }),
    ).toBeVisible();
  }

  async bringMainPageToFront() {
    await this.page.bringToFront();
  }

  async grantClipboardPermissions() {
    await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  }

  async copyButton(name: string) {
    const button = this.page.getByRole("button", { name });
    await button.click();
    await expect
      .poll(
        async () => {
          if (await this.page.getByText("Copied").isVisible().catch(() => false)) return "toast";
          const label = await button.getAttribute("aria-label");
          if (label && /copied/i.test(label)) return "label";
          try {
            const text = await this.page.evaluate(async () => navigator.clipboard.readText());
            if (text.length > 0) return "clipboard";
          } catch {
            // Clipboard may be blocked in some headed runs.
          }
          return null;
        },
        { timeout: 5000 },
      )
      .not.toBeNull();
  }

  async expectAlternativeSetupOptionsVisible() {
    await expect(this.page.getByRole("heading", { name: "Alternative setup options" })).toBeVisible();
  }

  async expectActiveInstanceVisible() {
    await expect(this.page.getByRole("heading", { name: "Active instance" })).toBeVisible();
  }

  async expectEditDetailsVisible() {
    await expect(this.page.getByRole("heading", { name: "Edit details" })).toBeVisible();
  }

  async expectRemoveInstanceVisible() {
    await expect(this.page.getByRole("heading", { name: "Remove an instance" })).toBeVisible();
  }
}
