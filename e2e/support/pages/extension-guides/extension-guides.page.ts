import { type Locator, type Page } from "@playwright/test";

/** Extension Guides page (sidebar link "Extension Guides"). */
export class ExtensionGuidesPage {
  readonly page: Page;
  readonly heading: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole("heading", { name: "Extension Guides" });
  }

  async openFromSidebar() {
    await this.page.getByRole("link", { name: "Extension Guides" }).click();
    await this.waitForReady();
  }

  async waitForReady(timeout = 45_000) {
    await this.heading.waitFor({ state: "visible", timeout });
  }
}