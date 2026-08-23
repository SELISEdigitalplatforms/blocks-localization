import { test, expect } from "../../../support/test-base";
import { openProjectDashboard } from "../../../support/flow-helpers";
import path from "path";

test.describe("Translations", () => {
  test.beforeEach(async ({ page }) => {
    await openProjectDashboard(page);
  });

  test("Translations page", async ({ page }) => {
    await test.step("Translations Module loads", async () => {
      await page.getByRole("link", { name: "Translations" }).click();
      await expect(page.getByRole("heading", { name: "Configure keys" })).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("History tab", async () => {
      const historyTab = page.getByRole("tab", { name: "History" });
      const historyHeading = page.getByRole("heading", { name: "History" });
      const noHistoryFound = page.getByText("No history found");
      const historyEntry = page.getByText(/Inserted by import by/);
      const localizationActivity = page.getByText("Your localization activity");
      await expect(historyTab).toBeVisible();
      await historyTab.click();
      await expect(historyHeading).toBeVisible({ timeout: 15000 });

      await expect
        .poll(
          async () =>
            (await noHistoryFound.isVisible()) ||
            (await localizationActivity.isVisible()) ||
            (await historyEntry.isVisible()),
          { timeout: 10000 },
        )
        .toBe(true);

      if (await noHistoryFound.isVisible()) {
        await expect(noHistoryFound).toBeVisible();
      } else if (await localizationActivity.isVisible()) {
        await expect(localizationActivity).toBeVisible();
      } else {
        await expect(historyEntry).toBeVisible();
      }
    });

    await test.step("Translation Keys tab loads", async () => {
      await page.getByRole("tab", { name: "Translation Keys" }).click();
      await expect(page.getByRole("heading", { name: "Translations" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("button", { name: "Modules" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Missing Translations" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Create Date" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Last Update Date" })).toBeVisible();
    });

    // import and export keys 3 dot icon
    const importAndExport3DotIcon = page.locator("button:has(svg.lucide-ellipsis-vertical)");

    await test.step("Import/Export menu lists its options", async () => {
      await expect(importAndExport3DotIcon).toBeVisible();
      await importAndExport3DotIcon.click();
      await expect(page.getByText("Import Keys")).toBeVisible();
      await expect(page.getByText("Export Keys")).toBeVisible();
      await expect(page.getByText("Export History")).toBeVisible();
    });

    const importKeysMenuItem = page.getByRole("menuitem", {
      name: "Import keys",
    });
    const importKeysHeading = page.getByRole("heading", {
      name: "Import Keys",
    });
    const closeButton = page.getByRole("button", {
      name: "Close",
    });

    await test.step("Import Keys modal opens and closes", async () => {
      await expect(importKeysMenuItem).toBeVisible();
      await importKeysMenuItem.click();

      await expect(closeButton).toBeVisible();
      await closeButton.click();
      await expect(importKeysHeading).toBeHidden();

      // Open Import Keys modal again
      await expect(importAndExport3DotIcon).toBeVisible();
      await importAndExport3DotIcon.click();

      await expect(importKeysMenuItem).toBeVisible();
      await importKeysMenuItem.click();

      await expect(importKeysHeading).toBeVisible();
    });

    const fileTypeCombobox = page.getByRole("combobox");
    const jsonOption = page.getByText("JSON", {
      exact: true,
    });

    await test.step("Select file type: CSV then back to JSON", async () => {
      await expect(fileTypeCombobox).toBeVisible();
      await fileTypeCombobox.click();

      const csvOption = page.getByRole("option", {
        name: "CSV",
      });

      await expect(csvOption).toBeVisible();
      await csvOption.click();

      // Select JSON
      await expect(fileTypeCombobox).toBeVisible();
      await fileTypeCombobox.click();

      await expect(jsonOption).toBeVisible();
      await jsonOption.click();
    });

    const chooseFileButton = page.getByRole("button", {
      name: "Choose File",
    });
    const jsonFile = path.resolve(__dirname, "../../../fixtures/Uilm_template.json");

    await test.step("Upload a JSON file, remove it, then re-upload it", async () => {
      await expect(chooseFileButton).toBeVisible({ timeout: 10000 });
      await chooseFileButton.setInputFiles(jsonFile);

      // Remove uploaded file
      const removeItemButton = page.getByRole("button", {
        name: "remove item",
      });

      await expect(removeItemButton).toBeVisible();
      await removeItemButton.click();

      // Upload the file again
      await expect(chooseFileButton).toBeVisible();
      // Removing a file resets app state but not the native <input>'s value, so
      // re-selecting the identical file path fires no change event unless we
      // clear it first.
      await chooseFileButton.evaluate((el) => {
        (el as HTMLInputElement).value = "";
      });
      await chooseFileButton.setInputFiles(jsonFile);

      // Confirm the component actually registered the re-uploaded file before
      // checking the Upload button — it stays disabled until then.
      await expect(page.getByText("Uilm_template.json", { exact: true })).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("Upload the file and verify success", async () => {
      const uploadButton = page.getByRole("button", {
        name: "Upload",
      });

      await expect(uploadButton).toBeVisible();
      await expect(uploadButton).toBeEnabled({ timeout: 15000 });
      await uploadButton.click();

      const uploadSuccessMessage = page.getByText(
        "Upload complete. Your translation keys are being processed.",
        { exact: true },
      );
      await expect(uploadSuccessMessage).toBeVisible({ timeout: 50000 });
    });

    await test.step("Export Keys: open dialog and select modules", async () => {
      await importAndExport3DotIcon.click();
      await page.getByRole("menuitem", { name: "Export keys" }).click();
      await expect(page.getByRole("heading", { name: "Export keys" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("Date Range", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Select file type" })).toBeDisabled();

      const selectAllCheckbox = page.locator("#select-all");
      const commonCheckbox = page.getByRole("checkbox", { name: "common" });
      const profileCheckbox = page.getByRole("checkbox", { name: "profile" });
      const dashboardCheckbox = page.getByRole("checkbox", { name: "dashboard" });

      // Check "Select All"
      await expect(selectAllCheckbox).toBeVisible();
      await selectAllCheckbox.click();
      await expect(selectAllCheckbox).toBeChecked();

      // Uncheck "Select All"
      await selectAllCheckbox.click();
      await expect(selectAllCheckbox).not.toBeChecked();

      // Check individual checkboxes
      await commonCheckbox.click();
      await expect(commonCheckbox).toBeChecked();

      await profileCheckbox.click();
      await expect(profileCheckbox).toBeChecked();

      await dashboardCheckbox.click();
      await expect(dashboardCheckbox).toBeChecked();

      await expect(page.getByRole("button", { name: "Select file type" })).toBeEnabled({
        timeout: 10000,
      });
    });

    const jsonRadio = page.locator("div").filter({ hasText: /^JSON$/ });
    const xlsxRadio = page.getByRole("radio", { name: "XLSX" });
    const csvRadio = page.getByRole("radio", { name: "CSV" });
    const backButton = page.getByRole("button", { name: "Back" });

    await test.step("Select file type: cycle through XLSX, CSV, back to JSON", async () => {
      await page.getByRole("button", { name: "Select file type" }).click();
      await expect(page.getByRole("heading", { name: "Export keys" })).toBeVisible();
      // JSON + Download are pre-selected by default, so Export starts enabled.
      await expect(page.getByRole("button", { name: "Export" })).toBeEnabled();

      // JSON is selected by default
      await expect(jsonRadio).toBeVisible();

      // Select XLSX
      await expect(xlsxRadio).toBeVisible();
      await xlsxRadio.check();
      await expect(xlsxRadio).toBeChecked();

      // Select CSV
      await expect(csvRadio).toBeVisible();
      await csvRadio.check();
      await expect(csvRadio).toBeChecked();

      // Select JSON again using the same selector you provided
      await expect(jsonOption).toBeVisible();
      await jsonOption.click();

      // Back
      await expect(backButton).toBeVisible();
      await backButton.click();
    });

    await test.step("Export with JSON + Download", async () => {
      await expect(page.getByRole("heading", { name: "Export keys" })).toBeVisible();
      await page.getByRole("button", { name: "Select file type" }).click();
      // #download starts pre-checked; a blind .click() would toggle it off and
      // correctly disable Export (no export method selected). Ensure it's on.
      await page.locator("#download").setChecked(true);
      await expect(page.getByRole("button", { name: "Export" })).toBeEnabled();
      await page.getByRole("button", { name: "Export" }).click();
      await page
        .getByText("Your export is being prepared. The download will start when the file is ready.", {
          exact: true,
        })
        .click();
    });

    await test.step("Export History", async () => {
      const exportHistoryMenuItem = page.getByRole("menuitem", {
        name: "Export History",
      });

      const exportHistoryHeading = page.getByRole("heading", {
        name: "Export History",
      });

      const dateFilterButton = page.getByRole("button", {
        name: "Date",
      });

      const fileNameColumn = page.getByRole("columnheader", {
        name: "File Name",
      });

      const dateColumn = page.getByRole("columnheader", {
        name: "Date",
      });

      const downloadColumn = page.getByRole("columnheader", {
        name: "Download",
      });

      // Open actions menu
      await expect(importAndExport3DotIcon).toBeVisible({ timeout: 30000 });
      await importAndExport3DotIcon.click();

      // Open Export History
      await expect(exportHistoryMenuItem).toBeVisible();
      await exportHistoryMenuItem.click();

      // Verify Export History modal/page
      await expect(exportHistoryHeading).toBeVisible({ timeout: 15000 });

      // Date button
      await expect(dateFilterButton).toBeVisible();

      // Table headers
      await expect(fileNameColumn).toBeVisible();
      await expect(dateColumn).toBeVisible();
      await expect(downloadColumn).toBeVisible();
      await page
        .locator("div")
        .filter({ hasText: /^Export History$/ })
        .getByRole("button")
        .click();

      // History Download// its not working
      // const downloadPromise = page.waitForEvent('download');
      // await page.getByRole('table').getByRole('button').filter({ hasText: /^$/ }).click();
      // const download = await downloadPromise;
    });

    await test.step("Publish Changes button is visible", async () => {
      const publishChangesButton = page.getByRole("button", {
        name: "Publish Changes",
      });
      await expect(publishChangesButton).toBeVisible({ timeout: 15000 });
    });

    await test.step("Create new key: About the key section", async () => {
      const newKeyButton = page.getByRole("button", {
        name: "New Key",
      });
      await expect(newKeyButton).toBeVisible();
      await newKeyButton.click();
      await expect(page.getByRole("heading", { name: "Create new key" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("heading", { name: "About the key" })).toBeVisible();
      await expect(page.getByText("Key name *")).toBeVisible();

      await expect(page.getByText("Module *")).toBeVisible();

      // await expect(page.getByText("Default value (English) *")).toBeVisible();

      await expect(page.getByText("Key Context")).toBeVisible();

      // Translations Section
      await expect(page.getByRole("heading", { name: "Translations" })).toBeVisible();
    });

    await test.step("Create new key: Routes section", async () => {
      const routesHeading = page.getByRole("heading", {
        name: "Routes",
      });

      const addRouteButton = page.getByRole("button", {
        name: "Add Route",
      });

      await expect(routesHeading).toBeVisible();

      await expect(addRouteButton).toBeVisible();
      // await addRouteButton.click();
      await page.getByRole("link", { name: "Language Translation Keys" }).click({ timeout: 15000 });
    });

    await test.step("Auto-translate all", async () => {
      const autoTranslateButton = page.getByRole("button", {
        name: "Auto-translate all",
      });

      const yesButton = page.getByRole("button", {
        name: "Yes",
      });

      const translationProgressMessage = page.getByText("Keys translation in progress.", {
        exact: true,
      });

      await expect(autoTranslateButton).toBeVisible();
      await autoTranslateButton.click();

      // Confirm auto-translation
      await expect(yesButton).toBeVisible();
      await yesButton.click();

      // Verify translation progress
      await expect(translationProgressMessage).toBeVisible({ timeout: 15000 });

      // View Button
      const viewButton = page.getByRole("button", {
        name: "View",
      });
      await expect(viewButton).toBeVisible();
      await viewButton.click();
    });
  });
});
