import fs from "fs";
import path from "path";
import type { Page, Route } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { GlossaryPage } from "../../support/pages/glossary.page";
import {
  LocalizationApi,
  TranslationsPage,
  mockTranslationSuggestions,
  trackGlossaryMatches,
  type ProjectLanguage,
} from "../../support/pages/translations.page";
import {
  openGlossary,
  openNewKey,
  openTranslations,
} from "../../support/localization-helpers";
import {
  identityCredentials,
  missingIdentityReason,
  openProjectRouteAs,
} from "../../support/identities";

const FORBIDDEN_USAGE = { status: 403, json: {} };
const COUNT_UNAVAILABLE =
  "You can't see how many keys use this glossary. Deleting removes it from every key that uses it.";
const BULK_COUNT_UNAVAILABLE =
  "You can't see how many keys use these glossaries. Deleting removes them from every key that uses them.";
const DE_PREFIX = "DE·";
const ENGLISH_GLOSSARY_STRINGS = path.resolve(
  __dirname,
  "../../../client/app/i18n/localization.glossary.en.json",
);

const randomLetters = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

/**
 * SPEC15 §10 fixtures, prefixed `e2e15-<timestamp>`: G-global (Translate, whole project),
 * G-tagged (tagged to one key), G-keep (Keep), G-bare (a bare-language translation), two bulk
 * fixtures, modules M and M2, and the ICU / placeholder keys.
 */
class Spec15Fixtures {
  readonly stamp = `${Date.now()}${randomLetters(4)}`;
  readonly prefix = `e2e15-${this.stamp}`;
  readonly keepName = `SELISE${randomLetters(6).toUpperCase()}`;
  readonly names = {
    global: `${this.prefix} global`,
    tagged: `${this.prefix} tagged`,
    keep: this.keepName,
    bare: `${this.prefix} bare`,
    both: `${this.prefix} both`,
    bulk1: `${this.prefix} bulk1`,
    bulk2: `${this.prefix} bulk2`,
    admin: `admin${randomLetters(6)}`,
    m: `${this.prefix}-m`,
    m2: `${this.prefix}-m2`,
    keepKey: `e2e15.keep.${this.stamp}`,
    icu: `e2e15.icu.${this.stamp}`,
    ph: `e2e15.ph.${this.stamp}`,
    m2Key: `e2e15.m2.${this.stamp}`,
  };
  readonly ids: Record<keyof Spec15Fixtures["names"], string> = Object.fromEntries(
    Object.keys(this.names).map((key) => [key, ""]),
  ) as Record<keyof Spec15Fixtures["names"], string>;

  constructor(readonly api: LocalizationApi) {}

  async create(source: ProjectLanguage, target: ProjectLanguage) {
    const { api, names, ids } = this;
    const t = target.languageCode;
    const bare = t.split("-")[0];
    ids.m = await api.createModule(names.m);
    ids.m2 = await api.createModule(names.m2);
    ids.global = await api.createGlossary({
      name: names.global,
      isGlobal: true,
      rule: "translate",
      translations: [{ language: t, value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] }],
    });
    ids.tagged = await api.createGlossary({
      name: names.tagged,
      isGlobal: false,
      moduleIds: [ids.m2],
    });
    ids.keep = await api.createGlossary({ name: names.keep, isGlobal: true, rule: "keep" });
    ids.bare = await api.createGlossary({
      name: names.bare,
      isGlobal: true,
      rule: "translate",
      translations: [{ language: bare, value: "Arbeitsbereich", forbiddenValues: [] }],
    });
    ids.both = await api.createGlossary({
      name: names.both,
      isGlobal: true,
      rule: "translate",
      translations: [
        { language: bare, value: "Bare value", forbiddenValues: [] },
        { language: t, value: "Culture value", forbiddenValues: [] },
      ],
    });
    ids.bulk1 = await api.createGlossary({ name: names.bulk1, isGlobal: true });
    ids.bulk2 = await api.createGlossary({ name: names.bulk2, isGlobal: true });
    ids.admin = await api.createGlossary({ name: names.admin, isGlobal: true });
    ids.keepKey = await api.createKey({
      keyName: names.keepKey,
      moduleId: ids.m,
      culture: source.languageCode,
      value: `Welcome to ${names.keep}`,
      glossaryIds: [ids.tagged],
    });
    ids.icu = await api.createKey({
      keyName: names.icu,
      moduleId: ids.m,
      culture: source.languageCode,
      value: `{role, select, ${names.admin} {${names.admin} panel} other {Panel}}`,
    });
    ids.ph = await api.createKey({
      keyName: names.ph,
      moduleId: ids.m,
      culture: source.languageCode,
      value: "Hello {user}, you have %d items",
    });
    ids.m2Key = await api.createKey({
      keyName: names.m2Key,
      moduleId: ids.m2,
      culture: source.languageCode,
      value: `Module two ${this.stamp}`,
    });
  }

  async cleanup() {
    const { api, ids } = this;
    const attempt = async (what: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        console.warn(`[e2e] Cleanup could not delete ${what}:`, error);
      }
    };
    for (const key of ["global", "tagged", "keep", "bare", "both", "bulk1", "bulk2", "admin"] as const) {
      if (ids[key]) await attempt(`glossary ${ids[key]}`, () => api.deleteGlossary(ids[key]));
    }
    for (const key of ["m", "m2"] as const) {
      if (ids[key]) await attempt(`module ${ids[key]}`, () => api.deleteModule(ids[key]));
    }
  }
}

