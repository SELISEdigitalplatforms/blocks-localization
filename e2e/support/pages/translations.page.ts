import { type Page, type Locator, expect } from "@playwright/test";

export { KeyDetailsPage } from "./key-details.page";

export class TranslationsPage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly translationKeysTab: Locator;
  private readonly historyTab: Locator;
  private readonly newKeyButton: Locator;
  private readonly publishChangesButton: Locator;
  private readonly autoTranslateButton: Locator;
  private readonly viewDropdownButton: Locator;
  private readonly tableViewport: Locator;
  private readonly importExportMenuButton: Locator;
  private readonly importKeysMenuItem: Locator;
  private readonly exportKeysMenuItem: Locator;
  private readonly exportHistoryMenuItem: Locator;
  private readonly importKeysDialog: Locator;
  private readonly exportKeysDialog: Locator;
  private readonly exportHistoryHeading: Locator;
  private readonly searchInput: Locator;
  private readonly bulkEditButton: Locator;
  private readonly bulkDeleteButton: Locator;
  private readonly deleteDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "Configure keys" });
    this.translationKeysTab = page.getByRole("tab", { name: "Translation Keys" });
    this.historyTab = page.getByRole("tab", { name: "History" });
    this.newKeyButton = page.getByRole("button", { name: "New Key" });
    this.publishChangesButton = page.getByRole("button", { name: "Publish Changes" });
    this.autoTranslateButton = page.getByRole("button", { name: "Auto-translate all" });
    this.viewDropdownButton = page.getByRole("button", { name: "View" });
    this.tableViewport = page.getByTestId("language-table-viewport");
    this.importExportMenuButton = page.locator("button:has(svg.lucide-ellipsis-vertical)");
    this.importKeysMenuItem = page.getByRole("menuitem", { name: "Import keys" });
    this.exportKeysMenuItem = page.getByRole("menuitem", { name: "Export keys" });
    this.exportHistoryMenuItem = page.getByRole("menuitem", { name: "Export History" });
    this.importKeysDialog = page.getByRole("heading", { name: "Import Keys" });
    this.exportKeysDialog = page.getByRole("heading", { name: "Export keys" });
    this.exportHistoryHeading = page.getByRole("heading", { name: "Export History" });
    this.searchInput = page.getByPlaceholder("Search...").first();
    this.bulkEditButton = page.getByRole("button", { name: "Bulk edit" });
    this.bulkDeleteButton = page.getByRole("button", { name: "Delete" });
    this.deleteDialog = page.getByRole("dialog", { name: "Delete language keys?" });
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.translationKeysTab).toBeVisible();
    await expect(this.historyTab).toBeVisible();
  }

  async expectTranslationKeysTabActive() {
    await expect(this.translationKeysTab).toHaveAttribute("data-state", "active");
  }

  async expectHistoryTabActive() {
    await expect(this.historyTab).toHaveAttribute("data-state", "active");
  }

  async switchToHistoryTab() {
    await this.historyTab.click();
    await this.expectHistoryTabActive();
  }

  async expectHistoryHeadingVisible() {
    await expect(this.page.getByRole("heading", { name: "History" })).toBeVisible({ timeout: 15_000 });
  }

  async expectHistoryEntryVisible() {
    await expect(this.page.getByRole("button", { name: /Inserted by import by/ })).toBeVisible();
  }

  async openTranslationKeysTab() {
    await this.translationKeysTab.click();
    await this.expectTranslationKeysTabActive();
  }

  async expectTranslationsHeadingVisible() {
    await expect(this.page.getByRole("heading", { name: "Translations" })).toBeVisible({ timeout: 15_000 });
  }

  async expectTableToolbarButtonsVisible() {
    await expect(this.page.getByRole("button", { name: "Modules" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Missing Translations" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Create Date" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Last Update Date" })).toBeVisible();
  }

  async openImportExportMenu() {
    await this.importExportMenuButton.click();
  }

  async expectImportExportOptionsVisible() {
    await expect(this.page.getByText("Import Keys")).toBeVisible();
    await expect(this.page.getByText("Export Keys")).toBeVisible();
    await expect(this.page.getByText("Export History")).toBeVisible();
  }

  async openImportKeysModal() {
    await this.importKeysMenuItem.click();
    await expect(this.importKeysDialog).toBeVisible();
  }

  async closeImportKeysModal() {
    const closeButton = this.page.getByRole("button", { name: "Close" });
    await closeButton.click();
    await expect(this.importKeysDialog).toBeHidden();
  }

  async selectFileType(type: "JSON" | "CSV") {
    const combobox = this.page.getByRole("combobox");
    await combobox.click();
    await this.page.getByRole("option", { name: type }).click();
  }

  async uploadJsonFile(filePath: string) {
    const chooseFileButton = this.page.getByRole("button", { name: "Choose File" });
    await chooseFileButton.setInputFiles(filePath);
  }

  async removeUploadedFile() {
    const removeItemButton = this.page.getByRole("button", { name: "remove item" });
    await removeItemButton.click();
  }

  async resetFileInput(filePath: string) {
    const chooseFileButton = this.page.getByRole("button", { name: "Choose File" });
    await chooseFileButton.evaluate((el) => {
      (el as HTMLInputElement).value = "";
    });
    await chooseFileButton.setInputFiles(filePath);
  }

  async expectUploadedFileNameVisible(fileName: string) {
    await expect(this.page.getByText(fileName, { exact: true })).toBeVisible({ timeout: 15_000 });
  }

  async clickUploadButton() {
    const uploadButton = this.page.getByRole("button", { name: "Upload" });
    await expect(uploadButton).toBeEnabled({ timeout: 15_000 });
    await uploadButton.click();
  }

  async expectUploadSuccessVisible() {
    await expect(
      this.page.getByText("Upload complete. Your translation keys are being processed.", { exact: true }),
    ).toBeVisible({ timeout: 60_000 });
  }

  async openExportKeysDialog() {
    await this.exportKeysMenuItem.click();
    await expect(this.exportKeysDialog).toBeVisible({ timeout: 15_000 });
  }

  async expectExportKeysDateRangeVisible() {
    await expect(this.page.getByText("Date Range", { exact: true })).toBeVisible();
  }

  async expectSelectFileTypeButtonDisabled() {
    await expect(this.page.getByRole("button", { name: "Select file type" })).toBeDisabled();
  }

  async expectSelectFileTypeButtonEnabled() {
    await expect(this.page.getByRole("button", { name: "Select file type" })).toBeEnabled({ timeout: 10_000 });
  }

  async toggleSelectAllCheckbox() {
    const selectAllCheckbox = this.page.locator("#select-all");
    await selectAllCheckbox.click();
  }

  async toggleModuleCheckbox(moduleName: string) {
    await this.page.getByRole("checkbox", { name: moduleName }).click();
  }

  async expectSelectAllChecked() {
    await expect(this.page.locator("#select-all")).toBeChecked();
  }

  async expectSelectAllUnchecked() {
    await expect(this.page.locator("#select-all")).not.toBeChecked();
  }

  async expectModuleCheckboxChecked(moduleName: string) {
    await expect(this.page.getByRole("checkbox", { name: moduleName })).toBeChecked();
  }

  async openFileTypeSelection() {
    await this.page.getByRole("button", { name: "Select file type" }).click();
    await expect(this.exportKeysDialog).toBeVisible();
  }

  async expectJsonRadioVisible() {
    await expect(this.page.getByRole("radio", { name: "JSON" })).toBeVisible();
  }

  async selectExportFileType(type: "JSON" | "XLSX" | "CSV") {
    await this.page.getByRole("radio", { name: type }).check();
  }

  async expectExportFileTypeSelected(type: "JSON" | "XLSX" | "CSV") {
    await expect(this.page.getByRole("radio", { name: type })).toBeChecked();
  }

  async clickBackButton() {
    const backButton = this.page.getByRole("button", { name: "Back" });
    await expect(backButton).toBeVisible();
    await backButton.click();
  }

  async clickExportButton() {
    await this.page.locator("#download").setChecked(true);
    await expect(this.page.getByRole("button", { name: "Export" })).toBeEnabled();
    await this.page.getByRole("button", { name: "Export" }).click();
  }

  async expectExportPreparingMessageVisible() {
    await expect(
      this.page.getByText("Your export is being prepared. The download will start when the file is ready.", {
        exact: true,
      }),
    ).toBeVisible();
  }

  async openExportHistory() {
    await this.openImportExportMenu();
    await expect(this.exportHistoryMenuItem).toBeVisible({ timeout: 15_000 });
    await this.exportHistoryMenuItem.click();
    await expect(this.exportHistoryHeading).toBeVisible({ timeout: 15_000 });
  }

  async expectExportHistoryColumnsVisible() {
    await expect(this.page.getByRole("columnheader", { name: "File Name" })).toBeVisible();
    await expect(this.page.getByRole("columnheader", { name: "Date" })).toBeVisible();
    await expect(this.page.getByRole("columnheader", { name: "Download" })).toBeVisible();
  }

  async expectExportHistoryDateFilterVisible() {
    await expect(this.page.getByRole("button", { name: "Date" })).toBeVisible();
  }

  async goBackToTranslationsFromExportHistory() {
    await this.page
      .getByRole("button")
      .filter({ has: this.page.locator(".lucide-arrow-left") })
      .click();
    await this.expectTranslationsHeadingVisible();
  }

  async expectPublishChangesButtonVisible() {
    await expect(this.publishChangesButton).toBeVisible({ timeout: 15_000 });
  }

  async openNewKeyDialog() {
    await this.newKeyButton.click();
    await expect(this.page.getByRole("heading", { name: "Create new key" })).toBeVisible({ timeout: 15_000 });
  }

  async expectNewKeyDialogLoaded() {
    await expect(this.page.getByRole("heading", { name: "About the key" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Translations" })).toBeVisible();
    await expect(this.page.getByRole("heading", { name: "Routes" })).toBeVisible();
    await expect(this.page.getByPlaceholder("Enter key name")).toBeVisible();
    await expect(this.page.getByText("Select Module...", { exact: true })).toBeVisible();
    await expect(this.page.getByPlaceholder("Enter default value")).toBeVisible();
    await expect(this.page.getByPlaceholder("Enter key context (optional)")).toBeVisible();
  }

  async expectSaveButtonDisabled() {
    await expect(this.page.getByRole("button", { name: "Save" })).toBeDisabled();
  }

  async fillKeyName(name: string) {
    const keyNameInput = this.page.getByPlaceholder("Enter key name");
    await keyNameInput.fill(name);
  }

  async expectKeyNameValidationVisible() {
    await expect(this.page.getByText("Key name must be at least 3 characters")).toBeVisible({ timeout: 10_000 });
  }

  async expectKeyNameValidationHidden() {
    await expect(this.page.getByText("Key name must be at least 3 characters")).toHaveCount(0);
  }

  async selectFirstModule() {
    const moduleTrigger = this.page.getByText("Select Module...", { exact: true });
    await moduleTrigger.click();
    const firstModule = this.page.getByRole("option").first();
    await expect(firstModule).toBeVisible({ timeout: 10_000 });
    await firstModule.click();
    await expect(this.page.getByText("Select Module...", { exact: true })).toHaveCount(0);
  }

  async fillDefaultValue(value: string) {
    await this.page.getByPlaceholder("Enter default value").fill(value);
  }

  async expectSaveButtonEnabled() {
    await expect(this.page.getByRole("button", { name: "Save" })).toBeEnabled({ timeout: 10_000 });
  }

  async clickSaveButton() {
    await this.page.getByRole("button", { name: "Save" }).click();
  }

  async expectKeyAddedSuccess() {
    await expect
      .poll(
        () =>
          this.page
            .getByText("Language key added", { exact: true })
            .isVisible()
            .catch(() => false),
        { timeout: 20_000 },
      )
      .toBeTruthy();
  }

  async expectRedirectedToTranslations() {
    await expect(this.page).toHaveURL(/\/services\/language$/, { timeout: 20_000 });
    await this.expectTranslationsHeadingVisible();
  }

  async openAutoTranslateAll() {
    await this.autoTranslateButton.click();
    await expect(this.page.getByRole("button", { name: "Yes" })).toBeVisible();
  }

  async confirmAutoTranslate() {
    await this.page.getByRole("button", { name: "Yes" }).click();
  }

  async expectAutoTranslateProgressVisible() {
    await expect(this.page.getByText("Keys translation in progress.", { exact: true })).toBeVisible({ timeout: 15_000 });
  }

  async openViewDropdown() {
    const viewButton = this.page.getByRole("button", { name: "View" });
    await expect(viewButton).toBeVisible();
    await viewButton.click();
  }

  async searchKeys(query: string) {
    await this.searchInput.fill(query);
  }

  async expectNoMatchingKeys() {
    await expect(this.page.getByText("No matching translation keys", { exact: true })).toBeVisible({ timeout: 10_000 });
  }

  async clearSearch() {
    await this.searchInput.fill("");
  }

  async expectFirstDataRowVisible() {
    const firstDataRow = this.page
      .getByRole("row")
      .filter({ has: this.page.locator("td") })
      .first();
    await expect(firstDataRow).toBeVisible();
  }

  async selectFirstKeyCheckbox() {
    const firstDataRow = this.page
      .getByRole("row")
      .filter({ has: this.page.locator("td") })
      .first();
    await firstDataRow.getByRole("checkbox").first().check();
  }

  async expectBulkActionsVisible() {
    await expect(this.bulkEditButton).toBeVisible({ timeout: 10_000 });
    await expect(this.bulkDeleteButton).toBeVisible();
  }

  async openBulkDeleteDialog() {
    await this.bulkDeleteButton.click();
    await expect(this.deleteDialog).toBeVisible();
  }

  async cancelBulkDeleteDialog() {
    await this.deleteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(this.deleteDialog).toHaveCount(0);
  }

  async goToNextPage() {
    const next = this.page.getByRole("button", { name: "Go to next page" });
    if (await next.isVisible().catch(() => false)) {
      await next.click();
      await expect(this.page.getByRole("button", { name: "Go to previous page" })).toBeEnabled();
    }
  }
}
