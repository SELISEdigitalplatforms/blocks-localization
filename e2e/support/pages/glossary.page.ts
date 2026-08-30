import { type Page, type Locator, expect } from "@playwright/test";

export class GlossaryPage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly newGlossaryButton: Locator;
  private readonly glossaryDescription: Locator;
  private readonly noGlossariesMessage: Locator;
  private readonly firstGlossaryRow: Locator;
  private readonly addGlossaryDialog: Locator;
  private readonly glossaryNameInput: Locator;
  private readonly contextInput: Locator;
  private readonly additionalNotesInput: Locator;
  private readonly addButton: Locator;
  private readonly editDialog: Locator;
  private readonly deleteDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "Glossary Management" });
    this.newGlossaryButton = page.getByRole("button", { name: "New Glossary" });
    this.glossaryDescription = page.getByText("Glossaries help keep");
    this.noGlossariesMessage = page.getByText("No glossaries yet");
    this.firstGlossaryRow = page.getByRole("row").nth(1);
    this.addGlossaryDialog = page.getByRole("dialog", { name: "Add Glossary" });
    this.glossaryNameInput = page.getByRole("textbox", { name: "Name *" });
    this.contextInput = page.getByRole("textbox", { name: "Context" });
    this.additionalNotesInput = page.getByRole("textbox", { name: "Additional Notes" });
    this.addButton = page.getByRole("button", { name: "Add" });
    this.editDialog = page.getByRole("dialog", { name: "Edit Glossary" });
    this.deleteDialog = page.getByRole("dialog", { name: "Delete Glossary Item" });
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    if (await this.noGlossariesMessage.isVisible().catch(() => false)) {
      await expect(this.glossaryDescription).toBeVisible({ timeout: 10_000 });
    } else {
      await expect(this.firstGlossaryRow).toBeVisible({ timeout: 10_000 });
    }
    await expect(this.newGlossaryButton).toBeVisible();
  }

  async openNewGlossaryDialog() {
    await this.newGlossaryButton.click();
    await expect(this.page.getByRole("heading", { name: "Add Glossary" })).toBeVisible();
  }

  async expectAddGlossaryDialogLoaded() {
    await expect(this.page.getByText("Name *")).toBeVisible();
    await expect(this.glossaryNameInput).toBeVisible();
  }

  async fillGlossaryName(name: string) {
    await this.glossaryNameInput.fill(name);
  }

  async selectLanguage(language: string) {
    const languageField = this.addGlossaryDialog.getByRole("button", { name: "Language" });
    await expect(languageField).toBeVisible();
    await languageField.click();
    await expect(this.page.getByRole("option", { name: language })).toBeVisible({ timeout: 10_000 });
    await this.page.getByRole("option", { name: language }).click();
  }

  async selectType(type: string) {
    const typeField = this.addGlossaryDialog.getByText("Type", { exact: true });
    await expect(typeField).toBeVisible();
    await typeField.click();
    await expect(this.page.getByRole("option", { name: type })).toBeVisible();
    await this.page.getByRole("option", { name: type }).click();
  }

  async toggleGlobalContext() {
    const globalContextCheckbox = this.page.getByRole("checkbox", { name: "Add to global context" });
    await expect(globalContextCheckbox).toBeVisible();
    await globalContextCheckbox.click();
  }

  async selectTagModule(module: string) {
    const tagModules = this.page.getByText("Tag modules...", { exact: true });
    await expect(tagModules).toBeVisible();
    await tagModules.click();
    await expect(this.page.getByRole("option", { name: module })).toBeVisible();
    await this.page.getByRole("option", { name: module }).click();
  }

  async fillContext(text: string) {
    await expect(this.addGlossaryDialog.getByText("Context", { exact: true })).toBeVisible();
    await expect(this.contextInput).toBeVisible();
    await this.contextInput.fill(text);
  }

  async fillAdditionalNotes(text: string) {
    await expect(this.addGlossaryDialog.getByText("Additional Notes", { exact: true })).toBeVisible();
    await expect(this.additionalNotesInput).toBeVisible();
    await this.additionalNotesInput.fill(text);
  }

  async clickAddButton() {
    await expect(this.addButton).toBeVisible();
    await this.addButton.click();
  }

  async expectAddSuccess(glossaryName: string) {
    const successMessage = this.page
      .getByText("Glossary item added successfully.", { exact: true })
      .or(this.page.getByText("Glossary added successfully.", { exact: true }))
      .or(this.page.getByText(/glossary.*added successfully/i))
      .first();
    const newGlossaryRow = this.page.getByRole("row").filter({ hasText: glossaryName });
    await expect
      .poll(
        async () => {
          if (await successMessage.isVisible().catch(() => false)) return "toast";
          if (await newGlossaryRow.isVisible().catch(() => false)) return "row";
          return null;
        },
        { timeout: 20_000, intervals: [200, 500, 1000] },
      )
      .not.toBeNull();
  }

  async openGlossaryDetail(glossaryName: string) {
    await this.page.getByRole("row").filter({ hasText: glossaryName }).click();
    await expect(this.page.getByRole("heading", { name: glossaryName })).toBeVisible({ timeout: 15_000 });
  }

  async expectDetailSections() {
    await expect(this.page.getByRole("heading", { name: "Details" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Context" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Additional Notes" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Tagged Keys" })).toBeVisible();
  }

  async clickEditButton() {
    await this.page.getByRole("button", { name: "Edit" }).click();
    await expect(this.editDialog).toBeVisible();
  }

  async expectEditDialogLoaded() {
    await expect(this.editDialog).toBeVisible();
    const nameField = this.editDialog.getByRole("textbox", { name: "Name *" });
    await expect(nameField).toBeVisible();
  }

  async fillEditName(name: string) {
    const nameField = this.editDialog.getByRole("textbox", { name: "Name *" });
    await nameField.fill(name);
  }

  async clickUpdateButton() {
    await this.editDialog.getByRole("button", { name: "Update" }).click();
  }

  async expectEditSuccess(name: string) {
    await expect(this.page.getByText("Glossary item updated successfully.", { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole("heading", { name: name })).toBeVisible({ timeout: 15_000 });
  }

  async goBackToList() {
    await this.page.getByRole("link", { name: "Glossaries" }).click();
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  getRowMenuButton(glossaryName: string) {
    const row = this.page.getByRole("row").filter({ hasText: glossaryName });
    return row.getByRole("button").filter({
      has: this.page.locator("svg.lucide-ellipsis-vertical"),
    });
  }

  async waitForRowMenuButton(glossaryName: string, timeout = 20_000) {
    const menuButton = this.getRowMenuButton(glossaryName);
    await expect(menuButton).toBeVisible({ timeout });
  }

  async openDeleteGlossaryDialog(glossaryName: string) {
    await this.waitForRowMenuButton(glossaryName);
    const menuButton = this.getRowMenuButton(glossaryName);
    await menuButton.click();
    await expect(this.page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
    await this.page.getByRole("menuitem", { name: "Delete" }).click();
    await expect(this.deleteDialog).toBeVisible();
  }

  async confirmDeleteGlossary() {
    await this.deleteDialog.getByRole("button", { name: "Delete" }).click();
  }
}