async function setUp(page: Page) {
  const api = await LocalizationApi.capture(page);
  const languages = await api.languages();
  const source = languages.find((language) => language.isDefault) ?? languages[0];
  const others = languages.filter((language) => language.languageCode !== source?.languageCode);
  const target = others.find((language) => language.languageCode === "de-DE") ?? others[0];
  test.skip(!source || !target, "The shared project needs a language besides the default one.");
  return { api, languages, fixtures: new Spec15Fixtures(api), source: source!, target: target! };
}

const deletedToast = (page: Page) =>
  expect(
    page.getByText("Glossary item deleted successfully.", { exact: true }).first(),
  ).toBeVisible({ timeout: 20_000 });

/** Delete dialog without a known count: the name is always typed and nothing else unlocks it. */
async function expectCountUnavailableDelete(glossary: GlossaryPage, name: string) {
  await glossary.expectDeleteCountUnavailable();
  await expect(glossary.deleteGlossaryDialog.getByText(COUNT_UNAVAILABLE)).not.toHaveClass(
    /text-error/,
  );
  await expect(glossary.deleteGlossaryDialog.getByRole("button", { name: "Retry" })).toHaveCount(0);
  await expect(glossary.deleteConfirmInput).toBeVisible();
  await expect(glossary.deleteConfirmInput).toHaveValue("");
  await expect(glossary.deleteConfirmButton).toBeDisabled();
  await expect(
    glossary.deleteGlossaryDialog.getByRole("button", { name: "Deprecate instead" }),
  ).toHaveCount(0);
  await glossary.deleteConfirmInput.fill(`${name} x`);
  await expect(glossary.deleteConfirmButton).toBeDisabled();
  await glossary.deleteConfirmInput.fill(name.toLowerCase());
  await expect(glossary.deleteConfirmButton).toBeEnabled();
}

