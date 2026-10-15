import type { Page, Request } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { TranslationsPage, KeyDetailsPage } from "../../support/pages/translations.page";
import { openTranslations } from "../../support/localization-helpers";
import { e2eBaseUrl } from "../../support/env";

// Duplicate-key detection, surfacing and prevention (#345), against the deployed API and its
// real MongoDB. The shared test project normally has no duplicate rows, and the runner cannot
// seed them, so the chip assertions follow whatever the live summary reports.

type DuplicateSummary = {
  keyGroupCount: number;
  duplicateKeyRowCount: number;
  extraKeyCount: number;
  moduleGroupCount: number;
  extraModuleCount: number;
  keyUniquenessEnforced: boolean;
  moduleUniquenessEnforced: boolean;
};

type SaveResponse = {
  success?: boolean;
  errorMessage?: string | null;
  validationErrors?: { propertyName: string; errorMessage: string }[] | null;
};

const DUPLICATE_KEY_MESSAGE = "KeyName and ModuleId combination must not already exist for this key.";
const isSummary = (url: string) => url.includes("/Key/GetDuplicateSummary");
const isEnforce = (url: string) => url.includes("/Key/EnforceUniqueness");

/** Opens the Translations keys tab and returns the summary the page loaded with it. */
async function openKeysWithSummary(page: Page, translations: TranslationsPage): Promise<DuplicateSummary> {
  const summaryResponse = page.waitForResponse((r) => isSummary(r.url()) && r.request().method() === "GET", {
    timeout: 30_000,
  });
  await openTranslations(page);
  await translations.openTranslationKeysTab();
  await translations.expectTranslationsHeadingVisible();
  const response = await summaryResponse;
  expect(response.status()).toBe(200);
  return (await response.json()) as DuplicateSummary;
}

/**
 * The API base and the headers the app itself sends, taken from one of its own requests, so the
 * direct API calls below are authenticated exactly like the app.
 */
async function captureApi(page: Page, translations: TranslationsPage) {
  const listRequest = page.waitForRequest((r) => r.url().includes("/Key/Gets") && r.method() === "POST", {
    timeout: 30_000,
  });
  const modulesResponse = page.waitForResponse((r) => r.url().includes("/Module/GetModulesForCurrentTenant"), {
    timeout: 30_000,
  });
  await openTranslations(page);
  await translations.openTranslationKeysTab();
  const request: Request = await listRequest;
  const modules = (await (await modulesResponse).json()) as { itemId: string; moduleName: string }[];
  expect(modules.length, "the test project needs at least one module").toBeGreaterThan(0);

  const headers = Object.fromEntries(
    Object.entries(await request.allHeaders()).filter(
      ([name]) => !["content-length", "host", "cookie", "connection", "accept-encoding"].includes(name.toLowerCase()),
    ),
  );
  const keyApi = request.url().replace(/\/Key\/Gets(\?.*)?$/, "/Key");
  return { headers, keyApi, moduleId: modules[0].itemId };
}

