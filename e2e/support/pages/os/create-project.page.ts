import { type Page } from "@playwright/test";

/** OS app: create-project flow. Shared across all Blocks apps. */
export class OSCreateProjectPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    const osBaseUrl = process.env.E2E_OS_BASE_URL;
    if (!osBaseUrl) throw new Error("E2E_OS_BASE_URL is not set in .env.e2e");
    await this.page.goto(osBaseUrl);
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.goto(`${osBaseUrl}/app/create-project`);
    await this.page.waitForLoadState("networkidle");
    await this.page
      .getByRole("textbox", { name: "Enter your project name" })
      .waitFor({ state: "visible", timeout: 60_000 });
  }

  async fillProjectName(name: string) {
    await this.page.getByRole("textbox", { name: "Enter your project name" }).fill(name);
  }

  async checkConfirmationCheckboxes() {
    await this.page.getByRole("checkbox", { name: "I confirm that I will use" }).click();
    await this.page.getByRole("checkbox", { name: "I accept the Terms of services" }).click();
  }

  async clickContinue() {
    await this.page.getByRole("button", { name: "Continue" }).click();
  }

  async checkEnvironment(name: string) {
    await this.page.getByRole("checkbox", { name: new RegExp(`^${name}`) }).click();
  }

  async clickSubmit() {
    await this.page.getByRole("button", { name: "Submit" }).click();
  }
}
