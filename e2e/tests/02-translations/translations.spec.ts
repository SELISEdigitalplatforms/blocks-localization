import { test, expect } from "../../support/test-base";
import { TranslationsPage, KeyDetailsPage } from "../../support/pages/translations.page";
import { openTranslations, openNewKey, openLogs } from "../../support/localization-helpers";
import { e2eBaseUrl } from "../../support/env";
import { readLocalizationProject } from "../../support/localization-project";
import path from "path";

test.describe("Translations", () => {
  test("Translations — full flow", async ({ page }) => {
    test.setTimeout(300_000);
    const translations = new TranslationsPage(page);
    const keyDetails = new KeyDetailsPage(page);

    const project = readLocalizationProject();
    if (!project)
      throw new Error("Missing fixtures/localization-project.json — run suite setup first.");
    let keyId: string | undefined;
    page.on("response", async (response) => {
      if (response.url().includes("/api/Key/Gets") && !keyId) {
        try {
          const json = (await response.json()) as { keys?: { itemId: string }[] };
          if (json.keys?.length) keyId = json.keys[0].itemId;
        } catch {
          // ignore non-JSON / aborted responses
        }
      }
    });

    await test.step("Translations Module loads", async () => {
      await openTranslations(page);
      await translations.expectPageLoaded();
    });

    await test.step("History tab", async () => {
      await translations.switchToHistoryTab();
      await translations.expectHistoryHeadingVisible();

      const noHistoryFound = page.getByText("No history found");
      const localizationActivity = page.getByText("Your localization activity");
      const historyEntry = page.getByRole("button", { name: /Inserted by import by/ });

      await expect
        .poll(
          async () =>
            (await noHistoryFound.isVisible()) ||
            (await localizationActivity.isVisible()) ||
            (await historyEntry.isVisible()),
          { timeout: 10_000 },
        )
        .toBe(true);

      if (await noHistoryFound.isVisible()) {
        await expect(noHistoryFound).toBeVisible();
      } else if (await localizationActivity.isVisible()) {
        await expect(localizationActivity).toBeVisible();
      } else {
        await translations.expectHistoryEntryVisible();
      }
    });

    await test.step("Translation Keys tab loads", async () => {
      await translations.openTranslationKeysTab();
      await translations.expectTranslationsHeadingVisible();
      await translations.expectTableToolbarButtonsVisible();
    });

    await test.step("Import/Export menu lists its options", async () => {
      await translations.openImportExportMenu();
      await translations.expectImportExportOptionsVisible();
    });

    await test.step("Import Keys modal opens and closes", async () => {
      await translations.openImportKeysModal();
      await translations.closeImportKeysModal();
      await translations.openImportExportMenu();
      await translations.openImportKeysModal();
    });

    await test.step("Select file type: CSV then back to JSON", async () => {
      await translations.selectFileType("CSV");
      await translations.selectFileType("JSON");
    });

    await test.step("Upload a JSON file, remove it, then re-upload it", async () => {
      const jsonFile = path.resolve(__dirname, "../../fixtures/Uilm_template.json");
      await translations.uploadJsonFile(jsonFile);
      await translations.removeUploadedFile();
      await translations.resetFileInput(jsonFile);
      await translations.expectUploadedFileNameVisible("Uilm_template.json");
    });

    await test.step("Upload the file and verify success", async () => {
      await translations.clickUploadButton();
      await translations.expectUploadSuccessVisible();
    });

    await test.step("Export Keys: open dialog and select modules", async () => {
      await translations.openImportExportMenu();
      await translations.openExportKeysDialog();
      await translations.expectExportKeysDateRangeVisible();
      await translations.expectSelectFileTypeButtonDisabled();

      await translations.toggleSelectAllCheckbox();
      await translations.expectSelectAllChecked();
      await translations.toggleSelectAllCheckbox();
      await translations.expectSelectAllUnchecked();
      await translations.toggleModuleCheckbox("common");
      await translations.expectModuleCheckboxChecked("common");
      await translations.toggleModuleCheckbox("profile");
      await translations.expectModuleCheckboxChecked("profile");
      await translations.toggleModuleCheckbox("dashboard");
      await translations.expectModuleCheckboxChecked("dashboard");
      await translations.expectSelectFileTypeButtonEnabled();
    });

    await test.step("Select file type: cycle through XLSX, CSV, back to JSON", async () => {
      await translations.openFileTypeSelection();
      await translations.expectJsonRadioVisible();
      await translations.selectExportFileType("XLSX");
      await translations.expectExportFileTypeSelected("XLSX");
      await translations.selectExportFileType("CSV");
      await translations.expectExportFileTypeSelected("CSV");
      await translations.selectExportFileType("JSON");
      await translations.expectExportFileTypeSelected("JSON");
      await translations.clickBackButton();
    });

    await test.step("Export with JSON + Download", async () => {
      await translations.openFileTypeSelection();
      await translations.clickExportButton();
      await translations.expectExportPreparingMessageVisible();
    });

    await test.step("Export History", async () => {
      await translations.openExportHistory();
      const noHistoryMessage = page.getByText("No export history found");
      if (await noHistoryMessage.isVisible({ timeout: 10_000 }).catch(() => false)) {
        await expect(
          page.getByText("Your exported files will appear here once you create an export."),
        ).toBeVisible();
      } else {
        await translations.expectExportHistoryDateFilterVisible();
        await translations.expectExportHistoryColumnsVisible();
      }
      await translations.goBackToTranslationsFromExportHistory();
    });

    await test.step("Publish Changes button is visible", async () => {
      await translations.expectPublishChangesButtonVisible();
    });

    await test.step("Create new key: About the key section", async () => {
      await translations.openNewKeyDialog();
      await translations.expectNewKeyDialogLoaded();
    });

    await test.step("Create new key: Routes section", async () => {
      const routesHeading = page.getByRole("heading", { name: "Routes" });
      const addRouteButton = page.getByRole("button", { name: "Add Route" });
      await expect(routesHeading).toBeVisible();
      await expect(addRouteButton).toBeVisible();
      await page
        .getByRole("link", { name: "Language Translation Keys" })
        .click({ timeout: 15_000 });
    });

    await test.step("Auto-translate all", async () => {
      await translations.openAutoTranslateAll();
      await translations.confirmAutoTranslate();
      await translations.expectAutoTranslateProgressVisible();
      await translations.openViewDropdown();
    });

    await test.step("Create new translation key: validation → fill → save", async () => {
      await openNewKey(page);
      await translations.expectNewKeyDialogLoaded();
      await translations.expectSaveButtonDisabled();
      await translations.fillKeyName("ab");
      await translations.expectKeyNameValidationVisible();
      await translations.fillKeyName(`E2E Key ${Date.now()}`);
      await translations.expectKeyNameValidationHidden();
      await translations.selectFirstModule();
      await translations.fillDefaultValue(`Default ${Date.now()}`);
      await translations.expectSaveButtonEnabled();
      await translations.clickSaveButton();
      await translations.expectKeyAddedSuccess();
      await translations.expectRedirectedToTranslations();
    });

    await test.step("Activity log page loads with the project audit trail", async () => {
      await openLogs(page);
      await expect(page.getByRole("heading", { name: "Activity log" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByText("Full audit trail of translation and key changes for this project."),
      ).toBeVisible();
    });

    await test.step("Search filters keys and shows empty state on no match", async () => {
      await openTranslations(page);
      await translations.openTranslationKeysTab();
      await translations.expectTranslationsHeadingVisible();

      await translations.searchKeys(`no-such-key-${Date.now()}`);
      await translations.expectNoMatchingKeys();

      await translations.clearSearch();
      await expect(page.getByText("No matching translation keys", { exact: true })).toHaveCount(0);
      await translations.expectFirstDataRowVisible();
    });

    await test.step("Bulk select reveals bulk actions and opens the delete confirmation", async () => {
      await translations.selectFirstKeyCheckbox();
      await translations.expectBulkActionsVisible();
      await translations.openBulkDeleteDialog();
      await translations.cancelBulkDeleteDialog();
    });

    await test.step("Pagination navigates between pages when multiple exist", async () => {
      await translations.goToNextPage();
    });

    await test.step("Open a key, inspect Details/History, then delete it", async () => {
      await expect.poll(() => keyId, { timeout: 20_000 }).toBeTruthy();
      await keyDetails.navigateTo(keyId, e2eBaseUrl());
      await keyDetails.expectTabsVisible();
      await keyDetails.expectDetailsTabActive();

      await keyDetails.switchToHistoryTab();
      await keyDetails.expectActivityHeadingVisible();
      await keyDetails.expectTimelineDescriptionVisible();

      await keyDetails.switchToDetailsTab();
      await keyDetails.openDeleteDialog();
      await keyDetails.confirmDelete();
      await keyDetails.expectDeleteSuccess();
      await keyDetails.expectRedirectedToTranslations();
    });
  });
});
