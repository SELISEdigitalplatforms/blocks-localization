import type { Page, Request, Route } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { GlossaryPage } from "../../support/pages/glossary.page";
import {
  LocalizationApi,
  TranslationsPage,
  guardFullGlossaryLoads,
  trackGlossaryMatches,
  type ApiGlossaryMatch,
  type ProjectLanguage,
} from "../../support/pages/translations.page";
import { openGlossary, openTranslations } from "../../support/localization-helpers";

const META_PREFIX = "@@glossary-meta:v1@@";
/** Radix toasts are `role="status"` list items; an open one means a toast is showing. */
const OPEN_TOAST = 'li[role="status"][data-state="open"]';

const randomLetters = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

/**
 * Per-run fixtures (§10): an Approved G1, a Draft G5, a Deprecated G6, a legacy term saved the
 * Track A way (v1 JSON in `additionalNote`, no structured fields), a term of another module that
 * the server suggests, and a key in module M whose source contains G1, G5, G6 and the suggestion,
 * tagged with three terms.
 */
class Spec7Fixtures {
  readonly tag = randomLetters(8);
  readonly names = {
    g1: `Workspace${this.tag}`,
    g5: `Dashboard${this.tag}`,
    g6: `OldPortal${this.tag}`,
    legacy: `Legacy${this.tag}`,
    suggested: `Gadget${this.tag}`,
    m: `e2e-spec7-m-${this.tag}`,
    m2: `e2e-spec7-m2-${this.tag}`,
    key: `e2e.spec7.${this.tag}`,
  };
  readonly ids = { g1: "", g5: "", g6: "", legacy: "", suggested: "", m: "", m2: "", key: "" };
  source = "";
  /** Glossaries created through the UI during the test, deleted in `cleanup`. */
  readonly extraGlossaries: string[] = [];

  constructor(private readonly api: LocalizationApi) {}

  readonly isOwnMatch = (match: ApiGlossaryMatch) => match.term.toLowerCase().includes(this.tag);

