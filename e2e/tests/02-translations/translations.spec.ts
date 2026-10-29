import { test, expect } from "../../support/test-base";
import {
  TranslationsPage,
  KeyDetailsPage,
  LocalizationApi,
  guardFullGlossaryLoads,
  isGlossaryMatchUrl,
  isTranslationSuggestionUrl,
  mockTranslationSuggestions,
  trackGlossaryMatches,
  type ApiGlossaryMatch,
  type ProjectLanguage,
  type SuggestionAppliedTerm,
} from "../../support/pages/translations.page";
import { ModulesPage } from "../../support/pages/modules.page";
import { ConfigurationPage } from "../../support/pages/configuration.page";
import { GlossaryPage } from "../../support/pages/glossary.page";
import {
  openConfiguration,
  openGlossary,
  openModules,
  openTranslations,
  openNewKey,
  openLogs,
} from "../../support/localization-helpers";
import { e2eBaseUrl } from "../../support/env";
import { readLocalizationProject } from "../../support/localization-project";
import fs from "fs";
import path from "path";

const CUSTOM_PROMPT = "Formal tone.";

/** Radix toasts are `role="status"` list items; an open one means a toast is showing. */
const OPEN_TOAST = 'li[role="status"][data-state="open"]';

const randomLetters = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

/**
 * Source and target language of the shared project. The spec's examples use en-US → de-DE;
 * projects differ per environment, so de-DE is used when present, else the first other language.
 */
async function resolveLanguages(api: LocalizationApi) {
  const languages = await api.languages();
  const source = languages.find((language) => language.isDefault) ?? languages[0];
  const others = languages.filter((language) => language.languageCode !== source?.languageCode);
  const target = others.find((language) => language.languageCode === "de-DE") ?? others[0];
  return source && target ? { source, target } : null;
}

/**
 * Per-run fixtures from spec §10 (EXAMPLES), created through the API with the Phase 6 structured
 * fields and unique names:
 * G1 "Workspace" (translate, variant, forbidden, global), G2 "SELISE" (keep, case-sensitive,
 * global), G3 "Portal" and G4 "Customer Portal" (module M), an unrelated term Gu (module M),
 * modules M and M2, and the keys. Terms carry a random letter suffix so they are whole words
 * that no other term in the shared project matches. `cleanup()` removes whatever was created.
 */
class SuggestionFixtures {
  readonly tag = randomLetters(8);
  readonly names = {
    g1: `Workspace${this.tag}`,
    g2: `SELISE${this.tag.toUpperCase()}`,
    g3: `Portal${this.tag}`,
    g4: `Customer Portal${this.tag}`,
    gu: `Unrelated${this.tag}`,
    m: `e2e-glossary-m-${this.tag}`,
    m2: `e2e-glossary-m2-${this.tag}`,
    ws: `e2e.ws.${this.tag}`,
    portal: `e2e.portal.${this.tag}`,
    other: `e2e.other.${this.tag}`,
    plain: `e2e.plain.${this.tag}`,
    selise: `e2e.selise.${this.tag}`,
  };
  readonly routes = { other: `/e2e/other-${this.tag}`, plain: `/e2e/plain-${this.tag}` };
  readonly ids: Record<
    "g1" | "g2" | "g3" | "g4" | "gu" | "m" | "m2" | "ws" | "portal" | "other" | "plain" | "selise",
    string
  > = {
    g1: "",
    g2: "",
    g3: "",
    g4: "",
    gu: "",
    m: "",
    m2: "",
    ws: "",
    portal: "",
    other: "",
    plain: "",
    selise: "",
  };
  private readonly created = {
    keys: [] as string[],
    glossaries: [] as string[],
    modules: [] as string[],
  };

  constructor(private readonly api: LocalizationApi) {}

  /** Keeps only this run's terms in the `/Glossary/Match` responses. */
  readonly isOwnMatch = (match: ApiGlossaryMatch) => match.term.toLowerCase().includes(this.tag);

