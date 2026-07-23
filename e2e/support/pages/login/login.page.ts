import { type Locator, type Page } from "@playwright/test"

/** Blocks Localization /login — OIDC entry point. */
export class LoginPage {
  readonly page: Page
  readonly loginButton: Locator

  constructor(page: Page) {
    this.page = page
    this.loginButton = page.getByRole("button", {
      name: "Log in to your account",
    })
  }

  async goto() {
    await this.page.goto("/login")
  }

  async startOidcLogin() {
    await this.loginButton.click()
  }
}
