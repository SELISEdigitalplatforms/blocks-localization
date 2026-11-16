import { type Page, type Locator, expect } from "@playwright/test";
import { expectActionsColumnIsLast } from "../table-helpers";

export type GlossaryTableFilter = "Rule" | "Status" | "Language" | "Type" | "Scope";

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

    this.heading = page.getByRole("heading", { name: "Glossary", exact: true });
    this.newGlossaryButton = page.getByRole("button", { name: "New Glossary" });
    this.glossaryDescription = page.getByText("Glossaries help keep");
    this.noGlossariesMessage = page.getByText("No glossaries yet");
    this.firstGlossaryRow = page.getByRole("row").nth(1);
    this.addGlossaryDialog = page.getByRole("dialog", { name: "Add Glossary" });
    this.glossaryNameInput = page.getByRole("textbox", { name: "Name *" });
    this.definitionInput = page.getByRole("textbox", { name: "Definition" });
    this.internalNoteInput = page.getByRole("textbox", { name: "Internal note" });
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
    await expect(this.page.getByRole("heading", { name: "Add Glossary" })).toBeVisible();
  }

  async expectEditorSectionsInOrder() {
    const headings = this.editorSheet.getByRole("heading", { level: 3 });
    await expect(headings).toHaveText(["Glossary", "Translations", "Meaning", "Scope"]);
    await expect(this.editorSheet.getByRole("button", { name: "Internal Note" })).toBeVisible();
  }

  async expectAddGlossaryDialogLoaded() {
    await expect(this.page.getByText("Name *")).toBeVisible();
    await expect(this.glossaryNameInput).toBeVisible();
  }

  async fillGlossaryName(name: string) {
    await this.glossaryNameInput.fill(name);
  }

  async selectLanguage(language: string) {
    // The trigger is a combobox; a "Language" button match would hit the "About language" info icon.
    const languageField = this.addGlossaryDialog.getByRole("combobox", {
      name: "Language",
      exact: true,
    });
    await expect(languageField).toBeVisible();
    await languageField.click();
    await expect(languageField).toHaveAttribute("aria-expanded", "true");
    await expect(this.page.getByRole("option", { name: language })).toBeVisible({
      timeout: 10_000,
    });
    await this.page.getByRole("option", { name: language }).click();
  }

  async selectType(type: string) {
    const typeField = this.addGlossaryDialog.getByText("Type", { exact: true });
    await expect(typeField).toBeVisible();
    await typeField.click();
    await expect(this.page.getByRole("option", { name: type })).toBeVisible();
    await this.page.getByRole("option", { name: type }).click();
  }

  /** The rule card's stretched label covers its radio (glossary-editor-sheet ChoiceCard), so click the label. */
  async setRule(rule: "Translate" | "Keep" | "Forbidden") {
    const radio = this.editorSheet.getByRole("radio", { name: rule });
    const id = await radio.getAttribute("id");
    await this.editorSheet.locator(`label[for="${id}"]`).click();
    await expect(radio).toBeChecked();
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
    const labels = await this.editorSheet
      .getByPlaceholder("Approved translation")
      .evaluateAll((inputs) =>
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

  /** Variants chip input. */
  get variantsInput() {
    return this.editorSheet.getByRole("textbox", { name: "Variants" });
  }

  /** Case-sensitive switch. */
  get caseSensitiveSwitch() {
    return this.editorSheet.getByRole("switch", { name: "Case-sensitive" });
  }

  async addVariant(value: string) {
    await this.variantsInput.fill(value);
    await this.variantsInput.press("Enter");
  }

  async removeVariant(value: string) {
    await this.editorSheet
      .getByRole("button", { name: `Remove variant ${value}`, exact: true })
      .click();
  }

  async setCaseSensitive(on: boolean) {
    const control = this.caseSensitiveSwitch;
    if ((await control.getAttribute("aria-checked")) !== String(on)) await control.click();
    await expect(control).toHaveAttribute("aria-checked", String(on));
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
      await this.editorSheet.getByRole("button", { name: "Internal Note" }).click();
    }
    await this.internalNoteInput.fill(text);
  }

  /** The "Discard unsaved changes?" prompt of a dirty editor sheet. */
  get discardDialog() {
    return this.page.getByRole("dialog", { name: "Discard unsaved changes?" });
  }

  /**
   * Closes the editor without saving. The sheet focuses the first info icon on open, so its
   * tooltip takes the first Escape; Cancel closes the sheet directly. A dirty sheet asks first:
   * `discard: true` answers "Discard".
   */
  async cancelEditor(options: { discard?: boolean } = {}) {
    await this.editorSheet.getByRole("button", { name: "Cancel", exact: true }).click();
    if (options.discard) {
      await expect(this.discardDialog).toBeVisible();
      await this.discardDialog.getByRole("button", { name: "Discard", exact: true }).click();
    }
    await expect(this.editorSheet).toBeHidden();
  }

  async clickSaveButton() {
    // Drift (e7570b47): the Add Glossary sheet also has "Save & add another".
    await this.editorSheet.getByRole("button", { name: "Save", exact: true }).click();
  }

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
   * authenticated request stores the fixture. The structured fields (SPEC7) are dropped, as an
   * older client never sends them, so the server reads a v1 note as a Track A save (Phase 6 H17).
   */
  async createGlossaryWithStoredNote(name: string, additionalNote: string) {
    const pattern = /\/Glossary\/Save/;
    await this.page.route(pattern, async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      for (const field of ["rule", "caseSensitive", "variants", "translations", "status"]) {
        delete body[field];
      }
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
    await this.confirmDeleteGlossary(name);
    await expect(
      this.page.getByText("Glossary item deleted successfully.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await this.clearSearch();
  }

  async openEditFromList(name: string) {
    await this.searchGlossaries(name);
    await this.clickRowMenuItem(name, "Edit");
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
    await expect(this.page.getByRole("heading", { name: glossaryName })).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectDetailSections() {
    await expect(this.page.getByRole("heading", { name: "Translations" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Details" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Definition" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Internal Note" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Keys", exact: true })).toBeVisible();
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
    await expect(
      this.page.getByText("Glossary item updated successfully.", { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(this.page.getByRole("heading", { name: name })).toBeVisible({ timeout: 15_000 });
  }

  /** The editor's Alert after a save was rejected because someone else changed the term. */
  async expectVersionConflict() {
    await expect(
      this.editorSheet.getByText(
        "This glossary was changed by someone else. Reload the latest version and re-apply your changes.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 20_000 });
  }

  async reloadLatest() {
    await this.editorSheet.getByRole("button", { name: "Reload latest" }).click();
  }

  async expectEditName(name: string) {
    await expect(this.editDialog.getByRole("textbox", { name: "Name *" })).toHaveValue(name, {
      timeout: 15_000,
    });
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

  /**
   * Clicks an item in a row's actions menu. The debounced search refetch can re-render the
   * row just after the menu opens, which closes it before the item is clicked, so the whole
   * open-and-click is retried until the click lands.
   */
  async clickRowMenuItem(glossaryName: string, item: "Edit" | "Delete") {
    await this.waitForRowMenuButton(glossaryName);
    const menuItem = this.page.getByRole("menuitem", { name: item });
    await expect(async () => {
      if (!(await menuItem.isVisible())) await this.getRowMenuButton(glossaryName).click();
      await menuItem.click({ timeout: 2_000 });
    }).toPass({ timeout: 20_000 });
  }

  async waitForRowMenuButton(glossaryName: string, timeout = 20_000) {
    const menuButton = this.getRowMenuButton(glossaryName);
    await expect(menuButton).toBeVisible({ timeout });
  }

  async openDeleteGlossaryDialog(glossaryName: string) {
    await this.clickRowMenuItem(glossaryName, "Delete");
    await expect(this.deleteDialog).toBeVisible();
  }

  get deleteGlossaryDialog() {
    return this.deleteDialog;
  }

  /** The type-to-confirm field, shown for 50+ keys or when the count is unavailable. */
  get deleteConfirmInput() {
    return this.deleteDialog.getByRole("textbox", { name: /^Type ".+" to confirm$/ });
  }

  get deleteConfirmButton() {
    return this.deleteDialog.getByRole("button", { name: "Delete", exact: true });
  }

  /** Waits for the usage count, types the name when the dialog asks for it, then deletes. */
  async confirmDeleteGlossary(name?: string) {
    await expect(this.deleteDialog.getByText("Checking usage…")).toHaveCount(0, {
      timeout: 15_000,
    });
    if (name && (await this.deleteConfirmInput.isVisible())) {
      await this.deleteConfirmInput.fill(name);
    }
    await this.deleteConfirmButton.click();
  }

  /** SPEC15 CL01: Usage answered 403, so the dialog can't say how many keys are affected. */
  async expectDeleteCountUnavailable() {
    await expect(
      this.deleteDialog.getByText(
        "You can't see how many keys use this glossary. Deleting removes it from every key that uses it.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15_000 });
  }

  /**
   * A missing translation chip shows only the code; "<code> is missing" is in its tooltip and,
   * for screen readers, in its sr-only text.
   */
  async expectMissingTranslationChip(scope: Locator, code: string) {
    const chip = scope.getByText(`${code} is missing`, { exact: true });
    await expect(chip).toBeVisible();
    const visibleText = await chip.evaluate((element) => {
      const copy = element.cloneNode(true) as HTMLElement;
      copy.querySelectorAll(".sr-only").forEach((hidden) => hidden.remove());
      return copy.textContent?.trim() ?? "";
    });
    expect(visibleText).toBe(code);
    await chip.focus();
    await expect(this.page.getByRole("tooltip").filter({ hasText: `${code} is missing` })).toBeVisible();
    await chip.blur();
  }

  async expectNoTaggedKeys() {
    await expect(
      // The wording depends on the glossary's scope (only tagged, global, or module).
      this.page.getByText(/^No keys are tagged with this glossary( directly| or belong to its modules)?\.$/),
    ).toBeVisible({ timeout: 15_000 });
    await expect(this.page.getByText("Failed to load keys.", { exact: true })).toBeHidden();
  }

  async expectDeleteUsage(text: string | RegExp) {
    await expect(this.deleteDialog.getByText(text)).toBeVisible({ timeout: 15_000 });
  }

  get statusSelect() {
    return this.editorSheet.getByRole("combobox", { name: "Status" });
  }

  async setStatus(status: "Draft" | "Approved" | "Deprecated") {
    await this.statusSelect.click();
    await this.page.getByRole("option", { name: status, exact: true }).click();
    await expect(this.statusSelect).toHaveText(status);
  }

  /** A glossary table toolbar filter select. */
  tableFilter(name: GlossaryTableFilter) {
    return this.page.getByRole("combobox", { name, exact: true });
  }

  async setTableFilter(name: GlossaryTableFilter, option: string) {
    await this.tableFilter(name).click();
    await this.page.getByRole("option", { name: option, exact: true }).click();
    await expect(this.tableFilter(name)).toHaveText(option);
  }

  get resetFiltersButton() {
    return this.page.getByRole("button", { name: "Reset", exact: true });
  }

  /** Shows or hides a column through the Columns menu (stored in localStorage). */
  async setColumnVisible(column: string, visible: boolean) {
    await this.page.getByRole("button", { name: "Columns", exact: true }).click();
    const item = this.page.getByRole("menuitemcheckbox", { name: column, exact: true });
    if ((await item.getAttribute("aria-checked")) !== String(visible)) await item.click();
    await expect(item).toHaveAttribute("aria-checked", String(visible));
    await this.page.keyboard.press("Escape");
  }

  columnHeader(name: string) {
    return this.page.getByRole("columnheader", { name, exact: true });
  }

  async sortBy(column: "Name" | "Created" | "Last updated") {
    await this.columnHeader(column).getByRole("button").click();
  }

  rowCheckbox(name: string) {
    return this.page.getByRole("checkbox", { name: `Select ${name}`, exact: true });
  }

  async selectRows(names: string[]) {
    for (const name of names) await this.rowCheckbox(name).check();
  }

  /** The bulk toolbar shown while rows are selected. */
  get bulkToolbar() {
    return this.page.getByRole("toolbar");
  }

  bulkAction(
    name: "Approve" | "Deprecate" | "Tag to module" | "Set whole project" | "Delete",
  ) {
    return this.bulkToolbar.getByRole("button", { name, exact: true });
  }

  /** "Delete N glossaries" from the bulk toolbar. */
  get bulkDeleteDialog() {
    return this.page.getByRole("dialog", { name: /^Delete \d+ glossar(y|ies)$/ });
  }

  get bulkTagDialog() {
    return this.page.getByRole("dialog", { name: /^Tag \d+ glossar(y|ies) to a module$/ });
  }

  /** The glossary cards shown below 768 px instead of the table. */
  get mobileList() {
    return this.page.getByRole("list", { name: "Glossaries", exact: true });
  }

  async saveAndAddAnother(): Promise<Record<string, unknown>> {
    const requestPromise = this.page.waitForRequest(
      (request) => request.method() === "POST" && /\/Glossary\/Save/.test(request.url()),
    );
    await this.editorSheet.getByRole("button", { name: "Save & add another" }).click();
    return (await requestPromise).postDataJSON() as Record<string, unknown>;
  }

  suggestTranslationButton(languageName: string) {
    return this.editorSheet.getByRole("button", { name: `Suggest ${languageName} translation` });
  }

  get suggestAllButton() {
    return this.editorSheet.getByRole("button", { name: "Suggest all" });
  }

  translationField(code: string) {
    return this.translationInput(code);
  }

  async setPartOfSpeech(label: string) {
    await this.editorSheet.getByRole("combobox", { name: "Part of speech" }).click();
    await this.page.getByRole("option", { name: label, exact: true }).click();
  }

  async addUsageExample(text: string) {
    await this.editorSheet.getByRole("button", { name: "Add example" }).click();
    await this.editorSheet.getByRole("textbox", { name: /^Usage example \d+$/ }).last().fill(text);
  }

  // --- Details page ---

  get detailsKeySearch() {
    return this.page.getByRole("textbox", { name: "Search keys" });
  }

  async setDetailsModuleFilter(moduleName: string) {
    await this.page.getByRole("combobox", { name: "Module", exact: true }).click();
    await this.page.getByRole("option", { name: moduleName, exact: true }).click();
  }

  async showTranslationIn(languageName: string) {
    await this.page.getByRole("combobox", { name: "Show translation in" }).click();
    await this.page.getByRole("option", { name: languageName, exact: true }).click();
  }

  async openDetailsMoreActions() {
    await this.page.getByRole("button", { name: "More actions" }).click();
  }

  /** Inline edit of one translation on the details page. */
  async editDetailsTranslation(languageName: string, value: string) {
    await this.page.getByRole("button", { name: `Edit ${languageName} translation` }).click();
    await this.page.getByRole("textbox", { name: `${languageName} translation` }).fill(value);
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

  async selectDuplicateGlossary() {
    await this.page.getByRole("button", { name: "Select it" }).click();
  }

  async openDuplicateGlossary() {
    await this.page.getByRole("button", { name: "Open it" }).click();
  }
}
