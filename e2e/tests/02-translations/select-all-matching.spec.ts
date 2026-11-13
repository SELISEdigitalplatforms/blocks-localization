import { test, expect } from "../../support/test-base";
import { BulkKeyApi, fixtureKeyName, largeFixturesEnabled } from "../../support/bulk-key-api";
import { TranslationsPage } from "../../support/pages/translations.page";

async function openAllForModule(page: import("@playwright/test").Page, moduleName: string, count: number) {
  await page.reload();
  const translations = new TranslationsPage(page);
  await translations.expectPageLoaded();
  await translations.openModulesFilter();
  await translations.selectModuleFilterOption(moduleName);
  await translations.closeFilterPopover();
  await translations.openPageSizeOptions();
  const allOption = `All (${count})`;
  await expect(page.getByRole("option", { name: allOption })).toBeVisible({ timeout: 30_000 });
  await translations.choosePageSizeOption(allOption);
  await page.getByRole("checkbox", { name: /^Select all loaded/ }).check();
  return translations;
}

test("Select all matching deletes the filtered target minus unticked rows", async ({ page }) => {
  test.setTimeout(300_000);
  const api = await BulkKeyApi.capture(page);
  const moduleName = `bulk-matching-${Date.now()}`;
  const moduleId = await api.createModule(moduleName);
  try {
    await api.seedKeys(moduleId, moduleName, 935, await api.defaultCulture());
    await expect.poll(() => api.countKeys(moduleId), { timeout: 120_000 }).toBe(935);
    await openAllForModule(page, moduleName, 935);
    await page.getByRole("button", { name: "Select all 935 keys matching these filters" }).click();
    await expect(page.getByText("All 935 keys matching these filters are selected.")).toBeVisible();
    // Drift (4a6d98f0): the disabled Bulk edit button has a sibling tooltip trigger named
    // "Bulk edit works on loaded keys only.".
    await expect(page.getByRole("button", { name: "Bulk edit", exact: true })).toBeDisabled();

    const rows = page.getByRole("checkbox", { name: "Select row" });
    await rows.nth(0).uncheck();
    await rows.nth(1).uncheck();
    await expect(page.getByText("All 933 keys matching these filters are selected.")).toBeVisible();
    await rows.nth(0).check();
    await expect(page.getByText("All 934 keys matching these filters are selected.")).toBeVisible();
    await rows.nth(0).uncheck();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete language keys?" });
    await expect(dialog).toContainText("933 language keys matching the current filters");
    const requestPromise = page.waitForRequest((request) =>
      request.url().includes("/Key/DeleteKeys") && request.method() === "DELETE");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    const body = (await requestPromise).postDataJSON() as {
      filter: { moduleIds: string[] };
      excludedItemIds: string[];
      expectedCount: number;
      itemIds?: string[];
    };
    expect(body.filter.moduleIds).toContain(moduleId);
    expect(body.excludedItemIds).toHaveLength(2);
    expect(body.expectedCount).toBe(933);
    expect(body.itemIds).toBeUndefined();
    await expect.poll(() => api.countKeys(moduleId), { timeout: 90_000 }).toBe(2);
  } finally {
    await api.removeModule(moduleId);
  }
});

test("Select all matching refuses a changed count before deleting", async ({ page }) => {
  test.setTimeout(240_000);
  const api = await BulkKeyApi.capture(page);
  const moduleName = `bulk-changed-${Date.now()}`;
  const moduleId = await api.createModule(moduleName);
  try {
    const culture = await api.defaultCulture();
    await api.seedKeys(moduleId, moduleName, 120, culture);
    await expect.poll(() => api.countKeys(moduleId), { timeout: 90_000 }).toBe(120);
    await openAllForModule(page, moduleName, 120);
    await page.getByRole("button", { name: "Select all 120 keys matching these filters" }).click();
    await api.seedKeys(moduleId, moduleName, 1, culture, { start: 121 });
    await expect.poll(() => api.countKeys(moduleId)).toBe(121);

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Delete language keys?" });
    await expect(dialog).toContainText("120 language keys matching the current filters");
    const responsePromise = page.waitForResponse((response) =>
      response.url().includes("/Key/DeleteKeys") && response.request().method() === "DELETE");
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    expect((await responsePromise).status()).toBe(409);
    await expect(page.getByText(/matching your filters changed \(now 121\)/)).toBeVisible();
    await expect.poll(() => api.countKeys(moduleId)).toBe(121);
    expect(await api.findKeyId(moduleId, fixtureKeyName(moduleName, 121))).toBeTruthy();
  } finally {
    await api.removeModule(moduleId);
  }
});

test("All matching shows the cap instead of the escalation link", async ({ page }) => {
  test.skip(!largeFixturesEnabled(), "Set E2E_LARGE_FIXTURES=1 to seed 10,050 keys");
  test.setTimeout(900_000);
  const api = await BulkKeyApi.capture(page);
  const moduleName = `bulk-cap-${Date.now()}`;
  const moduleId = await api.createModule(moduleName);
  try {
    await api.seedKeys(moduleId, moduleName, 10_050, await api.defaultCulture());
    await expect.poll(() => api.countKeys(moduleId), { timeout: 300_000 }).toBe(10_050);
    await openAllForModule(page, moduleName, 10_050);
    await expect(page.getByText("More than 10,000 keys match. Narrow the filters to act on all of them.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Select all 10,050 keys/ })).toHaveCount(0);
  } finally {
    await api.removeModule(moduleId);
  }
});
