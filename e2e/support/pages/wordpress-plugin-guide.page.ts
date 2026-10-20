import { type Page, type Locator, expect } from "@playwright/test";

// The guide was simplified in c76e9b5: WordPress credentials are now managed from Integrations in
// Blocks OS, so the page only explains that and links there.
export class WordPressPluginGuidePage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly subtitle: Locator;
  private readonly instructions: Locator;
  private readonly openIntegrationsButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "WordPress Plugin Guide" });
    this.subtitle = page.getByText(
      "Connect your WordPress site to Blocks Localization from Integrations in Blocks OS.",
    );
    this.instructions = page.getByText(
      "Create a connection there, then copy its one-time credentials into the plugin.",
    );
    this.openIntegrationsButton = page.getByRole("button", {
      name: "Open Integrations in Blocks OS",
    });
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.subtitle).toBeVisible();
    await expect(this.instructions).toBeVisible();
  }

  async expectOpenIntegrationsEnabled() {
    await expect(this.openIntegrationsButton).toBeEnabled({ timeout: 10_000 });
  }

  /** The button hands over to the project's Integrations page in Blocks OS. */
  async openIntegrationsInBlocksOs() {
    await this.openIntegrationsButton.click();
    await expect(this.page).toHaveURL(/\/secret-management\/integration/, { timeout: 30_000 });
  }
}