  async create(source: ProjectLanguage, target: ProjectLanguage) {
    const t = target.languageCode;
    const { names, ids, created, api } = this;

    ids.m = await api.createModule(names.m);
    created.modules.push(ids.m);
    ids.m2 = await api.createModule(names.m2);
    created.modules.push(ids.m2);

    const glossaries = [
      {
        id: "g1",
        isGlobal: true,
        rule: "translate",
        variants: [`${names.g1}s`],
        translations: [{ language: t, value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] }],
      },
      { id: "g2", isGlobal: true, rule: "keep", caseSensitive: true },
      {
        id: "g3",
        moduleIds: [ids.m],
        rule: "translate",
        translations: [{ language: t, value: "Portal", forbiddenValues: [] }],
      },
      {
        id: "g4",
        moduleIds: [ids.m],
        rule: "translate",
        translations: [{ language: t, value: "Kundenportal", forbiddenValues: [] }],
      },
      { id: "gu", moduleIds: [ids.m], rule: "translate" },
    ] as const;
    for (const { id, ...glossary } of glossaries) {
      const itemId = await api.createGlossary({
        name: names[id],
        isGlobal: "isGlobal" in glossary ? glossary.isGlobal : false,
        moduleIds: "moduleIds" in glossary ? [...glossary.moduleIds] : [],
        rule: glossary.rule,
        caseSensitive: "caseSensitive" in glossary ? glossary.caseSensitive : false,
        variants: "variants" in glossary ? [...glossary.variants] : [],
        translations:
          "translations" in glossary
            ? glossary.translations.map((translation) => ({
                ...translation,
                forbiddenValues: [...translation.forbiddenValues],
              }))
            : [],
      });
      ids[id] = itemId;
      created.glossaries.push(itemId);
    }

    const keys = [
      { id: "ws", moduleId: ids.m, value: `Open your ${names.g1}` },
      {
        id: "portal",
        moduleId: ids.m,
        value: `Go to ${names.g4}`,
        context: CUSTOM_PROMPT,
        glossaryIds: [ids.gu],
      },
      // Tagged with Gu through View Details in the test (Q2 A).
      {
        id: "other",
        moduleId: ids.m2,
        value: names.g4,
        context: CUSTOM_PROMPT,
        routes: [this.routes.other],
      },
      {
        id: "plain",
        moduleId: ids.m,
        value: `Go to ${names.g4}`,
        context: CUSTOM_PROMPT,
        routes: [this.routes.plain],
      },
      { id: "selise", moduleId: ids.m, value: `${names.g2} login` },
    ] as const;
    for (const key of keys) {
      const itemId = await api.createKey({
        keyName: names[key.id],
        moduleId: key.moduleId,
        culture: source.languageCode,
        value: key.value,
        context: "context" in key ? key.context : undefined,
        routes: "routes" in key ? [...key.routes] : undefined,
        glossaryIds: "glossaryIds" in key ? [...key.glossaryIds] : undefined,
      });
      ids[key.id] = itemId;
      created.keys.push(itemId);
    }
  }

  /** Keys first (they reference the glossaries), then glossaries, then the modules. */
  async cleanup() {
    const attempt = async (what: string, action: () => Promise<unknown>) => {
      try {
        await action();
      } catch (error) {
        console.warn(`[e2e] Cleanup could not delete ${what}:`, error);
      }
    };
    for (const id of this.created.keys) await attempt(`key ${id}`, () => this.api.deleteKey(id));
    for (const id of this.created.glossaries) {
      await attempt(`glossary ${id}`, () => this.api.deleteGlossary(id));
    }
    for (const id of this.created.modules) {
      await attempt(`module ${id}`, () => this.api.deleteModule(id));
    }
  }
}

