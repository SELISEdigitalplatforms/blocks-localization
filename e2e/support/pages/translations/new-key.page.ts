import { type Locator, type Page } from "@playwright/test"
import { waitForToast, waitForUiSettle } from "../../utils/wait-for"

export type NewKeyInput = {
  keyName: string
  moduleName: string
  defaultValue: string
  context?: string
  route?: string
}

/** New key form (/translations/new-key). */
export class NewKeyPage {
  readonly page: Page
  readonly keyNameInput: Locator
  readonly moduleCombobox: Locator
  readonly defaultValueInput: Locator
  readonly contextInput: Locator
  readonly saveButton: Locator

  constructor(page: Page) {
    this.page = page
    this.keyNameInput = page.getByRole("textbox", { name: "Key name" })
    this.moduleCombobox = page.getByRole("combobox", { name: "Module" })
    this.defaultValueInput = page.getByRole("textbox", {
      name: "Default value (English)",
    })
    this.contextInput = page.getByRole("textbox", { name: "Key Context" })
    this.saveButton = page.getByRole("button", { name: "Save" })
  }

  async waitForReady() {
    await this.page.waitForURL(/\/translations\/new-key/)
    await this.keyNameInput.waitFor({ state: "visible" })
  }

  async fillForm(input: NewKeyInput) {
    await this.keyNameInput.fill(input.keyName)
    await this.moduleCombobox.click()
    await this.page.getByRole("option", { name: input.moduleName }).click()
    await this.defaultValueInput.fill(input.defaultValue)

    if (input.context) {
      await this.contextInput.fill(input.context)
    }
  }

  async autoTranslateDefaultValue() {
    await this.page.getByRole("button", { name: "Auto-Translate" }).first().click()
    await waitForToast(this.page, /Translated successfully|Success/i)
  }

  async addRoute(route: string) {
    await this.page.getByRole("button", { name: "Add Route" }).click()
    await this.page.getByRole("textbox", { name: "Route" }).fill(route)
  }

  async save() {
    await this.saveButton.click()
    await waitForToast(this.page, /Language key added|Success/i)
    await this.page.waitForURL(/\/services\/language$/)
    await waitForUiSettle(this.page)
  }

  async createKey(input: NewKeyInput) {
    await this.fillForm(input)

    if (input.route) {
      await this.addRoute(input.route)
    }

    await this.autoTranslateDefaultValue()
    await this.save()
  }
}
