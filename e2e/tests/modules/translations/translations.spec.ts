import { test, expect, uniqueName } from "../../../support/test-base";
import { loginToTranslations } from "../../../support/auth";
import { KeyDetailsPage, NewKeyPage, TranslationsPage } from "../../../support/pages/translations";

test.describe("Translations", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTranslations(page);
  });

  test("filters, add key, publish, and delete", async ({ page }) => {
    test.setTimeout(300_000);

    const translations = new TranslationsPage(page);
    await translations.waitForReady();

    const today = new Date();
    const startDay = 1;
    const endDay = today.getDate();

    await translations.applyModuleFilters(["common", "auth", "profile"]);
    await translations.applyMissingTranslationFilter("German");
    await translations.applyDateRangeFilter("create", startDay, endDay);
    await translations.applyDateRangeFilter("lastUpdate", startDay, endDay);
    await translations.resetFilters();

    await translations.toggleViewLanguage("Bengali", true);
    await translations.toggleViewLanguage("Bengali", false);

    await translations.openHistoryTab();
    await translations.openTranslationKeysTab();

    await translations.openImportKeysDialog();
    await translations.closeDialog();

    const keyName = uniqueName("e2e");

    await translations.openNewKeyForm();

    const newKeyPage = new NewKeyPage(page);
    await newKeyPage.waitForReady();
    await newKeyPage.createKey({
      keyName,
      moduleName: "common",
      defaultValue: keyName,
      context: "test for e2e",
      route: "app/console",
    });

    await translations.waitForReady();
    await translations.searchKey(keyName);
    await translations.expectKeyVisible(keyName);

    await translations.publishChanges();

    await translations.searchKey(keyName);
    await translations.expectKeyVisible(keyName);

    await translations.openKeyDetails(keyName);

    const keyDetails = new KeyDetailsPage(page);
    await keyDetails.waitForReady(keyName);
    await keyDetails.deleteKey();

    await translations.waitForReady();
    await translations.publishChanges();

    await translations.searchKey(keyName);
    await expect(page.getByText(keyName, { exact: true })).not.toBeVisible();
  });
});