test.describe("Duplicate keys", () => {
  test("The Translations header matches the server's duplicate summary", async ({ page }) => {
    test.setTimeout(180_000);
    const translations = new TranslationsPage(page);
    const summary = await openKeysWithSummary(page, translations);

    await test.step("Summary counts are consistent", async () => {
      expect(summary.extraKeyCount).toBe(summary.duplicateKeyRowCount - summary.keyGroupCount);
      expect(summary.extraModuleCount).toBeGreaterThanOrEqual(0);
    });

    const chip = page.getByTestId("duplicate-keys-chip");
    const modulesBadge = page.getByTestId("duplicate-modules-badge");

    await test.step("Duplicate-key chip reflects the summary", async () => {
      if (summary.extraKeyCount === 0) {
        await expect(chip).toHaveCount(0);
        return;
      }
      const label = `${summary.extraKeyCount.toLocaleString()} ${summary.extraKeyCount === 1 ? "duplicate" : "duplicates"}`;
      await expect(chip).toHaveText(label);
      await expect(chip).toHaveAttribute("aria-pressed", "false");

      const filtered = page.waitForRequest(
        (r) => r.url().includes("/Key/Gets") && (r.postDataJSON() as { onlyDuplicates?: boolean })?.onlyDuplicates === true,
      );
      await chip.click();
      await expect(page).toHaveURL(/duplicates=true/);
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      const response = await (await filtered).response();
      const body = (await response!.json()) as { totalCount: number; duplicatesTruncated?: boolean };
      if (!body.duplicatesTruncated) expect(body.totalCount).toBe(summary.duplicateKeyRowCount);

      await chip.click();
      await expect(page).not.toHaveURL(/duplicates=true/);
    });

    await test.step("Duplicate-module badge reflects the summary", async () => {
      if (summary.extraModuleCount === 0) {
        await expect(modulesBadge).toHaveCount(0);
        return;
      }
      const label = `${summary.extraModuleCount.toLocaleString()} ${summary.extraModuleCount === 1 ? "duplicate module" : "duplicate modules"}`;
      await expect(modulesBadge).toHaveText(label);
    });

    await test.step("The removed partial-translation badge stays gone", async () => {
      await expect(page.getByText(/^\d[\d,]* partial$/)).toHaveCount(0);
    });
  });

  test("A clean project turns on duplicate prevention at most once per session", async ({ page }) => {
    test.setTimeout(180_000);
    const translations = new TranslationsPage(page);
    const enforceCalls: { status: number; body: unknown }[] = [];
    page.on("response", async (response) => {
      if (isEnforce(response.url()) && response.request().method() === "POST") {
        enforceCalls.push({ status: response.status(), body: await response.json().catch(() => null) });
      }
    });

    const summary = await openKeysWithSummary(page, translations);
    const shouldEnforce =
      (summary.extraKeyCount === 0 && !summary.keyUniquenessEnforced) ||
      (summary.extraModuleCount === 0 && !summary.moduleUniquenessEnforced);

    await test.step("Enforcement is requested only when something can be enforced", async () => {
      if (shouldEnforce) {
        await expect.poll(() => enforceCalls.length, { timeout: 30_000 }).toBe(1);
        expect(enforceCalls[0].status).toBe(200);
        const result = enforceCalls[0].body as { keyUniquenessEnforced: boolean; moduleUniquenessEnforced: boolean };
        // A collection with no duplicates gets its index (H11, H12); one with duplicates does not (C5).
        expect(result.keyUniquenessEnforced).toBe(summary.extraKeyCount === 0);
        expect(result.moduleUniquenessEnforced).toBe(summary.extraModuleCount === 0);
      } else {
        await page.waitForTimeout(3_000);
        expect(enforceCalls).toHaveLength(0);
      }
    });

    await test.step("Reloading in the same session does not ask again", async () => {
      const before = enforceCalls.length;
      const refreshed = await openKeysWithSummary(page, translations);
      await page.waitForTimeout(3_000);
      expect(enforceCalls).toHaveLength(before);
      if (refreshed.extraKeyCount === 0) expect(refreshed.keyUniquenessEnforced).toBe(true);
      if (refreshed.extraModuleCount === 0) expect(refreshed.moduleUniquenessEnforced).toBe(true);
    });
  });

  test("Concurrent saves of one new key leave exactly one row", async ({ page }) => {
    test.setTimeout(420_000);
    const translations = new TranslationsPage(page);

    const summary = await openKeysWithSummary(page, translations);
    test.skip(
      summary.extraKeyCount > 0,
      "The project still has duplicate keys, so the unique key index cannot exist yet (C5).",
    );
    // Opening the page turns enforcement on for a clean project; wait until the index is reported.
    await expect
      .poll(async () => (await openKeysWithSummary(page, translations)).keyUniquenessEnforced, {
        timeout: 90_000,
        intervals: [2_000, 5_000, 10_000],
      })
      .toBe(true);

    const api = await captureApi(page, translations);
    const bursts: { size: number; successes: number; rejections: number; rows: number }[] = [];

    const countRows = async (keyName: string) => {
      const response = await page.request.post(`${api.keyApi}/Gets`, {
        headers: api.headers,
        data: { pageNumber: 0, pageSize: 100, searchKey: keyName, moduleIds: [api.moduleId] },
      });
      expect(response.ok()).toBe(true);
      const body = (await response.json()) as { keys: { itemId: string; keyName: string }[] };
      return body.keys.filter((k) => k.keyName === keyName);
    };

    const burst = async (size: number) => {
      const keyName = `e2e-race-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const responses = await Promise.all(
        Array.from({ length: size }, (_, i) =>
          page.request.post(`${api.keyApi}/Save`, {
            headers: api.headers,
            data: {
              itemId: "",
              keyName,
              moduleId: api.moduleId,
              isNewKey: true,
              isPartiallyTranslated: false,
              routes: [],
              resources: [{ culture: "en-US", value: `race value ${i}`, characterLength: 12 }],
            },
          }),
        ),
      );

      let successes = 0;
      let rejections = 0;
      for (const response of responses) {
        const text = await response.text();
        // No MongoDB text ever reaches the caller (C8).
        expect(text).not.toMatch(/E11000|duplicate key|MongoWriteException/i);
        expect(response.status()).toBe(200);
        const body = JSON.parse(text) as SaveResponse;
        if (body.success) {
          successes += 1;
        } else {
          expect(body.validationErrors?.[0]).toMatchObject({ propertyName: "IsNewKey", errorMessage: DUPLICATE_KEY_MESSAGE });
          rejections += 1;
        }
      }

      const rows = await countRows(keyName);
      bursts.push({ size, successes, rejections, rows: rows.length });
      for (const row of rows) {
        await page.request.delete(`${api.keyApi}/Delete?itemId=${encodeURIComponent(row.itemId)}`, { headers: api.headers });
      }
      return rows.length;
    };

    await test.step("Ten bursts of 20 concurrent saves", async () => {
      for (let i = 0; i < 10; i += 1) expect(await burst(20)).toBe(1);
    });

    await test.step("Raise the burst size if no save was ever rejected", async () => {
      if (bursts.some((b) => b.rejections > 0)) return;
      for (let i = 0; i < 10; i += 1) expect(await burst(50)).toBe(1);
    });

    test.info().annotations.push({ type: "save-race-bursts", description: JSON.stringify(bursts) });
    expect(bursts.some((b) => b.rejections > 0), "at least one concurrent save must have been rejected").toBe(true);
  });

  test("Deleting a key from its details returns to the list the user came from", async ({ page }) => {
    test.setTimeout(240_000);
    const translations = new TranslationsPage(page);
    const keyDetails = new KeyDetailsPage(page);
    const api = await captureApi(page, translations);

    const createKey = async (keyName: string) => {
      const response = await page.request.post(`${api.keyApi}/Save`, {
        headers: api.headers,
        data: {
          itemId: "",
          keyName,
          moduleId: api.moduleId,
          isNewKey: true,
          isPartiallyTranslated: false,
          routes: [],
          resources: [{ culture: "en-US", value: keyName, characterLength: keyName.length }],
        },
      });
      expect(((await response.json()) as SaveResponse).success).toBe(true);
      const list = await page.request.post(`${api.keyApi}/Gets`, {
        headers: api.headers,
        data: { pageNumber: 0, pageSize: 10, searchKey: keyName, moduleIds: [api.moduleId] },
      });
      const body = (await list.json()) as { keys: { itemId: string; keyName: string }[] };
      const created = body.keys.find((k) => k.keyName === keyName);
      expect(created, `the new key ${keyName} is listed`).toBeTruthy();
      return created!.itemId;
    };

    await test.step("From the filtered table: back to the same query string (H17)", async () => {
      const keyName = `e2e-return-${Date.now()}`;
      await createKey(keyName);
      await openTranslations(page);
      await translations.openTranslationKeysTab();
      await translations.searchKeys(keyName);
      await expect(page).toHaveURL(/search=/, { timeout: 10_000 });
      const listSearch = new URL(page.url()).search;

      await page.getByText(keyName, { exact: true }).first().click();
      await expect(page).toHaveURL(/\/services\/language\/translations\/[^/?]+/, { timeout: 15_000 });
      await keyDetails.openDeleteDialog();
      await keyDetails.confirmDelete();
      await keyDetails.expectDeleteSuccess();

      await expect(page).toHaveURL((url) => url.pathname.endsWith("/services/language") && url.search === listSearch, {
        timeout: 15_000,
      });
    });

    await test.step("Opened directly: back to the plain table (C19)", async () => {
      const keyName = `e2e-direct-${Date.now()}`;
      const itemId = await createKey(keyName);
      await keyDetails.navigateTo(itemId, e2eBaseUrl());
      await keyDetails.openDeleteDialog();
      await keyDetails.confirmDelete();
      await keyDetails.expectDeleteSuccess();

      await expect(page).toHaveURL((url) => url.pathname.endsWith("/services/language") && url.search === "", {
        timeout: 15_000,
      });
    });
  });
});
