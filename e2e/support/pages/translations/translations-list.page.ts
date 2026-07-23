import { expect, type Locator, type Page } from "@playwright/test"
import { waitForToast, waitForUiSettle } from "../../utils/wait-for"

/** Translations list — filters, tabs, search, publish. */
export class TranslationsListPage {
  readonly page: Page
  readonly translationKeysTab: Locator
  readonly historyTab: Locator
  readonly modulesFilter: Locator
  readonly missingTranslationsFilter: Locator
  readonly createDateFilter: Locator
  readonly lastUpdateDateFilter: Locator
  readonly viewButton: Locator
  readonly autoTranslateAllButton: Locator
  readonly newKeyButton: Locator
  readonly publishChangesButton: Locator
  readonly keySearchInput: Locator

  constructor(page: Page) {
    this.page = page
    this.translationKeysTab = page.getByRole("tab", { name: "Translation Keys" })
    this.historyTab = page.getByRole("tab", { name: "History" })
    this.modulesFilter = page.getByRole("button", { name: "Modules" })
    this.missingTranslationsFilter = page.getByRole("button", {
      name: "Missing Translations",
    })
    this.createDateFilter = page.getByRole("button", { name: "Create Date" })
    this.lastUpdateDateFilter = page.getByRole("button", {
      name: "Last Update Date",
    })
    this.viewButton = page.getByRole("button", { name: "View" })
    this.autoTranslateAllButton = page.getByRole("button", {
      name: "Auto-translate all",
    })
    this.newKeyButton = page.getByRole("button", { name: "New Key" })
    this.publishChangesButton = page.getByRole("button", {
      name: "Publish Changes",
    })
    this.keySearchInput = page.getByRole("textbox", { name: "Search..." }).first()
  }

  async goto(projectId: string) {
    await this.page.goto(`/app/${projectId}/services/language`)
    await this.waitForReady()
  }

  async openFromSidebar() {
    await this.page.getByRole("link", { name: "Translations" }).click()
    await this.waitForReady()
  }

  async waitForReady(timeout = 45_000) {
    await this.page.waitForURL(/\/services\/language/, { timeout })
    await this.translationKeysTab.waitFor({ state: "visible", timeout })
    await expect(this.page.getByText("Configure keys")).toBeVisible({ timeout })
  }

  private overflowMenuTrigger() {
    return this.page
      .getByRole("button", { name: "Publish Changes" })
      .locator("xpath=preceding-sibling::button[1]")
  }

  async applyModuleFilters(modules: string[]) {
    await this.modulesFilter.click()
    const suggestions = this.page.getByLabel("Suggestions")

    for (const moduleName of modules) {
      const option = suggestions.getByText(moduleName, { exact: true })
      const hasOption = await option.isVisible({ timeout: 5_000 }).catch(() => false)
      if (hasOption) {
        await option.click()
      }
    }

    await this.page.keyboard.press("Escape")
    await waitForUiSettle(this.page)
  }

  /**
   * Pick a language in Missing Translations (e.g. German).
   * If the option is missing or nothing matches, close the popover and continue.
   */
  async applyMissingTranslationFilter(languageName = "German") {
    await this.missingTranslationsFilter.click()

    const option = this.page.getByRole("option", { name: languageName, exact: true })
    const hasOption = await option.isVisible({ timeout: 5_000 }).catch(() => false)

    if (hasOption) {
      await option.click()
      await waitForUiSettle(this.page)
    }

    await this.page.keyboard.press("Escape")
    await waitForUiSettle(this.page)
  }

  async applyDateRangeFilter(
    filter: "create" | "lastUpdate",
    startDay: number,
    endDay: number,
  ) {
    const trigger =
      filter === "create" ? this.createDateFilter : this.lastUpdateDateFilter

    await trigger.click()

    const popover = this.page.locator('[data-radix-popper-content-wrapper]:visible').last()
    // Dual-month popover: scope to the left/current month grid only.
    const monthGrid = popover.getByRole("grid").first()

    const clickDay = async (day: number) => {
      await monthGrid
        .getByRole("gridcell", { name: String(day), exact: true, disabled: false })
        .click()
    }

    await clickDay(startDay)
    await clickDay(endDay)
    await popover.getByRole("button", { name: "Apply" }).click()
    await waitForUiSettle(this.page)
  }

  async resetFilters() {
    const tabReset = this.page
      .getByLabel("Translation Keys")
      .getByRole("button", { name: "Reset" })

    if (await tabReset.isVisible().catch(() => false)) {
      await tabReset.click()
    }

    const globalReset = this.page.getByRole("button", { name: "Reset" })
    if (await globalReset.isVisible().catch(() => false)) {
      await globalReset.click()
    }

    await waitForUiSettle(this.page)
  }

  async toggleViewLanguage(languageName: string, enabled: boolean) {
    await this.viewButton.click()
    const item = this.page.getByRole("menuitemcheckbox", { name: languageName })
    const checked = await item.getAttribute("aria-checked")

    if ((checked === "true") !== enabled) {
      await item.click()
    }

    await this.page.keyboard.press("Escape")
  }

  async openHistoryTab() {
    await this.historyTab.click()
    await expect(this.page.getByRole("heading", { name: "History" })).toBeVisible()
  }

  async openTranslationKeysTab() {
    await this.translationKeysTab.click()
    await expect(this.page.getByRole("heading", { name: "Translations" })).toBeVisible()
  }

  async confirmDialog(buttonName: string | RegExp) {
    await this.page.getByRole("button", { name: buttonName }).click()
  }

  async autoTranslateAll() {
    await this.autoTranslateAllButton.click()
    await this.confirmDialog("Yes")
    await waitForToast(this.page, /translation in progress|Processing Translation/i)
    await waitForUiSettle(this.page, 15_000)
  }

  async publishChanges() {
    await this.publishChangesButton.click()
    await this.confirmDialog("Publish")
    await waitForToast(this.page, /File generation is in progress|Success/i)
    await waitForUiSettle(this.page, 15_000)
  }

  async searchKey(keyName: string) {
    await this.keySearchInput.fill(keyName)
    await waitForUiSettle(this.page)
  }

  async expectKeyVisible(keyName: string) {
    await expect(this.page.getByText(keyName, { exact: true }).first()).toBeVisible()
  }

  async openKeyDetails(keyName: string) {
    await this.searchKey(keyName)
    await this.page.getByText(keyName, { exact: true }).first().click()
    await this.page.waitForURL(/\/services\/language\/translations\//)
  }

  async openImportKeysDialog() {
    await this.overflowMenuTrigger().click()
    await this.page.getByText("Import keys").click()
    await expect(this.page.getByRole("heading", { name: /Import/i })).toBeVisible()
  }

  async closeDialog() {
    await this.page.getByRole("button", { name: "Close" }).click()
  }

  async openNewKeyForm() {
    await this.newKeyButton.click()
    await this.page.waitForURL(/\/translations\/new-key/)
  }
}

/** Alias kept for fixtures */
export class TranslationsPage extends TranslationsListPage {}
