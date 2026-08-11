import { expect, type Locator, type Page } from "@playwright/test";
import { expectToast } from "../../test-base";
import { waitForUiSettle } from "../../utils/wait-for";

export type GlossaryInput = {
  name: string;
  language?: string;
  type?: string;
  moduleNames?: string[];
  context?: string;
  additionalNote?: string;
};

/** Glossary list (/services/glossary). */
export class GlossaryListPage {
  readonly page: Page;
  readonly newGlossaryButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newGlossaryButton = page.getByRole("button", { name: "New Glossary" });
    this.searchInput = page.getByPlaceholder("Search glossary...");
  }

  async openFromSidebar() {
    await this.page.getByRole("link", { name: "Glossary" }).click();
    await this.waitForReady();
  }

  async waitForReady(timeout = 45_000) {
    await this.page.waitForURL(/\/services\/glossary\/?$/, { timeout });
    await expect(this.page.getByRole("heading", { name: "Glossary Management" })).toBeVisible({
      timeout,
    });
  }

  async search(name: string) {
    await this.searchInput.fill(name);
    // Glossary search debounces at 400ms.
    await this.page.waitForTimeout(500);
    await waitForUiSettle(this.page);
  }

  private rowForName(name: string) {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name, exact: true }),
    });
  }

  async expectVisible(name: string) {
    await expect(this.rowForName(name).first()).toBeVisible();
  }

  async expectNotVisible(name: string) {
    await expect(this.rowForName(name)).toHaveCount(0);
  }

  async openNewGlossaryDialog() {
    await this.newGlossaryButton.click();
    await expect(this.page.getByRole("dialog", { name: "Add Glossary" })).toBeVisible();
  }

  async openRowMenu(name: string) {
    await this.rowForName(name).getByRole("button").last().click();
  }

  async deleteGlossary(name: string) {
    await this.search(name);
    await expect(this.rowForName(name).first()).toBeVisible();

    await this.rowForName(name).first().getByRole("button").last().click();
    const deleteItem = this.page.getByRole("menuitem", { name: "Delete" });
    await deleteItem.waitFor({ state: "visible" });
    await deleteItem.click();

    await this.page
      .getByRole("dialog", { name: "Delete Glossary Item" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expectToast(this.page, "Glossary item deleted successfully.");
    await waitForUiSettle(this.page);
  }
}

/** Add / Edit Glossary dialog. */
export class GlossaryFormPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private dialog() {
    return this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", { name: /Add Glossary|Edit Glossary/ }),
    });
  }

  async selectLanguage(languageName: string) {
    const dialog = this.dialog();
    await dialog.getByRole("button", { name: "Language" }).click();
    await this.page.getByRole("option", { name: languageName, exact: true }).click();
  }

  async selectType(typeName: string) {
    const dialog = this.dialog();
    await dialog.getByRole("combobox", { name: "Type" }).click();
    await this.page.getByRole("option", { name: typeName, exact: true }).click();
  }

  async tagModules(moduleNames: string[]) {
    const dialog = this.dialog();

    for (const moduleName of moduleNames) {
      await dialog.getByRole("combobox", { name: "Tag modules..." }).click();
      const option = this.page.getByRole("option", { name: moduleName, exact: true });
      const hasOption = await option.isVisible({ timeout: 5_000 }).catch(() => false);
      if (hasOption) {
        await option.click();
      }
      await this.page.keyboard.press("Escape");
    }
  }

  async create(input: GlossaryInput) {
    const dialog = this.dialog();
    await dialog.getByRole("textbox", { name: /Name/i }).fill(input.name);

    if (input.language) {
      await this.selectLanguage(input.language);
    }

    if (input.type) {
      await this.selectType(input.type);
    }

    if (input.moduleNames?.length) {
      await this.tagModules(input.moduleNames);
    }

    await dialog.getByRole("button", { name: "Add" }).click();
    await expectToast(this.page, "Glossary item added successfully.");
    await waitForUiSettle(this.page);
  }
}
