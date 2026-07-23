import { type Locator, type Page } from "@playwright/test"
import { waitForUiSettle } from "../../utils/wait-for"

/** Key details page (/translations/:keyId). */
export class KeyDetailsPage {
  readonly page: Page
  readonly detailsTab: Locator
  readonly deleteButton: Locator

  constructor(page: Page) {
    this.page = page
    this.detailsTab = page.getByRole("tab", { name: "Details" })
    this.deleteButton = page.getByRole("button", { name: "Delete" })
  }

  async waitForReady(keyName: string) {
    await this.page.waitForURL(/\/services\/language\/translations\//)
    await this.page.getByText(keyName, { exact: true }).first().waitFor({
      state: "visible",
      timeout: 30_000,
    })
  }

  async deleteKey() {
    await this.deleteButton.click()
    await this.page.getByRole("button", { name: "Delete Key" }).click()
    await this.page.waitForURL(/\/services\/language$/)
    await waitForUiSettle(this.page)
  }

  async backToTranslations() {
    await this.page.getByRole("link", { name: "Translations" }).click()
    await this.page.waitForURL(/\/services\/language$/)
  }
}
