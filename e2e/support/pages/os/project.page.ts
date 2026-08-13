import { expect, type Page } from "@playwright/test";

/** OS app: console + project-delete flow. Used by globalTeardown. */
export class OSProjectPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async gotoConsole() {
    const osBaseUrl = process.env.E2E_OS_BASE_URL;
    if (!osBaseUrl) throw new Error("E2E_OS_BASE_URL is not set in .env.e2e");
    await this.page.goto(`${osBaseUrl}/app/console`);
  }

  async clickProjectSettings(projectName: string) {
    const projectContainer = this.page
      .locator("div")
      .filter({ has: this.page.getByText(projectName, { exact: false }) })
      .filter({ has: this.page.locator("svg.lucide-settings2") })
      .last();
    await projectContainer
      .locator("button")
      .filter({ has: this.page.locator("svg.lucide-settings2") })
      .click();
  }

  async clickEnvironment(environmentName: string) {
    await this.page
      .locator("div")
      .filter({ hasText: new RegExp(`^${environmentName}$`) })
      .first()
      .click();
  }

  async clickDeleteButton() {
    await this.page.getByRole("button", { name: "Delete", exact: true }).click();
  }

  async confirmDelete() {
    await this.page
      .getByRole("button", { name: "Delete", exact: true })
      .filter({ hasNot: this.page.getByTitle("Delete domain") })
      .click();
  }

  async expectSuccessfullyDeletedToast() {
    await expect(
      this.page
        .locator("div.text-sm.opacity-90")
        .filter({ hasText: "Successfully deleted" }),
    ).toBeVisible();
  }
}