import type { Page, Request, Route } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { GlossaryPage } from "../../support/pages/glossary.page";
import {
  LocalizationApi,
  TranslationsPage,
  mockTranslationSuggestions,
  type ProjectLanguage,
} from "../../support/pages/translations.page";
import { openGlossary, openTranslations } from "../../support/localization-helpers";

const META_PREFIX = "@@glossary-meta:v1@@";
const UPDATED = "Glossary item updated successfully.";

const randomLetters = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

const isGlossaryGets = (request: Request) => /\/Glossary\/Gets(\?|$)/.test(request.url());

/**
 * Per-run fixtures (§10): modules Billing and Auth, "Workspace" (global, Translate, forbidden
 * "Werkbereich") tagged on 60 keys, three Draft glossaries, a Billing glossary tagged on an Auth
 * key, a legacy (unmigrated) note, and a key whose stored translation uses "Werkbereich".
 */
class Spec8Fixtures {
  readonly tag = randomLetters(8);
  readonly names = {
    billing: `e2e-spec8-billing-${this.tag}`,
    auth: `e2e-spec8-auth-${this.tag}`,
    workspace: `Workspace${this.tag}`,
    drafts: [1, 2, 3].map((n) => `Draft${n}${this.tag}`),
    billingTerm: `Invoice${this.tag}`,
    legacy: `Legacy${this.tag}`,
    ws: `e2e.ws.${this.tag}`,
    plain: `e2e.plain.${this.tag}`,
    authKey: `e2e.auth.${this.tag}`,
    manyPrefix: `e2e.spec8.many.${this.tag}.`,
  };
  readonly ids = {
    billing: "",
    auth: "",
    workspace: "",
    drafts: [] as string[],
    billingTerm: "",
    legacy: "",
    ws: "",
    plain: "",
    authKey: "",
  };
  readonly extraGlossaries: string[] = [];
  readonly extraModules: string[] = [];

  constructor(readonly api: LocalizationApi) {}

  async create(source: ProjectLanguage, target: ProjectLanguage) {
    const { api, names, ids } = this;
    ids.billing = await api.createModule(names.billing);
    ids.auth = await api.createModule(names.auth);
    ids.workspace = await api.createGlossary({
      name: names.workspace,
      isGlobal: true,
      rule: "translate",
      language: source.languageCode,
      translations: [
        { language: target.languageCode, value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] },
      ],
    });
    for (const name of names.drafts) {
      ids.drafts.push(
        await api.createGlossary({ name, isGlobal: true, rule: "translate", status: "draft" }),
      );
    }
    ids.billingTerm = await api.createGlossary({
      name: names.billingTerm,
      isGlobal: false,
      moduleIds: [ids.billing],
      rule: "translate",
    });
    ids.legacy = await api.createGlossary({
      name: names.legacy,
      isGlobal: true,
      additionalNote: `${META_PREFIX}${JSON.stringify({ rule: "keep", note: "legacy note" })}`,
    });
    ids.ws = await api.createKey({
      keyName: names.ws,
      moduleId: ids.billing,
      culture: source.languageCode,
      value: `Open your ${names.workspace}`,
      glossaryIds: [ids.workspace],
      translations: [{ culture: target.languageCode, value: "Öffnen Sie Ihren Werkbereich" }],
    });
    ids.plain = await api.createKey({
      keyName: names.plain,
      moduleId: ids.billing,
      culture: source.languageCode,
      value: `Nothing to see ${this.tag}`,
    });
    ids.authKey = await api.createKey({
      keyName: names.authKey,
      moduleId: ids.auth,
      culture: source.languageCode,
      value: `Pay the ${names.billingTerm}`,
      glossaryIds: [ids.billingTerm],
    });
    await api.saveKeys(
      Array.from({ length: 60 }, (_, index) => ({
        keyName: `${names.manyPrefix}${String(index + 1).padStart(2, "0")}`,
        moduleId: ids.billing,
        culture: source.languageCode,
        value: `Many ${index + 1}`,
        glossaryIds: [ids.workspace],
      })),
    );
  }

  async cleanup() {
    const attempt = async (what: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        console.warn(`[e2e] Cleanup could not delete ${what}:`, error);
      }
    };
    const { api, ids } = this;
    const glossaries = [
      ids.workspace,
      ...ids.drafts,
      ids.billingTerm,
      ids.legacy,
      ...this.extraGlossaries,
    ];
    for (const id of glossaries) {
      if (id) await attempt(`glossary ${id}`, () => api.deleteGlossary(id));
    }
    for (const id of [ids.billing, ids.auth, ...this.extraModules]) {
      if (id) await attempt(`module ${id}`, () => api.deleteModule(id));
    }
  }
}

