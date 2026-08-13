import { type Locator, type Page } from "@playwright/test";
import { AUTHENTICATED_APP_URL } from "../../constants";

/** Console, project overview, or translations shell. */
export class AppShellPage {
  readonly page: Page;
  readonly projectsHeading: Locator;
  readonly projectDetailsHeading: Locator;
  readonly translationsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.projectsHeading = page.getByRole("heading", {
      name: "Your Blocks Projects",
    });
    this.projectDetailsHeading = page.getByRole("heading", {
      name: "Project Details",
    });
    this.translationsLink = page.getByRole("link", { name: "Translations" });
  }

  async waitForAuthenticated(timeout = 45_000) {
    await this.page.waitForURL(AUTHENTICATED_APP_URL, { timeout });

    if (this.page.url().includes("/services/language")) {
      await this.page
        .getByRole("tab", { name: "Translation Keys" })
        .waitFor({ state: "visible", timeout: 20_000 });
      return;
    }

    if (this.isOnConsole()) {
      await this.projectsHeading.waitFor({ state: "visible", timeout: 20_000 });
      return;
    }

    await this.translationsLink.waitFor({ state: "visible", timeout: 20_000 });
  }

  isOnConsole(): boolean {
    return /\/app\/console\/?$/.test(new URL(this.page.url()).pathname);
  }

  isOnProjectDashboard(): boolean {
    return /\/app\/[0-9a-f-]{36}\/dashboard/.test(this.page.url());
  }

  getProjectId(): string | undefined {
    const match = this.page.url().match(/\/app\/([0-9a-f-]{36})/);
    return match?.[1];
  }

  /** Navigate to the console project list (/app/console). */
  async gotoConsole() {
    await this.page.goto("/app/console");
  }

  /** Console: test project card → Development → overview. */
  async openProjectWithDevelopment(projectName: string, timeout = 45_000) {
    await this.projectsHeading.waitFor({ state: "visible", timeout });

    // Use .last() so we pick the innermost card, not a parent that wraps
    // multiple project cards (each with its own Development chip).
    const projectCard = this.page
      .getByRole("main")
      .locator("div")
      .filter({ has: this.page.getByText(projectName, { exact: true }) })
      .filter({ has: this.page.getByRole("button", { name: "Development" }) })
      .last();

    await projectCard.getByRole("button", { name: "Development" }).click();
    await this.page.waitForURL(/\/app\/[0-9a-f-]{36}\/dashboard/, { timeout });
    await this.projectDetailsHeading.waitFor({ state: "visible", timeout });
  }

  async openTranslations(timeout = 45_000) {
    await this.translationsLink.waitFor({ state: "visible", timeout });
    await this.translationsLink.click();
    await this.page.waitForURL(/\/services\/language/, { timeout });
    await this.page
      .getByRole("tab", { name: "Translation Keys" })
      .waitFor({ state: "visible", timeout });
  }
}

/** @deprecated Use AppShellPage */
export class ConsolePage extends AppShellPage {}
