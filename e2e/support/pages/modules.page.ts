import { type Page, type Locator, expect } from "@playwright/test";

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
    await this.page.getByRole("button", { name: "Close" }).click({ force: true });
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
