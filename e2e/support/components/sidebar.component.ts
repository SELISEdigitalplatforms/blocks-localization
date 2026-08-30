import { type Page, type Locator, expect } from "@playwright/test";

export class Sidebar {
  readonly page: Page;

  readonly overviewLink: Locator;
  readonly translationsLink: Locator;
  readonly modulesLink: Locator;
  readonly glossaryLink: Locator;
  readonly configurationLink: Locator;
  readonly extensionGuidesLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.overviewLink = page.getByRole("link", { name: "Overview" });
    this.translationsLink = page.getByRole("link", { name: "Translations" });
    this.modulesLink = page.getByRole("link", { name: "Modules" });
    this.glossaryLink = page.getByRole("link", { name: "Glossary" });
    this.configurationLink = page.getByRole("link", { name: "Configuration" });
    this.extensionGuidesLink = page.getByRole("link", { name: "Extension Guides" });
  }

  async goToOverview() {
    await this.overviewLink.click();
    await expect(this.page.getByRole("heading", { name: "Project Details" })).toBeVisible({ timeout: 15_000 });
  }

  async goToTranslations() {
    await this.translationsLink.click();
    await expect(this.page.getByRole("heading", { name: "Configure keys" })).toBeVisible({ timeout: 15_000 });
  }

  async goToModules() {
    await this.modulesLink.click();
    await expect(this.page.getByRole("heading", { name: "Language Modules" })).toBeVisible({ timeout: 15_000 });
  }

  async goToGlossary() {
    await this.glossaryLink.click();
    await expect(this.page.getByRole("heading", { name: "Glossary Management" })).toBeVisible({ timeout: 15_000 });
  }

  async goToConfiguration() {
    await this.configurationLink.click();
    await expect(this.page.getByRole("heading", { name: "Configure Languages" })).toBeVisible({ timeout: 15_000 });
  }

  async goToExtensionGuides() {
    await this.extensionGuidesLink.click();
    await expect(this.page.getByRole("heading", { name: "Extension Guides" })).toBeVisible({ timeout: 15_000 });
  }
}
