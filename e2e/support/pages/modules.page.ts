import { type Page, type Locator, expect } from "@playwright/test";
import { expectActionsColumnIsLast } from "../table-helpers";

export class ModulesPage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly newModuleButton: Locator;
  private readonly table: Locator;
  private readonly moduleNameInput: Locator;
  private readonly createButton: Locator;
  private readonly moduleNameError: Locator;
  private readonly newModuleHeading: Locator;
  private readonly moduleAddedMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "Language Modules" });
    this.newModuleButton = page.getByRole("button", { name: "New Module" });
    this.table = page.getByTestId("module-table");
    this.moduleNameInput = page.getByRole("textbox", { name: "Enter Module name" });
    this.createButton = page.getByRole("button", { name: "Create" });
    this.moduleNameError = page.getByText("Module name is required", { exact: true });
    this.newModuleHeading = page.getByRole("heading", { name: "New module" });
    this.moduleAddedMessage = page.getByText("New module added", { exact: true });
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.newModuleButton).toBeVisible();
  }

  async expectSearchVisible() {
    await expect(this.page.getByRole("textbox", { name: "Search modules..." })).toBeVisible();
  }

  async searchModules(query: string) {
    const searchInput = this.page.getByRole("textbox", { name: "Search modules..." });
    await expect(searchInput).toBeVisible();
    await searchInput.fill(query);
  }

  async expectTableHeadersVisible() {
    await expect(this.page.getByRole("columnheader", { name: "Module Name" })).toBeVisible();
    await expect(this.page.getByRole("columnheader", { name: "Created By" })).toBeVisible();
    await expect(this.page.getByRole("columnheader", { name: "Created Date" })).toBeVisible();
    await expect(this.page.getByRole("columnheader", { name: "Actions" })).toBeVisible();
  }

  async expectActionsColumnIsLast() {
    await expectActionsColumnIsLast(this.page);
  }

  async openNewModuleDialog() {
    await this.newModuleButton.click();
    await expect(this.newModuleHeading).toBeVisible();
  }

  async expectModuleNameInputVisible() {
    await expect(this.moduleNameInput).toBeVisible();
  }

  async fillModuleName(name: string) {
    await this.moduleNameInput.fill(name);
  }

  async expectModuleNameErrorVisible() {
    await expect(this.moduleNameError).toBeVisible({ timeout: 10_000 });
  }

  async clickCreateButton() {
    await expect(this.createButton).toBeVisible();
    await this.createButton.click();
  }

  async expectModuleAddedSuccess() {
    await expect(this.moduleAddedMessage).toBeVisible({ timeout: 20_000 });
  }

  async closeNewModuleDialog() {
    // The dialog animates in and re-centres when its content height changes, so a
    // forced click on the small X can miss it. Click normally and confirm it closed.
    const dialog = this.page.getByRole("dialog");
    await expect(async () => {
      if (await dialog.isVisible()) {
        await dialog.getByRole("button", { name: "Close" }).click({ timeout: 2_000 });
      }
      await expect(dialog).toBeHidden({ timeout: 2_000 });
    }).toPass({ timeout: 15_000 });
  }

  getRowMenuButton(moduleName: string) {
    const row = this.page.getByRole("row").filter({ hasText: moduleName });
    return row.getByRole("button").filter({
      has: this.page.locator("svg.lucide-ellipsis-vertical"),
    });
  }

  async waitForRowMenuButton(moduleName: string, timeout = 20_000) {
    const menuButton = this.getRowMenuButton(moduleName);
    await expect(menuButton).toBeVisible({ timeout });
  }

  async openEditModuleDialog(moduleName: string) {
    await this.waitForRowMenuButton(moduleName);
    const menuButton = this.getRowMenuButton(moduleName);
    await menuButton.click();
    await expect(this.page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
    await this.page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(this.page.getByRole("heading", { name: "Edit Module" })).toBeVisible();
  }

  async openTagGlossaryDialog(moduleName: string) {
    await this.waitForRowMenuButton(moduleName);
    const menuButton = this.getRowMenuButton(moduleName);
    await menuButton.click();
    await expect(this.page.getByRole("menuitem", { name: "Tag glossary" })).toBeVisible();
    await this.page.getByRole("menuitem", { name: "Tag glossary" }).click();
    await expect(this.page.getByRole("heading", { name: "Tag Glossary" })).toBeVisible();
  }

  getModuleRow(moduleName: string) {
    return this.page.getByRole("row").filter({ hasText: moduleName });
  }

  async createModule(moduleName: string) {
    await this.openNewModuleDialog();
    await this.fillModuleName(moduleName);
    await this.clickCreateButton();
    await this.expectModuleAddedSuccess();
    await this.searchModules(moduleName);
    await expect(this.getModuleRow(moduleName)).toBeVisible({ timeout: 10_000 });
  }

  get deleteModuleDialog() {
    return this.page
      .getByRole("dialog")
      .filter({ has: this.page.getByRole("heading", { name: "Delete module" }) });
  }

  get confirmDeleteModuleButton() {
    return this.deleteModuleDialog.getByRole("button", { name: "Delete", exact: true });
  }

  async openDeleteModuleDialog(moduleName: string) {
    await this.waitForRowMenuButton(moduleName);
    await this.getRowMenuButton(moduleName).click();
    const deleteItem = this.page.getByRole("menuitem", { name: "Delete", exact: true });
    await expect(deleteItem).toBeVisible();
    await deleteItem.click();
    await expect(this.deleteModuleDialog).toBeVisible();
  }

  get goToModuleButton() {
    return this.deleteModuleDialog.getByRole("button", { name: "Go to module" });
  }

  async expectDeleteConfirmationForEmptyModule(moduleName: string) {
    await expect(
      this.deleteModuleDialog.getByText(`Are you sure you want to delete ${moduleName}?`),
    ).toBeVisible({ timeout: 10_000 });
    await expect(this.confirmDeleteModuleButton).toBeEnabled();
    await expect(this.goToModuleButton).toHaveCount(0);
  }

  async expectModuleDeleted(moduleName: string) {
    await expect(this.page.getByText("Module deleted", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(this.deleteModuleDialog).toBeHidden();
    await this.searchModules(moduleName);
    await expect(this.getModuleRow(moduleName)).toHaveCount(0, { timeout: 15_000 });
  }

  async deleteModuleIfPresent(moduleName: string) {
    try {
      await this.searchModules(moduleName);
      const row = this.getModuleRow(moduleName);
      await row.first().waitFor({ state: "visible", timeout: 5_000 });
      await this.openDeleteModuleDialog(moduleName);
      await this.confirmDeleteModuleButton.click();
      await expect(row).toHaveCount(0, { timeout: 15_000 });
    } catch (error) {
      console.warn('[e2e] Cleanup could not delete module "%s":', moduleName, error);
    }
  }

  async openModuleDetails(cellText: string) {
    await this.page.getByRole("cell", { name: cellText }).first().click();
    await expect(this.page.getByRole("tab", { name: "Details" })).toBeVisible({ timeout: 15_000 });
  }

  async expectDetailsTabLoaded() {
    await expect(this.page.getByRole("heading", { name: "About" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Module Name" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Created By" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Created Date" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Last Update Date" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Last Updated By" })).toBeVisible();
  }

  async switchToGlossaryTab() {
    await this.page.getByRole("tab", { name: "Glossary" }).click();
    await expect(this.page.getByRole("tab", { name: "Glossary" })).toBeVisible();
  }

  async expectGlossaryTabLoaded() {
    await expect(this.page.getByRole("heading", { name: /Tagged Glossaries/ })).toBeVisible({ timeout: 15_000 });
  }

  async expectNoGlossariesTaggedOrTableVisible() {
    const noGlossariesTagged = this.page.getByText(/No glossaries tagged to this/);
    const taggedGlossariesTable = this.page.getByRole("table");
    await expect(noGlossariesTagged.or(taggedGlossariesTable).first()).toBeVisible({ timeout: 15_000 });
  }
}
