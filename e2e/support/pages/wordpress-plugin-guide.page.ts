import { type Page, type Locator, expect } from "@playwright/test";

export class WordPressPluginGuidePage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly setupStatusHeading: Locator;
  private readonly setupInstructionsHeading: Locator;
  private readonly projectConfigurationHeading: Locator;
  private readonly clientCredentialsHeading: Locator;
  private readonly subtitle: Locator;
  private readonly credentialCountBadge: Locator;
  private readonly manageInBlocksOsButton: Locator;
  private readonly copyXBlocksKeyButton: Locator;
  private readonly copyOriginButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "WordPress Plugin Guide" });
    this.setupStatusHeading = page.getByRole("heading", { name: "Setup Status" });
    this.setupInstructionsHeading = page.getByRole("heading", { name: "Setup Instructions" });
    this.projectConfigurationHeading = page.getByRole("heading", { name: "Project configuration" });
    this.clientCredentialsHeading = page.getByRole("heading", { name: "WordPress client credentials" });
    this.subtitle = page.getByText("Connect your WordPress site to Blocks Localization.");
    this.credentialCountBadge = page.getByText(/\d+ credentials?/, { exact: true });
    this.manageInBlocksOsButton = page.getByRole("button", { name: "Manage in Blocks OS" });
    this.copyXBlocksKeyButton = page.getByRole("button", { name: "Copy X-Blocks-Key" });
    this.copyOriginButton = page.getByRole("button", { name: "Copy Origin" });
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.subtitle).toBeVisible();
    await expect(this.setupStatusHeading).toBeVisible();
    await expect(this.setupInstructionsHeading).toBeVisible();
  }

  async expectSetupStatusSectionsVisible() {
    await expect(this.projectConfigurationHeading).toBeVisible();
    await expect(this.copyXBlocksKeyButton).toBeVisible();
    await expect(this.copyOriginButton).toBeVisible();
    await expect(this.clientCredentialsHeading).toBeVisible();
    await expect(this.manageInBlocksOsButton).toBeVisible();
  }

  /** Credentials resolve to either the credential accordion list or an explicit empty state. */
  async expectCredentialsResolved() {
    const credentialAccordion = this.page
      .getByRole("button", { name: /Active|Inactive/ })
      .first();
    const emptyState = this.page.getByText("No WordPress client credentials found");
    await expect(credentialAccordion.or(emptyState)).toBeVisible({ timeout: 20_000 });
  }

  async copyXBlocksKey() {
    await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await this.copyXBlocksKeyButton.click();
    await expect(this.page.getByText("Copied", { exact: true }).first()).toBeVisible({
      timeout: 5_000,
    });
  }

  async copyOrigin() {
    await this.page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await this.copyOriginButton.click();
    await expect(this.page.getByText("Copied", { exact: true }).first()).toBeVisible({
      timeout: 5_000,
    });
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

  /** Expand the first credential accordion and verify its detail fields render. */
  async expandFirstCredential() {
    const firstCredential = this.page
      .getByRole("button", { name: /Active|Inactive/ })
      .first();
    await firstCredential.click();
    await expect(this.page.getByText("Token lifetime").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.page.getByText("Role(s)").first()).toBeVisible();
    await expect(this.page.getByText("Created on").first()).toBeVisible();
  }
}