  async create(source: ProjectLanguage, target: ProjectLanguage) {
    const { api, names, ids } = this;
    const t = target.languageCode;
    ids.m = await api.createModule(names.m);
    ids.m2 = await api.createModule(names.m2);
    ids.g1 = await api.createGlossary({
      name: names.g1,
      isGlobal: true,
      rule: "translate",
      status: "approved",
      translations: [{ language: t, value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] }],
    });
    ids.g5 = await api.createGlossary({
      name: names.g5,
      isGlobal: true,
      rule: "translate",
      status: "draft",
      translations: [{ language: t, value: "Übersicht", forbiddenValues: [] }],
    });
    ids.g6 = await api.createGlossary({
      name: names.g6,
      isGlobal: true,
      rule: "translate",
      status: "deprecated",
    });
    // An older client's save: no structured fields, terminology in the v1 note (Phase 6 H17).
    ids.legacy = await api.createGlossary({
      name: names.legacy,
      isGlobal: false,
      moduleIds: [ids.m2],
      additionalNote: `${META_PREFIX}${JSON.stringify({ rule: "keep", note: "legacy brand" })}`,
    });
    ids.suggested = await api.createGlossary({
      name: names.suggested,
      isGlobal: false,
      moduleIds: [ids.m2],
      rule: "translate",
    });
    this.source = `Open your ${names.g1} and ${names.g5} ${names.g6} ${names.suggested}`;
    ids.key = await api.createKey({
      keyName: names.key,
      moduleId: ids.m,
      culture: source.languageCode,
      value: this.source,
      glossaryIds: [ids.g1, ids.g5, ids.legacy],
    });
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
    if (ids.key) await attempt(`key ${ids.key}`, () => api.deleteKey(ids.key));
    for (const id of [ids.g1, ids.g5, ids.g6, ids.legacy, ids.suggested, ...this.extraGlossaries]) {
      if (id) await attempt(`glossary ${id}`, () => api.deleteGlossary(id));
    }
    for (const id of [ids.m, ids.m2]) {
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
  test.skip(!source || !target, "The shared project needs a language besides the default one.");
  return { api, fixtures: new Spec7Fixtures(api), source: source!, target: target! };
}

const isGlossaryGets = (request: Request) => /\/Glossary\/Gets(\?|$)/.test(request.url());

test.describe("Glossary — frontend on the new backend (SPEC7)", () => {
  test("Editor, Status, Draft highlights, GetByIds, suggestions and Usage", async ({ page }) => {
    test.setTimeout(420_000);
    const glossary = new GlossaryPage(page);
    const translations = new TranslationsPage(page);
    const { api, fixtures, source, target } = await setUp(page);
    const fullLoads = guardFullGlossaryLoads(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids } = fixtures;

      await test.step("H3: a legacy term opens with its structured values and its note", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.openEditFromList(names.legacy);
        await expect(glossary.editorSheet.getByRole("radio", { name: "Keep" })).toBeChecked();
        await glossary.expectInternalNote("legacy brand");
        await expect(glossary.statusSelect).toHaveText("Approved");
      });

      await test.step("H1: saving sends structured fields, a plain note and no marker", async () => {
        const payload = await glossary.saveAndCapturePayload();
        await expect(
          page.getByText("Glossary item updated successfully.", { exact: true }),
        ).toBeVisible({ timeout: 20_000 });
        expect(payload).toMatchObject({
          rule: "keep",
          status: "approved",
          caseSensitive: false,
          variants: [],
          additionalNote: "legacy brand",
        });
        expect(typeof payload.version).toBe("number");
        expect(String(payload.additionalNote)).not.toContain("@@glossary-meta");
        expect(String(payload.context ?? "")).not.toContain("⟦rule:");
      });

      await test.step("H2, H15: a new term shows Variants and Case-sensitive and defaults to Approved", async () => {
        const name = `E2E New ${fixtures.tag}`;
        await glossary.openNewGlossaryDialog();
        await expect(glossary.variantsInput).toBeVisible();
        await expect(glossary.caseSensitiveSwitch).toBeVisible();
        await expect(glossary.statusSelect).toHaveText("Approved");
        await expect(
          glossary.editorSheet.getByText("Only Approved terms are sent to the AI."),
        ).toBeVisible();
        await glossary.fillGlossaryName(name);
        await glossary.addVariant(`${name}s`);
        await glossary.setCaseSensitive(true);
        await glossary.fillDefinition("A new term.");
        const payload = await glossary.saveAndCapturePayload();
        await glossary.expectAddSuccess(name);
        const created = await api.findGlossaryId(name);
        if (created) fixtures.extraGlossaries.push(created);
        expect(payload).toMatchObject({
          name,
          status: "approved",
          rule: "translate",
          caseSensitive: true,
          variants: [`${name}s`],
          context: "A new term.",
          additionalNote: "",
        });

        await glossary.openEditFromList(name);
        await glossary.setStatus("Draft");
        const edited = await glossary.saveAndCapturePayload();
        await expect(
          page.getByText("Glossary item updated successfully.", { exact: true }),
        ).toBeVisible({ timeout: 20_000 });
        expect(edited.status).toBe("draft");
      });

      await test.step("H7, C12: a Draft term is highlighted with its notice; a Deprecated one is not", async () => {
        const matches = await trackGlossaryMatches(page, fixtures.isOwnMatch);
        try {
          await translations.openKeyDetails(ids.key);
          const dialog = await translations.openEditTranslation(target.languageName);
          await expect(translations.glossaryTerm(dialog, names.g1)).toBeVisible({
            timeout: 15_000,
          });
          const draft = translations.glossaryTerm(dialog, names.g5);
          await expect(draft).toBeVisible();
          await draft.click();
          const popover = translations.termPopover;
          await expect(popover.getByText("Draft", { exact: true })).toBeVisible();
          await expect(popover.getByText("Draft: not sent to the AI")).toBeVisible();
          await page.keyboard.press("Escape");
          // C12: the server leaves Deprecated terms out of /Match.
          await expect(translations.glossaryTerm(dialog, names.g6)).toHaveCount(0);
          expect(matches.forText(fixtures.source)).toHaveLength(1);
          await translations.closeEditTranslation();
        } finally {
          await matches.stop();
        }
      });

      await test.step("H8, H9: tags outside the first page come from one GetByIds; suggestions show despite tags", async () => {
        // The first page (Gets?PageSize=100) holds none of the tags, so all three are missing.
        const emptyFirstPage = async (route: Route) => {
          const url = new URL(route.request().url());
          if (url.searchParams.get("ModuleId") || url.searchParams.get("IsGlobal")) {
            return route.fallback();
          }
          return route.fulfill({ json: { items: [], totalCount: 0 } });
        };
        const byIds: string[][] = [];
        const onRequest = (request: Request) => {
          if (/\/Glossary\/GetByIds/.test(request.url())) {
            byIds.push(new URL(request.url()).searchParams.getAll("itemIds"));
          }
        };
        await page.route(/\/Glossary\/Gets(\?|$)/, emptyFirstPage);
        page.on("request", onRequest);
        try {
          const suggestions = page.waitForResponse((response) =>
            /\/Glossary\/GetSuggestedGlossaries/.test(response.url()),
          );
          await translations.openKeyDetails(ids.key);
          for (const name of [names.g1, names.g5, names.legacy]) {
            await expect(page.getByText(name, { exact: true }).first()).toBeVisible({
              timeout: 15_000,
            });
          }
          // H8: one request for the three ids (⌈3/100⌉ = 1).
          expect(byIds).toHaveLength(1);
          expect([...byIds[0]].sort()).toEqual([ids.g1, ids.g5, ids.legacy].sort());
          // H9: the server's suggestion is shown although the key has tags.
          await suggestions;
          await expect(
            page.getByRole("button", { name: `Tag ${names.suggested} to key` }),
          ).toBeVisible({ timeout: 15_000 });
        } finally {
          page.off("request", onRequest);
          await page.unroute(/\/Glossary\/Gets(\?|$)/, emptyFirstPage);
        }
      });

      await test.step("H10: the delete dialog counts keys with one Usage request", async () => {
        const usage: string[] = [];
        const onRequest = (request: Request) => {
          if (/\/Glossary\/Usage/.test(request.url())) usage.push(request.url());
        };
        page.on("request", onRequest);
        try {
          await openGlossary(page);
          await glossary.expectPageLoaded();
          await glossary.searchGlossaries(names.g1);
          await glossary.openDeleteGlossaryDialog(names.g1);
          await glossary.expectDeleteUsage("Used by 1 key");
          expect(usage).toHaveLength(1);
          const url = new URL(usage[0]);
          expect(url.searchParams.get("itemId")).toBe(ids.g1);
          expect(url.searchParams.get("pageSize")).toBe("1");
          await glossary.deleteGlossaryDialog.getByRole("button", { name: "Cancel" }).click();
        } finally {
          page.off("request", onRequest);
        }
      });

      await test.step("C8: a failing Usage disables delete and offers Retry", async () => {
        const fail = (route: Route) =>
          route.fulfill({ status: 500, json: { errors: "scripted failure" } });
        await page.route(/\/Glossary\/Usage/, fail);
        try {
          await glossary.openDeleteGlossaryDialog(names.g1);
          const dialog = glossary.deleteGlossaryDialog;
          await expect(
            dialog.getByText("Failed to check how many keys use this glossary."),
          ).toBeVisible({ timeout: 15_000 });
          await expect(dialog.getByRole("button", { name: "Retry" })).toBeVisible();
          await expect(dialog.getByRole("button", { name: "Delete" })).toBeDisabled();
          await dialog.getByRole("button", { name: "Cancel" }).click();
        } finally {
          await page.unroute(/\/Glossary\/Usage/, fail);
        }
      });

      await test.step("H13: the full glossary is never loaded", () => {
        expect(fullLoads.urls).toEqual([]);
      });
    } finally {
      fullLoads.stop();
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Glossary table Rule and Status filters (H12)", async ({ page }) => {
    test.setTimeout(240_000);
    const glossary = new GlossaryPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names } = fixtures;
      await openGlossary(page);
      await glossary.expectPageLoaded();
      await glossary.searchGlossaries(fixtures.tag);
      await glossary.expectGlossaryRowVisible(names.g1);

      await test.step("Status = Draft sends Status=draft from page 0 and lists only G5", async () => {
        const request = page.waitForRequest(
          (r) => isGlossaryGets(r) && new URL(r.url()).searchParams.get("Status") === "draft",
        );
        await glossary.setTableFilter("Status", "Draft");
        const url = new URL((await request).url());
        expect(url.searchParams.get("PageNumber")).toBe("0");
        expect(url.searchParams.get("SearchText")).toBe(fixtures.tag);
        await glossary.expectGlossaryRowVisible(names.g5);
        await expect(page.getByRole("row").filter({ hasText: names.g1 })).toHaveCount(0);
        await expect(
          page.getByRole("row").filter({ hasText: names.g5 }).getByText("Draft", { exact: true }),
        ).toBeVisible();
      });

      await test.step("Status = Deprecated shows the Deprecated badge (C12)", async () => {
        await glossary.setTableFilter("Status", "Deprecated");
        await glossary.expectGlossaryRowVisible(names.g6);
        await expect(
          page
            .getByRole("row")
            .filter({ hasText: names.g6 })
            .getByText("Deprecated", { exact: true }),
        ).toBeVisible();
      });

      await test.step("Rule = Keep sends Rule=keep", async () => {
        await glossary.setTableFilter("Status", "All statuses");
        const request = page.waitForRequest(
          (r) => isGlossaryGets(r) && new URL(r.url()).searchParams.get("Rule") === "keep",
        );
        await glossary.setTableFilter("Rule", "Keep");
        const url = new URL((await request).url());
        expect(url.searchParams.get("PageNumber")).toBe("0");
        expect(url.searchParams.has("Status")).toBe(false);
        // The legacy term was stored with structured fields by the server's Track A sync.
        await glossary.expectGlossaryRowVisible(names.legacy);
        await expect(page.getByRole("row").filter({ hasText: names.g1 })).toHaveCount(0);
        await glossary.setTableFilter("Rule", "All rules");
      });
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });

