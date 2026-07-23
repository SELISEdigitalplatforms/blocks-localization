import { expect, type Locator, type Page } from "@playwright/test"
import { expectToast } from "../../test-base"
import { waitForUiSettle } from "../../utils/wait-for"

/** Modules list (/services/modules). */
export class ModulesListPage {
  readonly page: Page
  readonly newModuleButton: Locator
  readonly searchInput: Locator

  constructor(page: Page) {
    this.page = page
    this.newModuleButton = page.getByRole("button", { name: "New Module" })
    this.searchInput = page.getByPlaceholder("Search modules...")
  }

  async openFromSidebar() {
    await this.page.getByRole("link", { name: "Modules" }).click()
    await this.waitForReady()
  }

  async waitForReady(timeout = 45_000) {
    await this.page.waitForURL(/\/services\/modules\/?$/, { timeout })
    await expect(this.page.getByRole("heading", { name: "Modules", exact: true })).toBeVisible({
      timeout,
    })
  }

  async search(name: string) {
    await this.searchInput.fill(name)
    await waitForUiSettle(this.page)
  }

  private rowForModule(name: string) {
    return this.page
      .getByRole("row")
      .filter({ has: this.page.getByRole("cell", { name, exact: true }) })
  }

  async createModule(name: string) {
    await this.newModuleButton.click()
    await this.page.getByPlaceholder("Enter Module name").fill(name)
    await this.page.getByRole("button", { name: "Create" }).click()
    await expectToast(this.page, "New module added")
    await waitForUiSettle(this.page)
  }

  async openModuleDetails(name: string) {
    await this.search(name)
    await this.page.getByRole("cell", { name, exact: true }).click()
    await this.page.waitForURL(/\/services\/modules\/[0-9a-f-]{36}/)
  }

  async openTagGlossaryDialog(moduleName: string) {
    await this.search(moduleName)
    await this.rowForModule(moduleName).getByRole("button").last().click()
    await this.page.getByRole("menuitem", { name: "Tag glossary" }).click()
    await expect(this.page.getByRole("dialog", { name: "Tag Glossary" })).toBeVisible()
  }

  async tagGlossaryToModule(moduleName: string, glossaryName: string) {
    await this.openTagGlossaryDialog(moduleName)

    const dialog = this.page.getByRole("dialog", { name: "Tag Glossary" })
    await dialog.getByRole("combobox").click()
    await dialog.getByPlaceholder("Search glossary...").fill(glossaryName)

    await dialog.getByRole("option").filter({ hasText: glossaryName }).first().click()
    await this.page.keyboard.press("Escape")
    await dialog.getByRole("button", { name: "Save" }).click()
    await expectToast(this.page, "Glossaries updated")
    await waitForUiSettle(this.page)
  }
}

/** Module details (/services/modules/:id). */
export class ModuleDetailsPage {
  readonly page: Page
  readonly detailsTab: Locator
  readonly glossaryTab: Locator

  constructor(page: Page) {
    this.page = page
    this.detailsTab = page.getByRole("tab", { name: "Details" })
    this.glossaryTab = page.getByRole("tab", { name: "Glossary" })
  }

  async waitForReady(moduleName: string, timeout = 45_000) {
    await this.page.waitForURL(/\/services\/modules\/[0-9a-f-]{36}/, { timeout })
    await expect(this.detailsTab).toBeVisible({ timeout })
    await expect(this.page.getByText(moduleName, { exact: true }).first()).toBeVisible({
      timeout,
    })
  }

  async openGlossaryTab() {
    await this.glossaryTab.click()
    await expect(
      this.page.getByRole("heading", { name: /Tagged Glossaries/ }),
    ).toBeVisible()
  }

  async openDetailsTab() {
    await this.detailsTab.click()
    await expect(this.page.getByRole("heading", { name: "About" })).toBeVisible()
  }

  async expectGlossaryTagged(glossaryName: string) {
    await expect(
      this.page.getByRole("cell", { name: glossaryName, exact: true }),
    ).toBeVisible()
  }

  async expectNoGlossariesTagged() {
    await expect(
      this.page.getByText("No glossaries tagged to this module"),
    ).toBeVisible()
  }
}
