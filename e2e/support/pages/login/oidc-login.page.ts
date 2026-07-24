import { type Locator, type Page } from "@playwright/test";

/** dev-iam OIDC login form (/oidc/login, cross-origin). */
export class OidcLoginPage {
  readonly page: Page;
  readonly emailField: Locator;
  readonly passwordField: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailField = page.locator("#oidc-email");
    this.passwordField = page.locator("#oidc-password");
    this.submitButton = page.getByRole("button", { name: "Login", exact: true });
  }

  async waitForReady(timeout = 60_000) {
    await this.emailField.waitFor({ timeout });
  }

  async login(email: string, password: string) {
    await this.emailField.fill(email);
    await this.passwordField.fill(password);
    await this.submitButton.click();
  }
}