test.describe("Translations", () => {
  test("Translations — full flow", async ({ page }) => {
    test.setTimeout(420_000);
    const translations = new TranslationsPage(page);
    const keyDetails = new KeyDetailsPage(page);

    // The import fixture holds more than 30 keys so the Rows per page step always has a larger option.
    const jsonFile = path.resolve(__dirname, "../../test-data/Uilm_template.json");
    const importedKeyCount = (JSON.parse(fs.readFileSync(jsonFile, "utf8")) as unknown[]).length;
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

      // The empty state and any real entry are both valid outcomes.
      const noHistoryFound = page.getByText("No history found");
      const historyEntry = page
        .getByRole("button", { name: /(Inserted|Updated) by import by|Published by/ })
        .first();

      await expect
        .poll(async () => (await noHistoryFound.isVisible()) || (await historyEntry.isVisible()), {
          timeout: 10_000,
        })
        .toBe(true);

      if (await noHistoryFound.isVisible()) {
        await expect(noHistoryFound).toBeVisible();
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

      // Module names differ per project — pick one that actually exists.
      const moduleNames = await translations.getExportDialogModuleNames();
      expect(moduleNames.length).toBeGreaterThan(0);
      await translations.toggleModuleCheckbox(moduleNames[0]);
      await translations.expectModuleCheckboxChecked(moduleNames[0]);

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
      // isVisible() does not wait, so first wait for either the empty state or the list.
      await expect(
        noHistoryMessage.or(page.getByRole("columnheader", { name: "File Name" })),
      ).toBeVisible({ timeout: 15_000 });
      if (await noHistoryMessage.isVisible()) {
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

    await test.step("Publish Changes confirmation dialog triggers publish", async () => {
      await translations.openPublishChangesDialog();
      await translations.confirmPublishChanges();
      await translations.expectPublishChangesConfirmed();
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

    await test.step("New key route fields can be added, filled, and removed", async () => {
      await openNewKey(page);
      await translations.addRoute();
      await translations.fillFirstRoute(`e2e-route-${Date.now()}/{{ dynamic_routing }}`);
      await translations.removeFirstRoute();
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

    await test.step("Modules filter narrows the table and Reset clears it", async () => {
      await translations.openModulesFilter();
      const moduleName = await translations.selectFirstModuleFilterOption();
      await translations.closeFilterPopover();
      await translations.expectModuleFilterBadgeVisible(moduleName);
      await expect(page).toHaveURL(/moduleIds=/, { timeout: 10_000 });

      await translations.resetFilters();
      await translations.expectFiltersReset();
      await expect(page).not.toHaveURL(/moduleIds=/);
    });

    await test.step("Missing Translations filter applies and Reset clears it", async () => {
      await translations.openMissingTranslationsFilter();
      await translations.selectModuleFilterOption("English");
      await translations.closeFilterPopover();
      await expect(page).toHaveURL(/missingLanguages=/, { timeout: 10_000 });

      await translations.resetFilters();
      await expect(page).not.toHaveURL(/missingLanguages=/);
    });

    await test.step("Sorting by the Key column updates the query state", async () => {
      await translations.sortByKeyColumn();
      await translations.expectSortApplied(true);

      // Sorting back to the default (KeyName asc) clears the param entirely —
      // no filters remain, so the toolbar hides its Reset button.
      await translations.sortByKeyColumn();
      await expect(page).not.toHaveURL(/sort-isDescending=/);
    });

    await test.step("Bulk select reveals bulk actions and opens the delete confirmation", async () => {
      await translations.selectFirstKeyCheckbox();
      await translations.expectBulkActionsVisible();
      await translations.openBulkDeleteDialog();
      await translations.cancelBulkDeleteDialog();
    });

    await test.step("Bulk edit dialog opens for the selection and cancels cleanly", async () => {
      await translations.expectSelectionBannerVisible(1);
      await translations.openBulkEditDialog(1);
      await translations.cancelBulkEditDialog(1);
      await translations.expectSelectionBannerVisible(1);
    });

    await test.step("Bulk translate dialog opens for the selection and cancels cleanly", async () => {
      await translations.openBulkTranslateDialog();
      await translations.cancelBulkTranslateDialog();
      await translations.expectSelectionBannerVisible(1);
    });

    await test.step("Clear selection dismisses the bulk action banner", async () => {
      await translations.clearSelection();
      await translations.expectBulkActionsHidden();
    });

    await test.step("Rows per page selector changes the page size", async () => {
      // The page-size options follow the key count (dev 9818f4f), so wait until the
      // imported fixture keys are counted, then pick the first option above 10.
      await translations.waitForTotalKeyCountAtLeast(importedKeyCount);
      const options = await translations.openPageSizeOptions();
      expect(options[0]).toBe("10");
      const largerOption = options.find((label) => label !== "10");
      expect(largerOption, `page size options: ${options.join(", ")}`).toBeDefined();
      await translations.choosePageSizeOption(largerOption!);
      await translations.expectRowCountAtLeast(11);
      await translations.changePageSize(10);
    });

    await test.step("Translation Keys keeps Actions left and sticky on wide tables", async () => {
      const modules = new ModulesPage(page);
      const configuration = new ConfigurationPage(page);
      const glossary = new GlossaryPage(page);
      const inlineValue = `E2E sticky ${Date.now()}`;

      await page.setViewportSize({ width: 960, height: 900 });
      await openTranslations(page);
      await translations.openTranslationKeysTab();
      await translations.expectTranslationsHeadingVisible();
      await translations.expectFirstDataRowVisible();
      await translations.selectAllLanguagesInView();
      await translations.enableOptionalViewColumn("Completeness");
      await translations.enableOptionalViewColumn("Created Date");
      await translations.enableOptionalViewColumn("Last Updated Date");

      await translations.expectActionsColumnLeftOfKeyColumn();
      await translations.expectTableRequiresHorizontalScroll();
      await translations.scrollTranslationTableToEnd();
      await translations.expectStickySelectAndActionsVisible();
      await translations.expandFirstTranslationKey();
      await translations.expectInlineKeyEditorVisible();
      await translations.expectExpandedInlineRowSpansFullTableWidth();
      await translations.openExpandedRowOverflowActions();
      await translations.expectExpandedRowOverflowMenuVisible();
      await translations.closeExpandedRowOverflowMenu();
      await translations.editFirstInlineTranslationAndSave(inlineValue);
      await translations.expectInlineTranslationSaved();

      const viewLanguages = await translations.getViewLanguageNames();
      const languageToToggle = viewLanguages[0];
      if (languageToToggle) {
        await translations.toggleViewLanguage(languageToToggle);
        await translations.expectActionsColumnLeftOfKeyColumn();
        await translations.toggleViewLanguage(languageToToggle);
        await translations.expectActionsColumnLeftOfKeyColumn();
      }

      await translations.toggleOptionalViewColumn("Completeness");
      await translations.expectActionsColumnLeftOfKeyColumn();
      await translations.toggleOptionalViewColumn("Completeness");

      await openModules(page);
      await modules.expectPageLoaded();
      await modules.expectActionsColumnIsLast();

      await openConfiguration(page);
      await configuration.expectPageLoaded();
      await configuration.expectLanguagesSectionVisible();
      await configuration.expectActionsColumnIsLast();

      await openGlossary(page);
      await glossary.expectPageLoaded();
      await glossary.expectActionsColumnIsLastIfTableVisible();

      await openTranslations(page);
      await translations.openTranslationKeysTab();
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

test.describe("Translations — glossary-aware suggestions (#354)", () => {
  /** Opens Translations and creates this run's fixtures. */
  async function setUp(page: import("@playwright/test").Page) {
    const api = await LocalizationApi.capture(page);
    const languages = await resolveLanguages(api);
    test.skip(!languages, "The shared project needs a language besides the default one.");
    const fixtures = new SuggestionFixtures(api);
    return { api, fixtures, ...languages! };
  }

  /** Resolves with the next GetSuggestedGlossaries response (View Details suggestions). */
  const suggestionsLoaded = (page: import("@playwright/test").Page) =>
    page.waitForResponse((response) => /\/Glossary\/GetSuggestedGlossaries/.test(response.url()), {
      timeout: 20_000,
    });

  test("Edit translation: one request, server violations, Fix and Retry (SPEC7 H4-H6, H13, C1, C2, C11, C14, C20)", async ({
    page,
  }) => {
    test.setTimeout(360_000);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids } = fixtures;
      const fullLoads = guardFullGlossaryLoads(page);
      const matches = await trackGlossaryMatches(page, fixtures.isOwnMatch);
      const ai = await mockTranslationSuggestions(page);
      const dialog = translations.editTranslationDialog;
      const textarea = translations.editTranslationTextarea;
      const sourceText = `Open your ${names.g1}`;
      const appliedG1: SuggestionAppliedTerm = {
        glossaryId: ids.g1,
        term: names.g1,
        rule: "translate",
        expected: "Arbeitsbereich",
      };
      const forbiddenUsed = {
        glossaryId: ids.g1,
        term: names.g1,
        kind: "forbidden-used",
        found: "Werkbereich",
      } as const;

      await translations.openKeyDetails(ids.ws);

      await test.step("H6, C11: one /Match per distinct text; reopening reuses it", async () => {
        await translations.openEditTranslation(target.languageName);
        await expect(translations.glossaryTerm(dialog, names.g1)).toHaveText(names.g1, {
          timeout: 15_000,
        });
        await expect.poll(() => matches.forText(sourceText).length).toBe(1);
        expect(matches.forText(sourceText)[0]).toMatchObject({
          language: source.languageCode,
          keyId: ids.ws,
        });
        await translations.closeEditTranslation();

        // C11: the same text within 5 minutes is answered from the cache.
        await translations.openEditTranslation(target.languageName);
        await expect(translations.glossaryTerm(dialog, names.g1)).toBeVisible();
        await page.waitForTimeout(1_000);
        expect(matches.forText(sourceText)).toHaveLength(1);
        await translations.closeEditTranslation();
      });

      await test.step("H4, C14: exactly one request with the key's own context, tags, module and codes", async () => {
        ai.script({ content: "Öffnen Sie Ihren Arbeitsbereich", appliedTerms: [appliedG1] });
        await translations.openEditTranslation(target.languageName);
        await expect(dialog.getByText(`${source.languageName} (default)`)).toBeVisible();
        await translations.clickAutoTranslateInDialog();
        await expect(textarea).toHaveValue("Öffnen Sie Ihren Arbeitsbereich");
        // C14: the server owns the retry, so the client never sends a second request.
        await page.waitForTimeout(1_500);
        expect(ai.requests).toHaveLength(1);
        const [request] = ai.requests;
        expect(request).toMatchObject({
          sourceText,
          destinationLanguage: target.languageName,
          currentLanguage: source.languageName,
          currentLanguageCode: source.languageCode,
          destinationLanguageCode: target.languageCode,
          temperature: 0.1,
          glossaryIds: [],
          moduleId: ids.m,
        });
        // H4: the key has no context of its own, so none is sent (no client prompt).
        expect(request).not.toHaveProperty("elementDetailContext");
        await expect(translations.violationList(dialog)).toHaveCount(0);
        await translations.closeEditTranslation();
      });

      await test.step("H5, C20: server violations are listed; Fix uses the applied translation", async () => {
        ai.script({
          content: "Öffnen Sie Ihren Werkbereich",
          appliedTerms: [appliedG1],
          glossaryViolations: [
            forbiddenUsed,
            {
              glossaryId: ids.g1,
              term: names.g1,
              kind: "missing-translation",
              expected: "Arbeitsbereich",
            },
          ],
        });
        await translations.openEditTranslation(target.languageName);
        await translations.clickAutoTranslateInDialog();
        await expect(textarea).toHaveValue("Öffnen Sie Ihren Werkbereich");
        const forbidden = translations.violationItem(dialog, '"Werkbereich" is not allowed');
        const missing = translations.violationItem(
          dialog,
          `Expected "Arbeitsbereich" for "${names.g1}"`,
        );
        await expect(forbidden).toBeVisible();
        await expect(missing).toBeVisible();
        expect(ai.requests).toHaveLength(1);
        // No deterministic fix for a missing translation: Retry.
        await expect(missing.getByRole("button", { name: "Retry" })).toBeVisible();
        // Warnings never block saving.
        await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled();
        // C20: Fix inserts the applied Translate term's expected value.
        await forbidden.getByRole("button", { name: "Fix" }).click();
        await expect(textarea).toHaveValue("Öffnen Sie Ihren Arbeitsbereich");
        await expect(translations.violationList(dialog)).toHaveCount(0);
        expect(ai.requests).toHaveLength(1);
        await translations.closeEditTranslation();
      });

      await test.step("C20: without an applied Translate value there is no Fix; Retry sends one request", async () => {
        ai.script(
          { content: "Öffnen Sie Ihren Werkbereich", glossaryViolations: [forbiddenUsed] },
          { content: "Öffnen Sie Ihren Bereich" },
        );
        await translations.openEditTranslation(target.languageName);
        await translations.clickAutoTranslateInDialog();
        const forbidden = translations.violationItem(dialog, '"Werkbereich" is not allowed');
        await expect(forbidden).toBeVisible();
        await expect(forbidden.getByRole("button", { name: "Fix" })).toHaveCount(0);
        await forbidden.getByRole("button", { name: "Retry" }).click();
        await expect(textarea).toHaveValue("Öffnen Sie Ihren Bereich");
        expect(ai.requests).toHaveLength(2);
        await expect(translations.violationList(dialog)).toHaveCount(0);
        await translations.closeEditTranslation();
      });

      await test.step("C1: empty arrays (server flag off) show the content without a list", async () => {
        ai.script({ content: "Öffnen Sie Ihren Werkbereich" });
        await translations.openEditTranslation(target.languageName);
        await translations.clickAutoTranslateInDialog();
        await expect(textarea).toHaveValue("Öffnen Sie Ihren Werkbereich");
        await page.waitForTimeout(1_000);
        await expect(translations.violationList(dialog)).toHaveCount(0);
        expect(ai.requests).toHaveLength(1);
        await translations.closeEditTranslation();
      });

      await test.step("C2: a failing /Match renders plain text, no warnings and no toast", async () => {
        const fail = (route: import("@playwright/test").Route) =>
          route.fulfill({ status: 500, json: { errors: "scripted failure" } });
        await page.route(isGlossaryMatchUrl, fail);
        try {
          // A reload empties the 5-minute match cache.
          await page.reload();
          await expect(page.getByRole("button", { name: "Tag Glossary" })).toBeVisible({
            timeout: 15_000,
          });
          const failed = page.waitForResponse((response) =>
            isGlossaryMatchUrl(new URL(response.url())),
          );
          await translations.openEditTranslation(target.languageName);
          await failed;
          await page.waitForTimeout(500);
          await expect(translations.glossaryTerm(dialog, names.g1)).toHaveCount(0);
          await expect(dialog.getByText(sourceText, { exact: true })).toBeVisible();
          await textarea.fill("Öffnen Sie Ihren Werkbereich");
          await page.waitForTimeout(500);
          await expect(translations.violationList(dialog)).toHaveCount(0);
          await expect(page.locator(OPEN_TOAST)).toHaveCount(0);
          await translations.closeEditTranslation();
        } finally {
          await page.unroute(isGlossaryMatchUrl, fail);
        }
      });

      await test.step("H13: the full glossary is never loaded", async () => {
        expect(fullLoads.urls).toEqual([]);
        fullLoads.stop();
      });

      await test.step("Smoke: the real backend accepts the request and answers the new shape", async () => {
        // Un-mocked: proves contract compatibility only (HTTP 200), not AI adherence.
        await ai.stop();
        await page.reload();
        await expect(page.getByRole("button", { name: "Tag Glossary" })).toBeVisible({
          timeout: 15_000,
        });
        await translations.openEditTranslation(target.languageName);
        const responsePromise = page.waitForResponse(
          (response) => isTranslationSuggestionUrl(new URL(response.url())),
          { timeout: 90_000 },
        );
        await translations.clickAutoTranslateInDialog();
        const response = await responsePromise;
        expect(response.status()).toBe(200);
        expect(response.request().postDataJSON()).toMatchObject({
          currentLanguageCode: source.languageCode,
          moduleId: ids.m,
        });
        const body = (await response.json()) as Record<string, unknown>;
        expect(typeof body.content).toBe("string");
        expect(Array.isArray(body.appliedTerms)).toBe(true);
        expect(Array.isArray(body.glossaryViolations)).toBe(true);
        await translations.closeEditTranslation();
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Inline editor and View Details suggestions (SPEC7 H4, H9)", async ({ page }) => {
    test.setTimeout(360_000);
    const translations = new TranslationsPage(page);
    const { api, fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids, routes } = fixtures;
      const ai = await mockTranslationSuggestions(page);
      const tagButton = (name: string) => page.getByRole("button", { name: `Tag ${name} to key` });

      await test.step("Inline suggest: one request with the key's context, tags and module (H4)", async () => {
        await openTranslations(page);
        await translations.openTranslationKeysTab();
        await translations.expandKey(names.portal);
        ai.script({
          content: "Gehe zum Kundenportal",
          appliedTerms: [
            { glossaryId: ids.g4, term: names.g4, rule: "translate", expected: "Kundenportal" },
          ],
        });
        await translations.clickInlineAutoTranslate(target.languageName);
        await expect(translations.inlineTranslation(target.languageName)).toHaveValue(
          "Gehe zum Kundenportal",
        );
        await page.waitForTimeout(1_000);
        expect(ai.requests).toHaveLength(1);
        // H4: the key's own custom prompt, its tags and module; the server adds the rules.
        expect(ai.requests[0]).toMatchObject({
          sourceText: `Go to ${names.g4}`,
          currentLanguage: source.languageName,
          currentLanguageCode: source.languageCode,
          destinationLanguageCode: target.languageCode,
          elementDetailContext: CUSTOM_PROMPT,
          glossaryIds: [ids.gu],
          moduleId: ids.m,
        });
        await page.getByRole("button", { name: "Discard" }).click();
      });

      await test.step("Module M's terms are not suggested for e2e.portal (server scope)", async () => {
        const loaded = suggestionsLoaded(page);
        await translations.openKeyDetails(ids.portal);
        await loaded;
        await page.waitForTimeout(1_000);
        // G3 and G4 already apply through module M, so neither is a suggestion.
        await expect(tagButton(names.g4)).toHaveCount(0);
        await expect(tagButton(names.g3)).toHaveCount(0);
      });

      await test.step("Tag e2e.other with an unrelated term first", async () => {
        await translations.openKeyDetails(ids.other);
        await page.getByRole("button", { name: "Tag Glossary" }).click();
        const tagDialog = page.getByRole("dialog", { name: "Tag Glossary" });
        await expect(tagDialog).toBeVisible();
        await tagDialog.getByRole("combobox").click();
        await tagDialog.getByPlaceholder("Search glossary...").fill(names.gu);
        await tagDialog.getByRole("option", { name: names.gu }).click();
        // The picker is multi-select and stays open over the footer; close it before Save.
        // Escape closes only the picker's popover; the dialog stays open.
        const pickerSearch = tagDialog.getByPlaceholder("Search glossary...");
        await pickerSearch.press("Escape");
        await expect(pickerSearch).toBeHidden();
        await expect(tagDialog).toBeVisible();
        const payload = await translations.captureKeySave(() =>
          tagDialog.getByRole("button", { name: "Save", exact: true }).click(),
        );
        expect(payload.glossaryIds).toEqual([ids.gu]);
        await expect(page.getByText("Glossary updated successfully", { exact: true })).toBeVisible({
          timeout: 15_000,
        });
      });

      await test.step("H9: G4 is suggested despite the tag; Add keeps the key", async () => {
        // Reopen so View Details works from the saved key (with its Gu tag).
        const loaded = suggestionsLoaded(page);
        await page.reload();
        await loaded;
        // H9: the server suggests the untagged term of another module although a tag exists;
        // G3 is inside the longer G4 match, so it is not a candidate.
        await expect(tagButton(names.g4)).toBeVisible({ timeout: 15_000 });
        await expect(tagButton(names.g3)).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Add all suggested" })).toBeVisible();

        const payload = await translations.captureKeySave(() => tagButton(names.g4).click());
        // The full key is saved with context, routes and resources unchanged, G4 added.
        expect(payload).toMatchObject({
          itemId: ids.other,
          keyName: names.other,
          moduleId: ids.m2,
          context: CUSTOM_PROMPT,
          routes: [routes.other],
          glossaryIds: [ids.gu, ids.g4],
        });
        expect(payload.resources).toEqual([
          expect.objectContaining({ culture: source.languageCode, value: names.g4 }),
        ]);

        // Reopen: the custom prompt is unchanged and G4 is now a tag, not a suggestion.
        await expect
          .poll(async () => (await api.findKey(names.other, ids.m2))?.glossaryIds ?? [], {
            timeout: 15_000,
          })
          .toEqual(expect.arrayContaining([ids.gu, ids.g4]));
        const reloaded = suggestionsLoaded(page);
        await page.reload();
        await expect(page.getByText(CUSTOM_PROMPT, { exact: true })).toBeVisible({
          timeout: 15_000,
        });
        expect((await api.findKey(names.other, ids.m2))?.context).toBe(CUSTOM_PROMPT);
        await reloaded;
        await page.waitForTimeout(1_000);
        await expect(tagButton(names.g4)).toHaveCount(0);
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Translator experience: highlights, Insert, live checks (SPEC4 steps 1-3, 7, 10; SPEC7 C18)", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const translations = new TranslationsPage(page);
    const { api, fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids } = fixtures;
      const matches = await trackGlossaryMatches(page, fixtures.isOwnMatch);
      const dialog = translations.editTranslationDialog;
      const textarea = translations.editTranslationTextarea;

      await translations.openKeyDetails(ids.ws);

      await test.step("Step 1: highlight, popover, Insert, Escape returns focus (H1-H3, C12)", async () => {
        await translations.openEditTranslation(target.languageName);
        const term = translations.glossaryTerm(dialog, names.g1);
        // H1: the match is a dotted-underlined button whose text is the source substring.
        await expect(term).toHaveText(names.g1, { timeout: 15_000 });
        await term.click();
        const popover = translations.termPopover;
        await expect(popover.getByText(names.g1, { exact: true })).toBeVisible();
        await expect(popover.getByText("Translate", { exact: true })).toBeVisible();
        await expect(popover.getByText("Arbeitsbereich", { exact: true })).toBeVisible();
        await textarea.fill("");
        await term.click();
        await popover.getByRole("button", { name: "Insert" }).click();
        await expect(textarea).toHaveValue("Arbeitsbereich");
        await expect(textarea).toBeFocused();
        // C12: Escape closes only the popover and returns focus to the term.
        await term.focus();
        await page.keyboard.press("Enter");
        await expect(popover).toBeVisible();
        // The value is now in the target, so Insert gives way to "Already used".
        await expect(popover.getByText("Already used")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(popover).toHaveCount(0);
        await expect(term).toBeFocused();
        await expect(dialog).toBeVisible();
      });

      await test.step("Step 2: Open term opens a new tab and keeps the text (H4)", async () => {
        await textarea.fill("Ungespeicherter Text");
        await translations.glossaryTerm(dialog, names.g1).click();
        const [newPage] = await Promise.all([
          page.context().waitForEvent("page"),
          translations.termPopover.getByRole("button", { name: "Open term" }).click(),
        ]);
        await expect(newPage).toHaveURL(new RegExp(`/services/glossary/${ids.g1}$`));
        await newPage.close();
        await expect(textarea).toHaveValue("Ungespeicherter Text");
      });

      await test.step("Step 3: live warning while typing, Fix, Save enabled (H5, H6, C6)", async () => {
        await textarea.fill("Öffnen Sie Ihren Werkbereich");
        const forbidden = translations.violationItem(dialog, '"Werkbereich" is not allowed');
        // H5: shown 150 ms after typing stops (budget 500 ms; 2 s for CI jitter).
        await expect(forbidden).toBeVisible({ timeout: 2_000 });
        await expect(dialog.getByRole("button", { name: "Save" })).toBeEnabled();
        await forbidden.getByRole("button", { name: "Fix" }).click();
        await expect(textarea).toHaveValue("Öffnen Sie Ihren Arbeitsbereich");
        await expect(translations.violationList(dialog)).toHaveCount(0);
        await translations.closeEditTranslation();
      });

      await test.step("Step 7: the term popover fits a 390 px screen (C11)", async () => {
        const size = page.viewportSize();
        await page.setViewportSize({ width: 390, height: 844 });
        try {
          await translations.openEditTranslation(target.languageName);
          await translations.glossaryTerm(dialog, names.g1).click();
          const box = await translations.termPopover.boundingBox();
          expect(box).not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(390);
          await page.keyboard.press("Escape");
          await translations.closeEditTranslation();
        } finally {
          if (size) await page.setViewportSize(size);
        }
      });

      await test.step("Step 10: each inline row checks its own glossary terms (H12, H13)", async () => {
        const languages = await api.languages();
        const targets = languages.filter((language) => !language.isDefault);
        await openTranslations(page);
        await translations.openTranslationKeysTab();
        await translations.expandKey(names.ws);
        const checklist = translations.glossaryChecklist(page, target.languageName);
        await expect(checklist).toBeVisible({ timeout: 15_000 });
        // H12: the row lists the approved value; there is no shared Insert.
        await expect(checklist.getByText("Arbeitsbereich", { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: /^Insert/ })).toHaveCount(0);
        // H13: typing the approved value marks the term followed in that row only.
        await translations.inlineTranslation(target.languageName).fill("Arbeitsbereich");
        await expect(checklist.getByText("All glossary terms followed")).toBeVisible();
        const other = targets.find((language) => language.languageCode !== target.languageCode);
        if (other) {
          // A language without a value for the term says so (C3).
          await expect(
            translations
              .glossaryChecklist(page, other.languageName)
              .getByText(/No translation in the glossary/),
          ).toBeVisible();
        }
      });

      await test.step("SPEC7 C18: typing in the source sends /Match only after typing stops", async () => {
        const sourceField = translations.inlineTranslation(source.languageName);
        await expect(sourceField).toBeVisible();
        const before = matches.requests.length;
        await sourceField.click();
        await sourceField.press("End");
        // 10 characters, 50 ms apart: well inside the 300 ms debounce.
        await sourceField.pressSequentially("abcdefghij", { delay: 50 });
        await page.waitForTimeout(1_500);
        const sent = matches.requests.slice(before);
        expect(sent.length).toBeLessThanOrEqual(1);
        if (sent.length === 1) {
          expect(sent[0].text).toBe(await sourceField.inputValue());
        }
        await page.getByRole("button", { name: "Discard" }).click();
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Keep terms keep inactive values but never apply them (step 9; SPEC7 C6, C20)", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids } = fixtures;
      const glossary = new GlossaryPage(page);
      const updated = page.getByText("Glossary item updated successfully.", { exact: true });

      await test.step("Switch G2 to Translate with values, then back to Keep", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.openEditFromList(names.g2);
        await glossary.setRule("Translate");
        await glossary.fillTranslation(target.languageCode, "Selise GmbH");
        await glossary.addForbidden(target.languageCode, "Selis");
        await glossary.saveAndCapturePayload();
        await expect(updated.first()).toBeVisible({ timeout: 20_000 });

        await glossary.openEditFromList(names.g2);
        await glossary.setRule("Keep");
        const payload = await glossary.saveAndCapturePayload();
        await expect(updated.first()).toBeVisible({ timeout: 20_000 });
        // The now-inactive values stay in the structured fields (Phase 2 A9, SPEC7 C6).
        expect(payload).toMatchObject({
          rule: "keep",
          caseSensitive: true,
          translations: [
            { language: target.languageCode, value: "Selise GmbH", forbiddenValues: ["Selis"] },
          ],
        });
        expect(String(payload.additionalNote ?? "")).not.toContain("@@glossary-meta");
      });

      await test.step("Suggest for a SELISE source: Keep has no active values (C20)", async () => {
        const ai = await mockTranslationSuggestions(page);
        const matched = page.waitForResponse(
          (response) =>
            isGlossaryMatchUrl(new URL(response.url())) &&
            String(response.request().postDataJSON()?.text ?? "").includes(names.g2),
          { timeout: 20_000 },
        );
        await translations.openKeyDetails(ids.selise);
        await translations.openEditTranslation(target.languageName);
        // /Match sends only the values active under the rule: none for Keep.
        const body = (await (await matched).json()) as { matches: ApiGlossaryMatch[] };
        const g2 = body.matches.find((match) => match.glossaryId === ids.g2);
        expect(g2).toMatchObject({ rule: "keep", translations: [] });

        ai.script({
          content: `${names.g2} Selis Anmeldung`,
          appliedTerms: [{ glossaryId: ids.g2, term: names.g2, rule: "keep" }],
        });
        await translations.clickAutoTranslateInDialog();
        await expect(translations.editTranslationTextarea).toHaveValue(
          `${names.g2} Selis Anmeldung`,
        );
        // "Selis" is an inactive forbidden value under Keep: not a violation, one request only.
        await page.waitForTimeout(1_500);
        expect(ai.requests).toHaveLength(1);
        await expect(translations.violationList(translations.editTranslationDialog)).toHaveCount(0);
        await translations.closeEditTranslation();
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });
});
