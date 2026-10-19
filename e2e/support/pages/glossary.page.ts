import { type Page, type Locator, expect } from "@playwright/test";
import { expectActionsColumnIsLast } from "../table-helpers";

export class GlossaryPage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly newGlossaryButton: Locator;
  private readonly glossaryDescription: Locator;
  private readonly noGlossariesMessage: Locator;
  private readonly firstGlossaryRow: Locator;
  private readonly addGlossaryDialog: Locator;
  private readonly glossaryNameInput: Locator;
  private readonly definitionInput: Locator;
  private readonly internalNoteInput: Locator;
  private readonly editDialog: Locator;
  private readonly deleteDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "Glossary Management" });
    this.newGlossaryButton = page.getByRole("button", { name: "New Glossary" });
    this.glossaryDescription = page.getByText("Glossaries help keep");
    this.noGlossariesMessage = page.getByText("No glossaries yet");
    this.firstGlossaryRow = page.getByRole("row").nth(1);
    this.addGlossaryDialog = page.getByRole("dialog", { name: "Add term" });
    this.glossaryNameInput = page.getByRole("textbox", { name: "Name *" });
    this.definitionInput = page.getByRole("textbox", { name: "Definition" });
    this.internalNoteInput = page.getByRole("textbox", { name: "Internal note" });
    this.editDialog = page.getByRole("dialog", { name: "Edit term" });
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

  async expectActionsColumnIsLastIfTableVisible() {
    const headers = this.page.locator("thead tr").first().locator("th");
    if ((await headers.count()) === 0) return;
    await expectActionsColumnIsLast(this.page);
  }

  async searchGlossaries(query: string) {
    const searchInput = this.page.getByPlaceholder("Search glossary...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill(query);
  }

  async expectNoMatchingGlossaries() {
    await expect(this.page.getByText("No matching glossaries", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
  }

  async clearSearch() {
    await this.page.getByRole("button", { name: "Clear search" }).click();
  }

  async expectGlossaryRowVisible(name: string) {
    await expect(this.page.getByRole("row").filter({ hasText: name })).toBeVisible({
      timeout: 10_000,
    });
  }

  /** The open editor sheet, whether adding or editing. */
  get editorSheet() {
    return this.addGlossaryDialog.or(this.editDialog);
  }

  async openNewGlossaryDialog() {
    await this.newGlossaryButton.click();
    await expect(this.page.getByRole("heading", { name: "Add term" })).toBeVisible();
  }

  async expectEditorSectionsInOrder() {
    const headings = this.editorSheet.getByRole("heading", { level: 3 });
    await expect(headings).toHaveText(["Term", "Translations", "Meaning", "Scope"]);
    await expect(this.editorSheet.getByRole("button", { name: "Internal note" })).toBeVisible();
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

  async setRule(rule: "Translate" | "Keep" | "Forbidden") {
    await this.editorSheet.getByRole("radio", { name: rule }).click();
  }

  /** Scope "Specific modules" tags the given modules, or the first available one. */
  async setScope(scope: "Whole project" | "Specific modules", modules?: string[]) {
    await this.editorSheet.getByRole("radio", { name: scope }).click();
    if (scope === "Whole project" || modules?.length === 0) return;
    await this.editorSheet.getByRole("combobox", { name: "Tag modules" }).click();
    if (modules) {
      for (const module of modules) {
        await this.page.getByRole("option", { name: module }).click();
      }
    } else {
      // Module names differ per project — tag the first available module.
      const firstOption = this.page.getByRole("option").first();
      await expect(firstOption).toBeVisible();
      await firstOption.click();
    }
    await this.page.keyboard.press("Escape");
  }

  /** Culture codes of the translation rows (non-default project languages), in order. */
  async getTranslationCodes(): Promise<string[]> {
    const labels = await this.editorSheet.getByPlaceholder("Approved translation").evaluateAll(
      (inputs) =>
        inputs.map((input) => {
          const label = document.querySelector(`label[for="${input.id}"]`)?.textContent ?? "";
          return /\(([^()]+)\)$/.exec(label)?.[1] ?? "";
        }),
    );
    return labels.filter(Boolean);
  }

  private translationInput(code: string) {
    return this.editorSheet.locator(`input[id="glossary-translation-${code}"]`);
  }

  async fillTranslation(code: string, value: string) {
    await this.translationInput(code).fill(value);
  }

  async addVariant(value: string) {
    const input = this.editorSheet.getByRole("textbox", { name: "Variants" });
    await input.fill(value);
    await input.press("Enter");
  }

  async addForbidden(code: string, value: string) {
    const input = this.editorSheet.locator(`input[id="glossary-forbidden-${code}"]`);
    if (!(await input.isVisible())) {
      // Translate rule: the forbidden alternatives sit in a collapsed section per language.
      await this.translationInput(code)
        .locator("xpath=..")
        .getByRole("button", { name: /Forbidden alternatives/ })
        .click();
    }
    await input.fill(value);
    await input.press("Enter");
  }

  async fillDefinition(text: string) {
    await expect(this.definitionInput).toBeVisible();
    await this.definitionInput.fill(text);
  }

  async fillInternalNote(text: string) {
    if (!(await this.internalNoteInput.isVisible())) {
      await this.editorSheet.getByRole("button", { name: "Internal note" }).click();
    }
    await this.internalNoteInput.fill(text);
  }

  async clickSaveButton() {
    await this.editorSheet.getByRole("button", { name: "Save" }).click();
  }

  /** Saves and returns the body of the Glossary/Save request. */
  async saveAndCapturePayload(): Promise<Record<string, unknown>> {
    const requestPromise = this.page.waitForRequest(
      (request) => request.method() === "POST" && /\/Glossary\/Save/.test(request.url()),
    );
    await this.clickSaveButton();
    return (await requestPromise).postDataJSON() as Record<string, unknown>;
  }

  /**
   * Creates a glossary whose stored `additionalNote` is exactly `additionalNote`, as another
   * client (extension, CLI) or an older UI would have written it. The term is created through
   * the UI, and its Glossary/Save request body is rewritten in flight, so the app's own
   * authenticated request stores the fixture.
   */
  async createGlossaryWithStoredNote(name: string, additionalNote: string) {
    const pattern = /\/Glossary\/Save/;
    await this.page.route(pattern, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      await route.continue({
        postData: JSON.stringify({ ...body, context: "", additionalNote }),
      });
    });
    try {
      await this.openNewGlossaryDialog();
      await this.fillGlossaryName(name);
      await this.clickSaveButton();
      await this.expectAddSuccess(name);
    } finally {
      await this.page.unroute(pattern);
    }
  }

  async deleteGlossaryFromList(name: string) {
    await this.searchGlossaries(name);
    await this.openDeleteGlossaryDialog(name);
    await this.confirmDeleteGlossary();
    await expect(
      this.page.getByText("Glossary item deleted successfully.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await this.clearSearch();
  }

  async openEditFromList(name: string) {
    await this.searchGlossaries(name);
    await this.waitForRowMenuButton(name);
    await this.getRowMenuButton(name).click();
    await this.page.getByRole("menuitem", { name: "Edit" }).click();
    await expect(this.editDialog).toBeVisible();
  }

  async expectInternalNote(value: string) {
    await expect(this.internalNoteInput).toHaveValue(value);
  }

  async expectFieldError(message: string) {
    await expect(this.editorSheet.getByText(message, { exact: true }).first()).toBeVisible();
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
    await expect(this.page.getByRole("heading", { name: "Translations" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Details" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Definition" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Internal Note" })).toBeVisible();
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
    await this.editDialog.getByRole("button", { name: "Save" }).click();
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

  async expectNoTaggedKeys() {
    await expect(
      this.page.getByText("No keys are tagged with this glossary.", { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText("Failed to load tagged keys.", { exact: true })).toBeHidden();
  }

  async expectDeleteUsage(text: string | RegExp) {
    await expect(this.deleteDialog.getByText(text)).toBeVisible({ timeout: 15_000 });
  }

  async expectDuplicateNameWarning(existingName: string) {
    await expect(this.page.getByText(`'${existingName}' already exists.`)).toBeVisible({
      timeout: 10_000,
    });
    await expect(this.page.getByRole("button", { name: "Open it" })).toBeVisible();
  }

  async expectNoDuplicateNameWarning() {
    // The check is debounced by 300 ms; give it time to settle before asserting absence.
    await this.page.waitForTimeout(1_000);
    await expect(this.page.getByText(/already exists\./)).toBeHidden();
  }

  async openDuplicateGlossary() {
    await this.page.getByRole("button", { name: "Open it" }).click();
  }
}