/** Bulk delete without a known count: the typed phrase is always required. */
async function expectBulkCountUnavailable(glossary: GlossaryPage, count: number) {
  const dialog = glossary.bulkDeleteDialog;
  await expect(dialog.getByText(BULK_COUNT_UNAVAILABLE, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const phrase = `delete ${count} ${count === 1 ? "glossary" : "glossaries"}`;
  const input = dialog.getByRole("textbox", { name: `Type "${phrase}" to confirm` });
  const remove = dialog.getByRole("button", { name: "Delete", exact: true });
  await expect(input).toBeVisible();
  await expect(remove).toBeDisabled();
  await input.fill(phrase);
  await expect(remove).toBeEnabled();
  return remove;
}

/**
 * Pseudo-German for `localization.glossary`: every English value with a "DE·" prefix, so any
 * string still in English after switching is one that bypasses `useT`.
 */
function pseudoGermanGlossaryStrings() {
  const english = JSON.parse(fs.readFileSync(ENGLISH_GLOSSARY_STRINGS, "utf8")) as Record<
    string,
    string
  >;
  return Object.fromEntries(
    Object.entries(english).map(([key, value]) => [key, `${DE_PREFIX} ${value}`]),
  );
}

/** Sets the console language the way the language switcher stores it (app-settings cookie). */
async function setConsoleLanguage(page: Page, language: "de" | "en") {
  await page.evaluate((code) => {
    const name = "app-settings-storage";
    const current = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith(`${name}=`))
      ?.slice(name.length + 1);
    let state: { settings?: Record<string, unknown> } = {};
    try {
      state = current ? JSON.parse(decodeURIComponent(current)) : {};
    } catch {
      state = {};
    }
    const value = encodeURIComponent(
      JSON.stringify({ ...state, settings: { theme: "system", ...state.settings, language: code } }),
    );
    const host = location.hostname;
    const domain = host === "localhost" ? host : host.split(".").slice(-2).join(".");
    document.cookie = `${name}=${value}; path=/; domain=${domain}; max-age=31536000; SameSite=Lax${
      location.protocol === "https:" ? "; Secure" : ""
    }`;
  }, language);
}

test.describe("Glossary — SPEC15 edge cases", () => {
  test("Delete without a usage count, a failing count, and bulk delete (H21, H22, C24, C25)", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const glossary = new GlossaryPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names } = fixtures;
      await openGlossary(page);
      await glossary.expectPageLoaded();

      await test.step("3.1: Usage 403 shows the unavailable count; the typed name enables Delete (H21, C25)", async () => {
        const forbid = (route: Route) => route.fulfill(FORBIDDEN_USAGE);
        await page.route(/\/Glossary\/Usage/, forbid);
        try {
          await glossary.searchGlossaries(names.global);
          await glossary.openDeleteGlossaryDialog(names.global);
          await expectCountUnavailableDelete(glossary, names.global);
          const deleted = page.waitForResponse((r) => /\/Glossary\/Delete/.test(r.url()));
          await glossary.deleteConfirmButton.click();
          expect((await deleted).status()).toBe(200);
          await deletedToast(page);
          fixtures.ids.global = "";
        } finally {
          await page.unroute(/\/Glossary\/Usage/, forbid);
        }
      });

      await test.step("3.2: bulk delete with Usage 403 requires the typed phrase (H22)", async () => {
        const forbid = (route: Route) => route.fulfill(FORBIDDEN_USAGE);
        await page.route(/\/Glossary\/Usage/, forbid);
        try {
          await glossary.searchGlossaries(fixtures.prefix);
          await glossary.selectRows([names.bulk1, names.bulk2]);
          await glossary.bulkAction("Delete").click();
          const remove = await expectBulkCountUnavailable(glossary, 2);
          await remove.click();
          await expect(page.getByText("Deleted 2 of 2 glossaries").first()).toBeVisible({
            timeout: 30_000,
          });
          fixtures.ids.bulk1 = "";
          fixtures.ids.bulk2 = "";
        } finally {
          await page.unroute(/\/Glossary\/Usage/, forbid);
        }
      });

      await test.step("3.3: any other Usage failure keeps Check failed, Retry and Delete disabled (C24)", async () => {
        const fail = (route: Route) =>
          route.fulfill({ status: 500, json: { errors: "scripted failure" } });
        await page.route(/\/Glossary\/Usage/, fail);
        try {
          await glossary.searchGlossaries(names.tagged);
          await glossary.openDeleteGlossaryDialog(names.tagged);
          const dialog = glossary.deleteGlossaryDialog;
          await expect(
            dialog.getByText("Failed to check how many keys use this glossary."),
          ).toBeVisible({ timeout: 15_000 });
          await expect(dialog.getByRole("button", { name: "Retry" })).toBeVisible();
          await expect(glossary.deleteConfirmButton).toBeDisabled();
          await expect(glossary.deleteConfirmInput).toHaveCount(0);
          await expect(dialog.getByText(COUNT_UNAVAILABLE)).toHaveCount(0);
          await dialog.getByRole("button", { name: "Cancel" }).click();
        } finally {
          await page.unroute(/\/Glossary\/Usage/, fail);
        }
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Restricted user without key::gets deletes after typing the name (H21, H22)", async ({
    page,
    browser,
  }) => {
    test.skip(!identityCredentials("restricted"), missingIdentityReason("restricted"));
    test.setTimeout(300_000);
    const { fixtures, source, target } = await setUp(page);
    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names } = fixtures;
      const { context, page: restricted } = await openProjectRouteAs(
        browser,
        "restricted",
        "services/glossary",
      );
      try {
        const glossary = new GlossaryPage(restricted);
        await glossary.expectPageLoaded();

        await test.step("3.1: the dialog says the count is unavailable; Delete after the name (H21, C25)", async () => {
          await glossary.searchGlossaries(names.global);
          await glossary.openDeleteGlossaryDialog(names.global);
          await expectCountUnavailableDelete(glossary, names.global);
          await glossary.deleteConfirmButton.click();
          await deletedToast(restricted);
          fixtures.ids.global = "";
        });

        await test.step("3.2: bulk delete of two fixtures needs the typed phrase (H22)", async () => {
          await glossary.searchGlossaries(fixtures.prefix);
          await glossary.selectRows([names.bulk1, names.bulk2]);
          await glossary.bulkAction("Delete").click();
          const remove = await expectBulkCountUnavailable(glossary, 2);
          await remove.click();
          await expect(restricted.getByText("Deleted 2 of 2 glossaries").first()).toBeVisible({
            timeout: 30_000,
          });
          fixtures.ids.bulk1 = "";
          fixtures.ids.bulk2 = "";
        });
      } finally {
        await context.close();
      }
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Keep glossary is used only in the exact case (H23, C26)", async ({ page }) => {
    test.setTimeout(240_000);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids } = fixtures;
      const matches = await trackGlossaryMatches(page, (match) => match.glossaryId === ids.keep);
      const dialog = translations.editTranslationDialog;
      const textarea = translations.editTranslationTextarea;
      const keepWarning = translations.violationItem(dialog, `Keep "${names.keep}" unchanged`);
      const usedLabel = `Glossary ${names.keep}: Keep, used in the translation`;

      try {
        await translations.openKeyDetails(ids.keepKey);
        await translations.openEditTranslation(target.languageName);
        await expect(translations.glossaryTerm(dialog, names.keep)).toBeVisible({
          timeout: 15_000,
        });

        await test.step("4a: another case is not used: Insert offered, live warning kept (C26)", async () => {
          await textarea.fill(`Willkommen bei ${names.keep.toLowerCase()}`);
          await expect(keepWarning).toBeVisible({ timeout: 2_000 });
          await expect(dialog.getByRole("button", { name: usedLabel })).toHaveCount(0);
          await expect(translations.insertGlossaryButton).toBeVisible();
          await translations.openInsertMenuWithShortcut();
          await expect(
            translations
              .insertMenuGroup(`Insert in ${target.languageName}`)
              .getByRole("option", { name: new RegExp(names.keep) }),
          ).toBeVisible();
          await expect(translations.insertMenuGroup("Already used")).toHaveCount(0);
          await page.keyboard.press("Escape");
        });

        await test.step("4b: the exact case is used: highlight, Already used, no warning (H23)", async () => {
          await textarea.fill(`Willkommen bei ${names.keep}`);
          await expect(dialog.getByRole("button", { name: usedLabel })).toBeVisible();
          await expect(translations.violationList(dialog)).toHaveCount(0);
          await expect(translations.insertGlossaryButton).toHaveCount(0);
          await translations.openInsertMenuWithShortcut();
          await expect(
            translations
              .insertMenuGroup("Already used")
              .getByRole("option", { name: new RegExp(names.keep) }),
          ).toHaveAttribute("aria-disabled", "true");
          await page.keyboard.press("Escape");
          await translations.closeEditTranslation();
        });
      } finally {
        await matches.stop();
      }
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Translate All stays open while sending and closes only on success (H24, C28)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const translations = new TranslationsPage(page);
    const dialog = translations.autoTranslateAllDialog;
    const yes = dialog.getByRole("button", { name: "Yes" });
    let reply: { isSuccess: boolean; errors: unknown } = { isSuccess: true, errors: null };
    const bodies: Record<string, unknown>[] = [];
    const scripted = async (route: Route) => {
      bodies.push(route.request().postDataJSON() as Record<string, unknown>);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      await route.fulfill({ json: reply });
    };
    await page.route(/\/Key\/TranslateAll/, scripted);

    try {
      await openTranslations(page);
      await translations.openTranslationKeysTab();

      await test.step("5a: while sending, Yes is busy, Cancel disabled, Escape ignored", async () => {
        reply = { isSuccess: false, errors: { Error: "Scripted translate failure" } };
        await translations.openAutoTranslateAll();
        await yes.click();
        await expect(yes).toBeDisabled();
        await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
        await expect(yes.locator("svg.animate-spin")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(dialog).toBeVisible();
      });

      await test.step("5b: isSuccess false keeps the dialog open with an error toast; Yes enabled again (C28)", async () => {
        await expect(page.getByText("Scripted translate failure").first()).toBeVisible({
          timeout: 15_000,
        });
        await expect(dialog).toBeVisible();
        await expect(yes).toBeEnabled();
      });

      await test.step("5c: success closes the dialog with the processing toast; a double click sends one request (H24, C28)", async () => {
        reply = { isSuccess: true, errors: null };
        bodies.length = 0;
        await yes.dblclick();
        await expect(dialog).toHaveCount(0, { timeout: 15_000 });
        await expect(page.getByText("Keys translation in progress.", { exact: true })).toBeVisible();
        expect(bodies).toHaveLength(1);
        expect(bodies[0]).not.toHaveProperty("moduleId");
      });
    } finally {
      await page.unroute(/\/Key\/TranslateAll/, scripted);
    }
  });

  test("Bare-language translations show in the culture row and save under it (H27, C31)", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    const glossary = new GlossaryPage(page);
    const { languages, fixtures, source, target } = await setUp(page);
    const bare = target.languageCode.split("-")[0];
    const sameLanguage = languages.filter((language) => language.languageCode.split("-")[0] === bare);
    test.skip(
      bare === target.languageCode ||
        sameLanguage.length !== 1 ||
        languages.some((language) => language.languageCode === bare),
      "Needs exactly one project culture of the target language and no bare code.",
    );

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names } = fixtures;
      await openGlossary(page);
      await glossary.expectPageLoaded();

      await test.step("6a: the bare value fills the culture row; an unchanged save sends only the culture (H27)", async () => {
        await glossary.openEditFromList(names.bare);
        await expect(glossary.translationField(target.languageCode)).toHaveValue("Arbeitsbereich");
        const payload = await glossary.saveAndCapturePayload();
        expect(payload.translations).toEqual([
          { language: target.languageCode, value: "Arbeitsbereich", forbiddenValues: [] },
        ]);
        await expect(
          page.getByText("Glossary item updated successfully.", { exact: true }).first(),
        ).toBeVisible({ timeout: 20_000 });
      });

      await test.step("6b: with both entries the culture value wins and only it is saved (C31)", async () => {
        await glossary.openEditFromList(names.both);
        await expect(glossary.translationField(target.languageCode)).toHaveValue("Culture value");
        const payload = await glossary.saveAndCapturePayload();
        expect(payload.translations).toEqual([
          { language: target.languageCode, value: "Culture value", forbiddenValues: [] },
        ]);
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("German console: mobile list and bulk bar come from useT (H28)", async ({ page }) => {
    test.setTimeout(240_000);
    const glossary = new GlossaryPage(page);
    const { fixtures, source, target } = await setUp(page);
    const stub = !process.env.E2E_DE_REMOTE;
    const dictionary = pseudoGermanGlossaryStrings();
    const serveGerman = async (route: Route) => {
      const url = new URL(route.request().url());
      if (!/^de/i.test(url.searchParams.get("Language") ?? "")) return route.fallback();
      if (url.searchParams.get("ModuleName") !== "localization.glossary") return route.fallback();
      return route.fulfill({ json: dictionary });
    };
    const german = (english: string) => (stub ? `${DE_PREFIX} ${english}` : undefined);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      if (stub) await page.route(/\/api\/Key\/GetUilmFile/, serveGerman);
      await openGlossary(page);
      await glossary.expectPageLoaded();
      await setConsoleLanguage(page, "de");

      await test.step("7a: 390x844 cards: list name and scope text are German", async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.reload();
        await page.getByPlaceholder(/Search glossary\.\.\./).fill(fixtures.prefix);
        const list = page.getByRole("list", { name: german("Glossaries") ?? /.+/ });
        await expect(list).toBeVisible({ timeout: 20_000 });
        await expect(page.getByRole("list", { name: "Glossaries", exact: true })).toHaveCount(0);
        await expect(list.getByText("Whole project", { exact: true })).toHaveCount(0);
        if (stub) await expect(list.getByText(`${DE_PREFIX} Whole project`).first()).toBeVisible();
        await expect(
          list.getByRole("button", { name: `Actions for ${fixtures.names.global}`, exact: true }),
        ).toHaveCount(0);
        const width = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(width).toBeLessThanOrEqual(390);
      });

      await test.step("7b: the bulk toolbar and its delete dialog are German", async () => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await expect(page.getByRole("table")).toBeVisible({ timeout: 20_000 });
        await page.getByRole("checkbox").nth(1).check();
        const toolbar = page.getByRole("toolbar");
        await expect(toolbar).toBeVisible();
        await expect(page.getByRole("toolbar", { name: "Bulk actions", exact: true })).toHaveCount(0);
        for (const english of [
          "Approve",
          "Deprecate",
          "Tag to module",
          "Set whole project",
          "Delete",
          "1 selected",
        ]) {
          await expect(toolbar.getByText(english, { exact: true })).toHaveCount(0);
        }
        await expect(
          toolbar.getByRole("button", { name: "Clear selection", exact: true }),
        ).toHaveCount(0);
        if (stub) {
          await expect(toolbar.getByText(`${DE_PREFIX} Approve`)).toBeVisible();
          await expect(toolbar.getByText(`${DE_PREFIX} 1 selected`)).toBeVisible();
        }
        await toolbar.getByRole("button").last().click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText("Delete 1 glossary", { exact: true })).toHaveCount(0);
        await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
        await page.keyboard.press("Escape");
      });
    } finally {
      await setConsoleLanguage(page, "en").catch(() => undefined);
      await page.setViewportSize({ width: 1280, height: 720 });
      if (stub) await page.unroute(/\/api\/Key\/GetUilmFile/, serveGerman);
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Server behaviour through the API (H2, H12, H15, H17, C19, C29)", async ({ page }) => {
    test.setTimeout(420_000);
    const translations = new TranslationsPage(page);
    const { api, fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids } = fixtures;

      await test.step("4.1: Usage of a missing glossary answers 404 with the shared text (H12)", async () => {
        const response = await api.usageResponse(`missing-${fixtures.stamp}`);
        expect(response.status()).toBe(404);
        expect(JSON.stringify(await response.json())).toContain("Glossary item not found");
      });

      await test.step("4.2: an ICU select option name is not matched; its branch text is (H2)", async () => {
        const text = `{role, select, ${names.admin} {${names.admin} panel} other {Panel}}`;
        const { matches } = await api.matchGlossary({
          text,
          language: source.languageCode,
          moduleId: ids.m,
          keyId: ids.icu,
        });
        const own = matches.filter((match) => match.glossaryId === ids.admin);
        const optionStart = text.indexOf(names.admin);
        const branchStart = text.indexOf(`{${names.admin} panel}`) + 1;
        expect(own.map((match) => match.start)).toEqual([branchStart]);
        expect(own.some((match) => match.start === optionStart)).toBe(false);
      });

      await test.step("4.4: export search with regex characters answers 200 (H17)", async () => {
        for (const searchText of ["(", ".*"]) {
          const response = await api.searchExportedFiles(searchText);
          expect(response.status(), searchText).toBe(200);
        }
      });

      await test.step("4.3: Translate All for M2 changes no key in M (H15, C19)", async () => {
        const before = await api.listKeys(ids.m);
        const response = await api.translateAll({
          defaultLanguage: source.languageCode,
          moduleId: ids.m2,
        });
        expect(response.ok()).toBe(true);
        await expect
          .poll(
            async () =>
              ((await api.findKey(names.m2Key, ids.m2))?.resources ?? []).some(
                (resource) => resource.culture === target.languageCode && !!resource.value,
              ),
            { timeout: 240_000, intervals: [5_000, 10_000] },
          )
          .toBe(true);
        const after = await api.listKeys(ids.m);
        for (const key of before) {
          const now = after.find((candidate) => candidate.itemId === key.itemId);
          expect(now?.lastUpdateDate, key.keyName).toBe(key.lastUpdateDate);
          expect(now?.resources, key.keyName).toEqual(key.resources);
        }
      });

      await test.step("C29: an empty new-key suggestion shows the no-suggestion text, not JSON", async () => {
        const ai = await mockTranslationSuggestions(page);
        try {
          ai.script({ content: "" });
          await openNewKey(page);
          await translations.fillKeyName(`e2e15.newkey.${fixtures.stamp}`);
          await translations.selectModule(names.m);
          await translations.fillDefaultValue("Hello {user}");
          await page.getByRole("button", { name: "Auto-Translate" }).first().click();
          await expect(
            page.getByText("No suggestion came back. Try again.", { exact: true }).first(),
          ).toBeVisible({ timeout: 15_000 });
          await expect(page.getByText(/\{"/)).toHaveCount(0);
        } finally {
          await ai.stop();
        }
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });
});