async function setUp(page: Page) {
  const api = await LocalizationApi.capture(page);
  const languages = await api.languages();
  const source = languages.find((language) => language.isDefault) ?? languages[0];
  const others = languages.filter((language) => language.languageCode !== source?.languageCode);
  const target = others.find((language) => language.languageCode === "de-DE") ?? others[0];
  const third = others.find((language) => language.languageCode !== target?.languageCode);
  test.skip(!source || !target, "The shared project needs a language besides the default one.");
  return { api, fixtures: new Spec8Fixtures(api), source: source!, target: target!, third };
}

const expectUpdated = (page: Page) =>
  expect(page.getByText(UPDATED, { exact: true }).first()).toBeVisible({ timeout: 20_000 });

test.describe("Glossary — UX revamp and bulk re-check (SPEC8)", () => {
  test("Part A: list, details, editor, delete, insert, chips and mobile cards (steps 1-7)", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const glossary = new GlossaryPage(page);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids, tag } = fixtures;

      await test.step("Step 1: language names, Columns menu, empty state and page labels (H1-H3, C2)", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await expect(page.getByRole("heading", { name: "Glossary", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "New Glossary" })).toBeVisible();
        await expect(page.getByText("Glossaries", { exact: true }).first()).toBeVisible();
        await glossary.searchGlossaries(names.workspace);
        const row = page.getByRole("row").filter({ hasText: names.workspace });
        await expect(row.getByText(source.languageName, { exact: true })).toBeVisible({
          timeout: 15_000,
        });
        await expect(glossary.columnHeader("Created")).toHaveCount(0);
        await expect(glossary.columnHeader("Last updated")).toBeVisible();
        await glossary.setColumnVisible("Type", false);
        await page.reload();
        await glossary.expectPageLoaded();
        await expect(glossary.columnHeader("Type")).toHaveCount(0);
        await glossary.setColumnVisible("Type", true);
        await expect(glossary.columnHeader("Type")).toBeVisible();

        const empty = (route: Route) => route.fulfill({ json: { items: [], totalCount: 0 } });
        await page.route(/\/Glossary\/Gets(\?|$)/, empty);
        try {
          await page.reload();
          await expect(page.getByText("No glossaries yet", { exact: true })).toBeVisible({
            timeout: 15_000,
          });
          await expect(page.getByRole("table").getByRole("button")).toHaveCount(0);
          await glossary.openNewGlossaryDialog();
          await glossary.cancelEditor();
        } finally {
          await page.unroute(/\/Glossary\/Gets(\?|$)/, empty);
        }
      });

      await test.step("Step 2: Keys card search and module send one Key/Gets; Show translation in; More actions (H4-H6)", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.searchGlossaries(names.workspace);
        await glossary.openGlossaryDetail(names.workspace);
        await expect(page.getByRole("row").filter({ hasText: names.ws })).toBeVisible({
          timeout: 15_000,
        });
        const keyGets: Record<string, unknown>[] = [];
        const onRequest = (request: Request) => {
          if (request.method() !== "POST" || !/\/Key\/Gets/.test(request.url())) return;
          const body = request.postDataJSON() as Record<string, unknown>;
          if (body?.glossaryId === ids.workspace) keyGets.push(body);
        };
        page.on("request", onRequest);
        try {
          await glossary.setDetailsModuleFilter(names.billing);
          await glossary.detailsKeySearch.fill(names.ws);
          await expect
            .poll(() =>
              keyGets.some(
                (body) =>
                  body.searchKey === names.ws &&
                  JSON.stringify(body.moduleIds) === JSON.stringify([ids.billing]),
              ),
            )
            .toBe(true);
          await page.waitForTimeout(1_000);
          const searched = keyGets.filter((body) => body.searchKey === names.ws);
          expect(searched).toHaveLength(1);
          expect(searched[0]).toMatchObject({ pageNumber: 0, moduleIds: [ids.billing] });
        } finally {
          page.off("request", onRequest);
        }
        await glossary.showTranslationIn(target.languageName);
        await expect(
          page
            .getByRole("row")
            .filter({ hasText: names.ws })
            .getByText("Öffnen Sie Ihren Werkbereich", { exact: true }),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
        await glossary.openDetailsMoreActions();
        await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
        await page.keyboard.press("Escape");
      });

      await test.step("Step 3: Language preset, Save & add another, Suggest payload, close during Suggest all (H7-H9, C4)", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.openNewGlossaryDialog();
        await expect(
          glossary.editorSheet.getByRole("combobox", { name: "Language", exact: true }),
        ).toContainText(source.languageName);
        for (const n of [1, 2]) {
          const name = `E2E Another ${n} ${tag}`;
          await glossary.fillGlossaryName(name);
          const payload = await glossary.saveAndAddAnother();
          expect(payload.name).toBe(name);
          await expect(
            page.getByText("Glossary item added successfully.", { exact: true }).first(),
          ).toBeVisible({ timeout: 20_000 });
          await expect(glossary.editorSheet).toBeVisible();
          const nameField = glossary.editorSheet.getByRole("textbox", { name: "Name *" });
          await expect(nameField).toHaveValue("");
          await expect(nameField).toBeFocused();
        }

        const ai = await mockTranslationSuggestions(page);
        try {
          ai.script({ content: "Rechnung" });
          await glossary.fillGlossaryName(`E2E Suggest ${tag}`);
          await glossary.fillDefinition("A bill sent to a customer.");
          await glossary.suggestTranslationButton(target.languageName).click();
          await expect(glossary.translationField(target.languageCode)).toHaveValue("Rechnung");
          expect(ai.requests).toHaveLength(1);
          expect(ai.requests[0]).toMatchObject({
            sourceText: `E2E Suggest ${tag}`,
            destinationLanguage: target.languageName,
            currentLanguage: source.languageName,
            destinationLanguageCode: target.languageCode,
          });
          expect(String(ai.requests[0].elementDetailContext)).toContain(
            "Meaning: A bill sent to a customer.",
          );
          expect(ai.requests[0]).not.toHaveProperty("glossaryIds");
          expect(ai.requests[0]).not.toHaveProperty("moduleId");
        } finally {
          await ai.stop();
        }

        let sent = 0;
        const slow = async (route: Route) => {
          sent++;
          await new Promise((resolve) => setTimeout(resolve, 3_000));
          await route.fulfill({ json: { content: "spät", isSuccess: true, errors: null } }).catch(
            () => undefined,
          );
        };
        await page.route(/\/Assistant\/GetTranslationSuggestion/, slow);
        try {
          await glossary.translationField(target.languageCode).fill("");
          await glossary.suggestAllButton.click();
          await expect.poll(() => sent).toBeGreaterThan(0);
          await glossary.cancelEditor({ discard: true });
          const atClose = sent;
          await page.waitForTimeout(4_000);
          expect(sent).toBe(atClose);
        } finally {
          await page.unroute(/\/Assistant\/GetTranslationSuggestion/, slow);
        }
        for (const n of [1, 2]) {
          const id = await fixtures.api.findGlossaryId(`E2E Another ${n} ${tag}`);
          if (id) fixtures.extraGlossaries.push(id);
        }
      });

      await test.step("Step 4: deleting a glossary used by 50+ keys asks for its name (H10)", async () => {
        await glossary.searchGlossaries(names.workspace);
        await glossary.openDeleteGlossaryDialog(names.workspace);
        await expect(glossary.deleteConfirmInput).toBeVisible({ timeout: 15_000 });
        await expect(glossary.deleteConfirmButton).toBeDisabled();
        await glossary.deleteConfirmInput.fill(names.workspace);
        await expect(glossary.deleteConfirmButton).toBeEnabled();
        await glossary.deleteGlossaryDialog.getByRole("button", { name: "Cancel" }).click();
      });

      await test.step("Step 5: Alt+Shift+G and Insert glossary; no glossaries in the source; Add to glossary (H11, H14, C5, C6)", async () => {
        const dialog = translations.editTranslationDialog;
        await translations.openKeyDetails(ids.ws);
        await translations.openEditTranslation(target.languageName);
        await translations.editTranslationTextarea.fill("");
        await translations.openInsertMenuWithShortcut();
        await translations
          .insertMenuGroup(`Insert in ${target.languageName}`)
          .getByRole("option", { name: new RegExp(names.workspace) })
          .click();
        await expect(translations.editTranslationTextarea).toHaveValue("Arbeitsbereich");
        await translations.selectSourceText("Open your");
        await translations.addToGlossaryButton.click();
        await expect(glossary.editorSheet.getByRole("textbox", { name: "Name *" })).toHaveValue(
          "Open your",
        );
        await glossary.cancelEditor({ discard: true });
        await expect(dialog).toBeVisible();
        await translations.closeEditTranslation();

        await translations.openKeyDetails(ids.plain);
        await translations.openEditTranslation(target.languageName);
        await translations.openInsertMenuWithShortcut();
        await expect(
          translations.insertGlossaryMenu.getByText("No glossaries in the source"),
        ).toBeVisible();
        await page.keyboard.press("Escape");
        await translations.closeEditTranslation();
      });

      await test.step("Step 6: chips with source tooltips; removing a tag is a tag-only save; cards at 390 px (H12, H15, C20)", async () => {
        await translations.openKeyDetails(ids.ws);
        const chips = await translations.keyGlossaryChips((name) => name.includes(tag));
        expect(chips.find((chip) => chip.name === names.workspace)?.source).toBe("Tagged");
        const link = page
          .getByRole("list", { name: "Glossaries for this key" })
          .getByRole("link", { name: names.workspace, exact: true });
        await expect(link).toHaveAttribute("href", new RegExp(`/services/glossary/${ids.workspace}$`));
        await link.focus();
        await expect(page.getByRole("tooltip").filter({ hasText: "Tagged" })).toBeVisible();
        const payload = await translations.captureKeySave(() =>
          page.getByRole("button", { name: `Remove ${names.workspace} from key` }).click(),
        );
        expect(payload).toMatchObject({ itemId: ids.ws, glossaryIdsOnly: true, glossaryIds: [] });

        const size = page.viewportSize();
        await page.setViewportSize({ width: 390, height: 844 });
        try {
          await openGlossary(page);
          await glossary.searchGlossaries(tag);
          await expect(glossary.mobileList).toBeVisible({ timeout: 15_000 });
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(
            glossary.mobileList.getByRole("link", { name: names.workspace, exact: true }),
          ).toBeVisible();
          const width = await page.evaluate(() => document.documentElement.scrollWidth);
          expect(width).toBeLessThanOrEqual(390);
        } finally {
          if (size) await page.setViewportSize(size);
        }
      });

      await test.step("Step 7: an unmigrated note shows its rule and note, never the JSON (C21)", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.searchGlossaries(names.legacy);
        const row = page.getByRole("row").filter({ hasText: names.legacy });
        await expect(row.getByText("Keep", { exact: true })).toBeVisible({ timeout: 15_000 });
        await expect(row.getByText(/@@glossary-meta/)).toHaveCount(0);
        await glossary.openGlossaryDetail(names.legacy);
        await expect(page.getByText("legacy note", { exact: true })).toBeVisible();
        await expect(page.getByText(/@@glossary-meta/)).toHaveCount(0);
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Part B: filters, sort, bulk actions, inline edit, part of speech and delete dialog (steps 8-13, 17)", async ({
    page,
  }) => {
    test.setTimeout(600_000);
    const glossary = new GlossaryPage(page);
    const translations = new TranslationsPage(page);
    const { api, fixtures, source, target, third } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids, tag } = fixtures;

      await test.step("Step 8: Language, Type, Scope and sort parameters; Reset returns to page 0 (H16-H18, C10)", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.searchGlossaries(tag);
        await glossary.expectGlossaryRowVisible(names.workspace);
        const nextGets = (check: (url: URL) => boolean) =>
          page.waitForRequest((r) => isGlossaryGets(r) && check(new URL(r.url())));

        let request = nextGets((url) => url.searchParams.get("Language") === source.languageCode);
        await glossary.setTableFilter("Language", source.languageName);
        expect(new URL((await request).url()).searchParams.get("PageNumber")).toBe("0");

        request = nextGets((url) => url.searchParams.get("Scope") === "project");
        await glossary.setTableFilter("Scope", "Whole project");
        expect(new URL((await request).url()).searchParams.get("PageNumber")).toBe("0");

        request = nextGets((url) => url.searchParams.get("SortBy") === "name");
        await glossary.sortBy("Name");
        const sorted = new URL((await request).url());
        expect(sorted.searchParams.has("SortDescending")).toBe(true);
        await expect(glossary.columnHeader("Name")).toHaveAttribute(
          "aria-sort",
          /ascending|descending/,
        );

        await expect(glossary.resetFiltersButton).toBeVisible();
        request = nextGets(
          (url) =>
            !url.searchParams.has("Language") &&
            !url.searchParams.has("Scope") &&
            !url.searchParams.has("SearchText"),
        );
        await glossary.resetFiltersButton.click();
        expect(new URL((await request).url()).searchParams.get("PageNumber")).toBe("0");
        await expect(glossary.resetFiltersButton).toHaveCount(0);
        await expect(glossary.tableFilter("Status")).toHaveCount(1);
      });

      await test.step("Step 9: bulk Approve with one Version error; bulk Tag to module; a failed module page keeps Tag disabled (H19, C7, C8)", async () => {
        await glossary.searchGlossaries(tag);
        await glossary.expectGlossaryRowVisible(names.drafts[0]);
        await glossary.selectRows(names.drafts);
        await expect(glossary.bulkToolbar.getByText("3 selected")).toBeVisible();
        for (const action of ["Approve", "Deprecate", "Tag to module", "Set whole project", "Delete"] as const) {
          await expect(glossary.bulkAction(action)).toBeVisible();
        }
        const conflictId = ids.drafts[1];
        const saves: Record<string, unknown>[] = [];
        const conflict = async (route: Route) => {
          const body = route.request().postDataJSON() as Record<string, unknown>;
          saves.push(body);
          if (body.itemId !== conflictId) return route.fallback();
          return route.fulfill({
            json: {
              success: false,
              validationErrors: [{ propertyName: "Version", errorMessage: "Version conflict" }],
            },
          });
        };
        await page.route(/\/Glossary\/Save/, conflict);
        try {
          await glossary.bulkAction("Approve").click();
          await expect(page.getByText("Some glossaries failed").first()).toBeVisible({
            timeout: 20_000,
          });
          await expect(page.getByText("Updated 2 of 3 glossaries").first()).toBeVisible();
          await expect(page.getByRole("alert").getByText(names.drafts[1])).toBeVisible();
          expect(saves).toHaveLength(3);
          expect(saves.every((body) => body.status === "approved")).toBe(true);
        } finally {
          await page.unroute(/\/Glossary\/Save/, conflict);
        }

        await glossary.selectRows([names.drafts[0], names.drafts[2]]);
        const tagged: string[][] = [];
        const tagRoute = (route: Route) => {
          tagged.push((route.request().postDataJSON() as { glossaryIds: string[] }).glossaryIds);
          return route.fulfill({ json: { isSuccess: true } });
        };
        await page.route(/\/Module\/TagGlossary/, tagRoute);
        try {
          await glossary.bulkAction("Tag to module").click();
          const dialog = glossary.bulkTagDialog;
          await dialog.getByRole("combobox", { name: "Module" }).click();
          await page.getByRole("option", { name: names.billing, exact: true }).click();
          await expect(dialog.getByRole("button", { name: "Tag", exact: true })).toBeEnabled({
            timeout: 15_000,
          });
          await dialog.getByRole("button", { name: "Tag", exact: true }).click();
          await expect.poll(() => tagged.length).toBe(1);
          expect([...tagged[0]].sort()).toEqual(
            [ids.billingTerm, ids.drafts[0], ids.drafts[2]].sort(),
          );
        } finally {
          await page.unroute(/\/Module\/TagGlossary/, tagRoute);
        }

        await glossary.selectRows([names.drafts[0]]);
        const failModule = (route: Route) => {
          const url = new URL(route.request().url());
          if (url.searchParams.get("ModuleId") !== ids.auth) return route.fallback();
          return route.fulfill({ status: 500, json: { errors: "scripted failure" } });
        };
        const tagRequests: string[] = [];
        const onRequest = (request: Request) => {
          if (/\/Module\/TagGlossary/.test(request.url())) tagRequests.push(request.url());
        };
        await page.route(/\/Glossary\/Gets/, failModule);
        page.on("request", onRequest);
        try {
          await glossary.bulkAction("Tag to module").click();
          const dialog = glossary.bulkTagDialog;
          await dialog.getByRole("combobox", { name: "Module" }).click();
          await page.getByRole("option", { name: names.auth, exact: true }).click();
          await expect(dialog.getByRole("alert")).toBeVisible({ timeout: 15_000 });
          await expect(dialog.getByRole("button", { name: "Tag", exact: true })).toBeDisabled();
          await dialog.getByRole("button", { name: "Cancel" }).click();
          expect(tagRequests).toEqual([]);
        } finally {
          page.off("request", onRequest);
          await page.unroute(/\/Glossary\/Gets/, failModule);
        }
      });

      await test.step("Step 10: inline translation edit saves the full glossary; a conflict keeps the value; Issue badge (H20, H21, C11)", async () => {
        const language = third ?? target;
        await glossary.clearSearch();
        await glossary.searchGlossaries(names.workspace);
        await glossary.openGlossaryDetail(names.workspace);
        await expect(
          page.getByRole("row").filter({ hasText: names.ws }).getByText("Issue"),
        ).toBeVisible({ timeout: 30_000 });

        const save = page.waitForRequest(
          (r) => r.method() === "POST" && /\/Glossary\/Save/.test(r.url()),
        );
        await glossary.editDetailsTranslation(language.languageName, "Espace de travail");
        await page.getByRole("button", { name: "Save", exact: true }).click();
        const body = (await save).postDataJSON() as Record<string, unknown>;
        expect(typeof body.version).toBe("number");
        expect(body).toMatchObject({ itemId: ids.workspace, name: names.workspace, rule: "translate" });
        expect(body.translations).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ language: language.languageCode, value: "Espace de travail" }),
          ]),
        );
        await expect(page.getByText("Translation saved.").first()).toBeVisible({ timeout: 20_000 });

        const conflict = (route: Route) =>
          route.fulfill({
            json: {
              success: false,
              validationErrors: [{ propertyName: "Version", errorMessage: "Version conflict" }],
            },
          });
        await page.route(/\/Glossary\/Save/, conflict);
        try {
          await glossary.editDetailsTranslation(language.languageName, "Espace modifié");
          await page.getByRole("button", { name: "Save", exact: true }).click();
          await expect(
            page.getByText(
              "This glossary was changed by someone else. Reload the latest version, then save again.",
            ),
          ).toBeVisible({ timeout: 15_000 });
          await expect(page.getByRole("button", { name: "Reload latest" })).toBeVisible();
          await expect(
            page.getByRole("textbox", { name: `${language.languageName} translation` }),
          ).toHaveValue("Espace modifié");
        } finally {
          await page.unroute(/\/Glossary\/Save/, conflict);
        }
        await page.getByRole("button", { name: "Reload latest" }).click();
      });

      await test.step("Step 11: part of speech and examples are saved and shown; a save without them keeps them (H22, C17)", async () => {
        await openGlossary(page);
        await glossary.openEditFromList(names.billingTerm);
        await glossary.setPartOfSpeech("Noun");
        await glossary.addUsageExample(`Send the ${names.billingTerm} today.`);
        const payload = await glossary.saveAndCapturePayload();
        await expectUpdated(page);
        expect(payload).toMatchObject({
          partOfSpeech: "noun",
          usageExamples: [`Send the ${names.billingTerm} today.`],
        });
        await glossary.openGlossaryDetail(names.billingTerm);
        await expect(page.getByText("Noun", { exact: true })).toBeVisible();
        await expect(page.getByText(`Send the ${names.billingTerm} today.`)).toBeVisible();

        await api.updateGlossary(ids.billingTerm, { context: "Changed by a CLI" }, [
          "partOfSpeech",
          "usageExamples",
        ]);
        expect(await api.getGlossary(ids.billingTerm)).toMatchObject({
          partOfSpeech: "noun",
          usageExamples: [`Send the ${names.billingTerm} today.`],
        });
      });

      await test.step("Step 12: the delete dialog counts keys in modules; Deprecate instead keeps the glossary (H23, H24)", async () => {
        await openGlossary(page);
        await glossary.searchGlossaries(names.billingTerm);
        await glossary.openDeleteGlossaryDialog(names.billingTerm);
        await glossary.expectDeleteUsage(/^Used by \d+ keys? in 2 modules\.$/);
        const save = page.waitForRequest(
          (r) => r.method() === "POST" && /\/Glossary\/Save/.test(r.url()),
        );
        await glossary.deleteGlossaryDialog.getByRole("button", { name: "Deprecate instead" }).click();
        expect((await save).postDataJSON()).toMatchObject({
          itemId: ids.billingTerm,
          status: "deprecated",
        });
        await expect(
          page.getByText("Glossary deprecated. It no longer reaches the AI or highlights.").first(),
        ).toBeVisible({ timeout: 20_000 });
        expect(await api.getGlossary(ids.billingTerm)).toMatchObject({ status: "deprecated" });
      });

      await test.step("Step 13: a suggestion's applied glossaries are listed (H25)", async () => {
        const ai = await mockTranslationSuggestions(page);
        try {
          ai.script({
            content: "Öffnen Sie Ihren Arbeitsbereich",
            appliedTerms: [
              { glossaryId: ids.workspace, term: names.workspace, rule: "translate", expected: "Arbeitsbereich" },
              { glossaryId: ids.legacy, term: names.legacy, rule: "keep" },
              { glossaryId: ids.drafts[0], term: names.drafts[0], rule: "forbidden" },
            ],
          });
          await translations.openKeyDetails(ids.ws);
          await translations.openEditTranslation(target.languageName);
          await translations.clickAutoTranslateInDialog();
          await expect(
            translations.editTranslationDialog.getByText(
              `Applied: ${names.workspace} → Arbeitsbereich, ${names.legacy} (kept), ${names.drafts[0]} (avoided)`,
            ),
          ).toBeVisible({ timeout: 15_000 });
          await translations.closeEditTranslation();
        } finally {
          await ai.stop();
        }
      });

      await test.step("Step 17: deleting a module removes it from its glossaries (C32)", async () => {
        const temp = await api.createModule(`e2e-spec8-temp-${tag}`);
        const scoped = await api.createGlossary({
          name: `Scoped${tag}`,
          isGlobal: false,
          moduleIds: [temp, ids.auth],
        });
        fixtures.extraGlossaries.push(scoped);
        await api.deleteModule(temp);
        await expect
          .poll(async () => (await api.getGlossary(scoped))?.moduleIds, { timeout: 30_000 })
          .toEqual([ids.auth]);
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Re-check and stale saves: violations follow glossary changes (steps 14, 16, 20)", async ({
    page,
  }) => {
    test.setTimeout(480_000);
    const translations = new TranslationsPage(page);
    const { api, fixtures, source, target } = await setUp(page);
    const violationsOf = async (keyName: string, moduleId: string) =>
      (await api.findKey(keyName, moduleId))?.glossaryViolations ?? [];

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids, tag } = fixtures;

      await test.step("Step 14: removing the forbidden value clears the stored violation and the Glossary issues filter (H28, H29)", async () => {
        await expect
          .poll(async () => (await violationsOf(names.ws, ids.billing)).length, { timeout: 60_000 })
          .toBeGreaterThan(0);
        await api.updateGlossary(ids.workspace, {
          translations: [
            { language: target.languageCode, value: "Arbeitsbereich", forbiddenValues: [] },
          ],
        });
        await expect
          .poll(async () => (await violationsOf(names.ws, ids.billing)).length, {
            timeout: 120_000,
            intervals: [2_000, 5_000],
          })
          .toBe(0);
        await openTranslations(page);
        await translations.openTranslationKeysTab();
        await translations.glossaryIssuesCheckbox.check();
        await translations.searchKeys(names.ws);
        await expect(page.getByRole("row").filter({ hasText: names.ws })).toHaveCount(0, {
          timeout: 15_000,
        });
        await translations.glossaryIssuesCheckbox.uncheck();
      });

      await test.step("Step 16: untagging a glossary from Billing removes that glossary's violation on a Billing key (H28)", async () => {
        const portal = `Portal${tag}`;
        const portalId = await api.createGlossary({
          name: portal,
          isGlobal: false,
          moduleIds: [ids.billing],
          rule: "translate",
          translations: [
            { language: target.languageCode, value: "Portal", forbiddenValues: ["Pforte"] },
          ],
        });
        fixtures.extraGlossaries.push(portalId);
        const keyName = `e2e.portal.${tag}`;
        await api.createKey({
          keyName,
          moduleId: ids.billing,
          culture: source.languageCode,
          value: `Open the ${portal}`,
          translations: [{ culture: target.languageCode, value: "Öffnen Sie die Pforte" }],
        });
        const hasPortalViolation = async () =>
          (await violationsOf(keyName, ids.billing)).some((v) => v.glossaryId === portalId);
        await expect.poll(hasPortalViolation, { timeout: 60_000 }).toBe(true);
        await api.updateGlossary(portalId, { moduleIds: [ids.auth] });
        await expect
          .poll(hasPortalViolation, { timeout: 120_000, intervals: [2_000, 5_000] })
          .toBe(false);
      });

      await test.step("Step 20: removing a tag in View Details keeps a translation saved meanwhile elsewhere (C20)", async () => {
        await translations.openKeyDetails(ids.authKey);
        await expect(
          page.getByRole("button", { name: `Remove ${names.billingTerm} from key` }),
        ).toBeVisible({ timeout: 15_000 });
        const stored = await api.findKey(names.authKey, ids.auth);
        expect(stored).toBeTruthy();
        await api.updateKey(stored!, {
          resources: [
            ...(stored!.resources ?? []),
            { culture: target.languageCode, value: "Von anderem Tab" },
          ],
        });
        await translations.captureKeySave(() =>
          page.getByRole("button", { name: `Remove ${names.billingTerm} from key` }).click(),
        );
        await expect
          .poll(async () => (await api.findKey(names.authKey, ids.auth))?.glossaryIds ?? [], {
            timeout: 15_000,
          })
          .toEqual([]);
        const resources = (await api.findKey(names.authKey, ids.auth))?.resources ?? [];
        expect(resources).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ culture: target.languageCode, value: "Von anderem Tab" }),
          ]),
        );
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Editor and insert edge cases (steps 18, 19)", async ({ page }) => {
    test.setTimeout(300_000);
    const glossary = new GlossaryPage(page);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids, tag } = fixtures;

      await test.step("Step 18: Escape on a dirty sheet asks first; Save & add another ignores a running Suggest all (C26, C27)", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.openNewGlossaryDialog();
        const name = `E2E Dirty ${tag}`;
        await glossary.fillGlossaryName(name);
        await page.keyboard.press("Escape");
        await expect(glossary.discardDialog).toBeVisible();
        await glossary.discardDialog.getByRole("button", { name: "Keep editing" }).click();
        await expect(glossary.editorSheet.getByRole("textbox", { name: "Name *" })).toHaveValue(
          name,
        );

        const slow = async (route: Route) => {
          await new Promise((resolve) => setTimeout(resolve, 3_000));
          await route.fulfill({ json: { content: "spät", isSuccess: true, errors: null } }).catch(
            () => undefined,
          );
        };
        await page.route(/\/Assistant\/GetTranslationSuggestion/, slow);
        try {
          await glossary.suggestAllButton.click();
          await glossary.saveAndAddAnother();
          await expect(
            page.getByText("Glossary item added successfully.", { exact: true }).first(),
          ).toBeVisible({ timeout: 20_000 });
          const created = await fixtures.api.findGlossaryId(name);
          if (created) fixtures.extraGlossaries.push(created);
          await page.waitForTimeout(4_000);
          await expect(glossary.translationField(target.languageCode)).toHaveValue("");
          await expect(glossary.editorSheet.getByRole("textbox", { name: "Name *" })).toHaveValue("");
        } finally {
          await page.unroute(/\/Assistant\/GetTranslationSuggestion/, slow);
        }
        await glossary.cancelEditor();
      });

      await test.step("Step 19: an inserted glossary moves to Already used and the button hides; its own wording offers no Add to glossary (C28, C29)", async () => {
        await translations.openKeyDetails(ids.ws);
        await translations.openEditTranslation(target.languageName);
        await translations.editTranslationTextarea.fill("");
        await translations.insertGlossaryButton.click();
        await translations
          .insertMenuGroup(`Insert in ${target.languageName}`)
          .getByRole("option", { name: new RegExp(names.workspace) })
          .click();
        await expect(translations.insertGlossaryButton).toHaveCount(0);
        await translations.openInsertMenuWithShortcut();
        await expect(
          translations
            .insertMenuGroup("Already used")
            .getByRole("option", { name: new RegExp(names.workspace) }),
        ).toHaveAttribute("aria-disabled", "true");
        await page.keyboard.press("Escape");
        await translations.selectSourceText(names.workspace);
        await page.waitForTimeout(300);
        await expect(translations.addToGlossaryButton).toHaveCount(0);
        await translations.closeEditTranslation();
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });
});