  test("Translations table: Glossary issues filter and row badge (H11, C9)", async ({ page }) => {
    test.setTimeout(240_000);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await test.step("Create fixtures", () => fixtures.create(source, target));
      const { names, ids } = fixtures;
      const issuesRequests: Record<string, unknown>[] = [];
      let mode: "issues" | "empty" = "issues";
      const violation = {
        culture: target.languageCode,
        glossaryId: ids.g1,
        term: names.g1,
        kind: "forbidden-used",
        found: "Werkbereich",
        detectedAt: new Date().toISOString(),
      };
      // Keys with stored violations need Translate All with the server flag on; instead, the
      // filtered request is answered with this run's key plus a stored violation.
      const issuesRoute = async (route: Route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        if (!body?.hasGlossaryViolations) return route.fallback();
        issuesRequests.push(body);
        if (mode === "empty") {
          return route.fulfill({
            json: { keys: [], totalCount: 0, hasMore: false, nextCursor: null },
          });
        }
        const unfiltered = { ...body };
        delete unfiltered.hasGlossaryViolations;
        const response = await route.fetch({
          postData: JSON.stringify({ ...unfiltered, searchKey: names.key, moduleIds: [ids.m] }),
        });
        const page1 = (await response.json()) as { keys: Record<string, unknown>[] };
        await route.fulfill({
          response,
          json: {
            ...page1,
            keys: page1.keys.map((key) => ({ ...key, glossaryViolations: [violation] })),
          },
        });
      };
      await page.route(/\/Key\/Gets/, issuesRoute);

      try {
        await openTranslations(page);
        await translations.openTranslationKeysTab();

        await test.step("H11: the filter requests hasGlossaryViolations and rows show the badge", async () => {
          await expect(translations.glossaryIssuesCheckbox).toBeVisible();
          await translations.glossaryIssuesCheckbox.check();
          await expect.poll(() => issuesRequests.length).toBeGreaterThan(0);
          expect(issuesRequests.at(-1)).toMatchObject({ hasGlossaryViolations: true });
          const badge = translations.glossaryIssueBadge(names.key);
          await expect(badge).toHaveText("1 glossary issue", { timeout: 15_000 });
          // The tooltip opens on keyboard focus and lists "<culture>: <message>".
          const tooltip = await translations.openGlossaryIssueTooltip(names.key);
          await expect(tooltip).toContainText(
            `${target.languageCode}: "Werkbereich" is not allowed`,
          );
          await page.keyboard.press("Escape");
        });

        await test.step("C9: no keys with issues shows the empty state", async () => {
          mode = "empty";
          await translations.glossaryIssuesCheckbox.uncheck();
          await translations.glossaryIssuesCheckbox.check();
          await expect(page.getByText("No keys with glossary issues", { exact: true })).toBeVisible(
            { timeout: 15_000 },
          );
          await expect(page.locator(OPEN_TOAST)).toHaveCount(0);
          await translations.glossaryIssuesCheckbox.uncheck();
        });
      } finally {
        await page.unroute(/\/Key\/Gets/, issuesRoute);
      }
    } finally {
      await test.step("Clean up fixtures", () => fixtures.cleanup());
    }
  });
});
