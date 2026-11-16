import { test, expect } from "../../support/test-base";
import { BulkKeyApi } from "../../support/bulk-key-api";
import { TranslationsPage } from "../../support/pages/translations.page";

test("All-view selection retains evicted IDs for bulk Delete", async ({ page }) => {
  test.setTimeout(600_000);
  const api = await BulkKeyApi.capture(page);
  const moduleName = `bulk-eviction-${Date.now()}`;
  const moduleId = await api.createModule(moduleName);
  const prefix = moduleName;

  try {
    await api.seedKeys(moduleId, prefix, 6_000, await api.defaultCulture());
    await expect.poll(() => api.countKeys(moduleId), { timeout: 180_000 }).toBe(6_000);
    await page.reload();
    const translations = new TranslationsPage(page);
    await translations.expectPageLoaded();
    await translations.openModulesFilter();
    await translations.selectModuleFilterOption(moduleName);
    await translations.closeFilterPopover();
    await translations.openPageSizeOptions();
    await expect(page.getByRole("option", { name: "All (6000)" })).toBeVisible({ timeout: 30_000 });
    await translations.choosePageSizeOption("All (6000)");

    await page.getByRole("checkbox", { name: /^Select all loaded/ }).check();
    const viewport = page.getByTestId("language-table-viewport");
    const selectedCount = page.locator('[aria-live="polite"]').filter({ hasText: /keys selected/ });
    await expect(selectedCount).toContainText("100 of 6,000 keys selected");

    for (let attempt = 0; attempt < 70; attempt += 1) {
      const before = Number(((await selectedCount.textContent()) ?? "").split(" of ")[0].replace(/\D/g, ""));
      if (before === 6_000) break;
      await viewport.evaluate((element) => { element.scrollTop = element.scrollHeight; });
      await expect.poll(async () => {
        const label = (await selectedCount.textContent()) ?? "";
        return Number(label.split(" of ")[0].replace(/\D/g, ""));
      }, { timeout: 30_000 }).toBeGreaterThan(before);
    }
    // Drift (4a6d98f0): the disabled Bulk edit button has a sibling tooltip trigger whose
    // aria-label (the reason text, which mentions "Back to top") contains both names.
    await expect(page.getByRole("button", { name: "Back to top", exact: true })).toBeVisible();
    await expect(selectedCount).toContainText("6000 keys selected");
    await expect(page.getByRole("button", { name: "Bulk edit", exact: true })).toBeDisabled();

    await page.getByRole("checkbox", { name: "Select row" }).first().uncheck();
    await expect(selectedCount).toContainText("5,999 of 6,000 keys selected");
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete language keys?" });
    await expect(dialog).toContainText("5999");
    const deleteRequest = page.waitForRequest((request) =>
      request.url().includes("/Key/DeleteKeys") && request.method() === "DELETE");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    const body = (await deleteRequest).postDataJSON() as { itemIds: string[] };
    expect(body.itemIds).toHaveLength(5_999);
    expect(new Set(body.itemIds).size).toBe(5_999);
    await expect.poll(() => api.countKeys(moduleId), { timeout: 90_000 }).toBe(1);
  } finally {
    await api.removeModule(moduleId);
  }
});
