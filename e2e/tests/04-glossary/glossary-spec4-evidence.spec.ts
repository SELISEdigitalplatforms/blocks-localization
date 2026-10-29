import type { Page, Route, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../../support/test-base";
import { ModulesPage } from "../../support/pages/modules.page";
import { GlossaryPage } from "../../support/pages/glossary.page";
import {
  LocalizationApi,
  TranslationsPage,
  isGlossaryMatchUrl,
  trackGlossaryMatches,
  type ApiGlossaryMatch,
  type ProjectLanguage,
} from "../../support/pages/translations.page";
import {
  openGlossary,
  openModules,
  openNewKey,
  openTranslations,
} from "../../support/localization-helpers";

/**
 *   E2E_VISUAL=1 npx playwright test tests/04-glossary/glossary-spec4-evidence.spec.ts
 *
 * Results are attached to the HTML report (`npm run report`).
 */
test.skip(!process.env.E2E_VISUAL, "Set E2E_VISUAL=1 to capture SPEC4 evidence.");

const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const setTheme = async (page: Page, theme: Theme) => {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, theme === "dark");
};

const shoot = async (page: Page, testInfo: TestInfo, name: string) => {
  const file = testInfo.outputPath(`${name}.png`);
  await page.waitForTimeout(400); // let popover and dialog animations settle
  await page.screenshot({ path: file, fullPage: false });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
};

const randomLetters = (length: number) =>
  Array.from({ length }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join("");

/** Per-run terms (one per rule) and a key whose source contains all three. */
class EvidenceFixtures {
  readonly tag = randomLetters(8);
  readonly names = {
    translate: `Workspace${this.tag}`,
    keep: `SELISE${this.tag.toUpperCase()}`,
    forbidden: `Portal${this.tag}`,
    module: `e2e-spec4-m-${this.tag}`,
    key: `e2e.spec4.${this.tag}`,
  };
  readonly ids = { translate: "", keep: "", forbidden: "", module: "", key: "" };
  source = "";

  constructor(private readonly api: LocalizationApi) {}

  async create(source: ProjectLanguage, target: ProjectLanguage) {
    const { api, names, ids } = this;
    const t = target.languageCode;
    ids.module = await api.createModule(names.module);
    ids.translate = await api.createGlossary({
      name: names.translate,
      isGlobal: true,
      rule: "translate",
      translations: [{ language: t, value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] }],
    });
    ids.keep = await api.createGlossary({
      name: names.keep,
      isGlobal: true,
      rule: "keep",
      caseSensitive: true,
    });
    ids.forbidden = await api.createGlossary({
      name: names.forbidden,
      isGlobal: false,
      moduleIds: [ids.module],
      rule: "forbidden",
      translations: [{ language: t, value: "", forbiddenValues: ["Portalseite"] }],
    });
    this.source = `Open your ${names.translate} and ${names.keep} ${names.forbidden}`;
    ids.key = await api.createKey({
      keyName: names.key,
      moduleId: ids.module,
      culture: source.languageCode,
      value: this.source,
      glossaryIds: [ids.translate],
    });
  }

  /** Keeps only this run's terms in the `/Glossary/Match` responses. */
  readonly isOwn = (match: ApiGlossaryMatch) => match.term.toLowerCase().includes(this.tag);

  async cleanup() {
    const { api, ids } = this;
    if (ids.key) await api.deleteKey(ids.key);
    for (const id of [ids.translate, ids.keep, ids.forbidden]) if (id) await api.deleteGlossary(id);
    if (ids.module) await api.deleteModule(ids.module);
  }
}

async function setUp(page: Page) {
  const api = await LocalizationApi.capture(page);
  const languages = await api.languages();
  const source = languages.find((language) => language.isDefault) ?? languages[0];
  const others = languages.filter((language) => language.languageCode !== source?.languageCode);
  const target = others.find((language) => language.languageCode === "de-DE") ?? others[0];
  test.skip(!source || !target, "The shared project needs a language besides the default one.");
  const fixtures = new EvidenceFixtures(api);
  return { api, fixtures, source: source!, target: target! };
}

const percentile = (values: number[], p: number) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

test.describe("Glossary — SPEC4 evidence", () => {
  test("screenshots in both themes at 1440 and 390 px", async ({ page }, testInfo) => {
    test.setTimeout(900_000);
    const translations = new TranslationsPage(page);
    const modules = new ModulesPage(page);
    const glossary = new GlossaryPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await fixtures.create(source, target);
      const { names, ids } = fixtures;
      await trackGlossaryMatches(page, fixtures.isOwn);
      const dialog = translations.editTranslationDialog;

      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        for (const theme of THEMES) {
          const suffix = `${viewport.width}x${viewport.height}-${theme}`;

          // Edit translation: 3 highlights, one popover per rule, a live warning.
          await translations.openKeyDetails(ids.key);
          await setTheme(page, theme);
          await translations.openEditTranslation(target.languageName);
          await expect(translations.glossaryTerm(dialog, names.translate)).toBeVisible({
            timeout: 15_000,
          });
          await shoot(page, testInfo, `edit-modal-highlights-${suffix}`);
          for (const [rule, surface] of [
            ["translate", names.translate],
            ["keep", names.keep],
            ["forbidden", names.forbidden],
          ] as const) {
            await translations.glossaryTerm(dialog, surface).click();
            await expect(translations.termPopover).toBeVisible();
            await shoot(page, testInfo, `popover-${rule}-${suffix}`);
            await page.keyboard.press("Escape");
            await expect(translations.termPopover).toHaveCount(0);
          }
          await translations.editTranslationTextarea.fill("Öffnen Sie Ihren Werkbereich");
          await expect(
            translations.violationItem(dialog, '"Werkbereich" is not allowed'),
          ).toBeVisible();
          await shoot(page, testInfo, `live-warning-${suffix}`);
          await translations.closeEditTranslation();

          // Inline editor glossary checklist.
          await openTranslations(page);
          await setTheme(page, theme);
          await translations.openTranslationKeysTab();
          await translations.expandKey(names.key);
          await expect(
            page.getByRole("region", { name: /^Glossary terms for / }).first(),
          ).toBeVisible({
            timeout: 15_000,
          });
          await shoot(page, testInfo, `inline-checklist-${suffix}`);

          // New key glossary checklist.
          await openNewKey(page);
          await setTheme(page, theme);
          await page.getByPlaceholder("Enter default value").fill(fixtures.source);
          await expect(
            page.getByRole("region", { name: /^Glossary terms for / }).first(),
          ).toBeVisible({
            timeout: 15_000,
          });
          await shoot(page, testInfo, `new-key-checklist-${suffix}`);

          // Picker: results, empty + create, chips including an unresolved one.
          const unknownId = `unknown-${fixtures.tag}`;
          const seedRoute = async (route: Route) => {
            const url = new URL(route.request().url());
            if (url.searchParams.get("ModuleId") !== ids.module) return route.fallback();
            const response = await route.fetch();
            const body = (await response.json()) as { items: unknown[] };
            const items = [...body.items, { itemId: unknownId }];
            await route.fulfill({ json: { items, totalCount: items.length } });
          };
          // Glossary/GetByIds leaves the unknown id out, so its chip shows "Unknown glossary".
          await page.route(/\/Glossary\/Gets/, seedRoute);
          try {
            await openModules(page);
            await setTheme(page, theme);
            await modules.searchModules(names.module);
            await modules.openTagGlossaryDialog(names.module);
            const tagDialog = modules.tagGlossaryDialog;
            await expect(
              tagDialog.getByRole("button", { name: "Remove Unknown glossary" }),
            ).toBeVisible({ timeout: 15_000 });
            await modules.searchInTagPicker(fixtures.tag);
            await expect(tagDialog.getByRole("option").first()).toBeVisible({ timeout: 15_000 });
            await shoot(page, testInfo, `picker-results-and-chips-${suffix}`);
            await modules.searchInTagPicker(`zzz-none-${fixtures.tag}`);
            await expect(tagDialog.getByRole("option", { name: /^Create "zzz-none-/ })).toBeVisible(
              { timeout: 15_000 },
            );
            await shoot(page, testInfo, `picker-empty-create-${suffix}`);
            await page.keyboard.press("Escape");
            await tagDialog.getByRole("button", { name: "Cancel" }).click();
          } finally {
            await page.unroute(/\/Glossary\/Gets/, seedRoute);
          }

          // Row focus rings.
          await openGlossary(page);
          await setTheme(page, theme);
          await glossary.expectPageLoaded();
          await glossary.searchGlossaries(names.translate);
          await glossary.waitForRowMenuButton(names.translate);
          await page.getByRole("row").filter({ hasText: names.translate }).focus();
          await shoot(page, testInfo, `glossary-row-focus-${suffix}`);
          await glossary.openGlossaryDetail(names.translate);
          const keyRow = page.getByRole("row").filter({ hasText: names.key });
          await expect(keyRow).toBeVisible({ timeout: 15_000 });
          await setTheme(page, theme);
          await keyRow.focus();
          await shoot(page, testInfo, `tagged-key-row-focus-${suffix}`);
        }
      }
    } finally {
      await page.setViewportSize(VIEWPORTS[0]);
      await fixtures.cleanup();
    }
  });

  test("axe: Edit translation modal, term popover and glossary picker", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const translations = new TranslationsPage(page);
    const modules = new ModulesPage(page);
    const { fixtures, source, target } = await setUp(page);

    const audit = async (name: string, selector: string) => {
      const results = await new AxeBuilder({ page })
        .include(selector)
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      await testInfo.attach(`axe-${name}.json`, {
        body: JSON.stringify(results.violations, null, 2),
        contentType: "application/json",
      });
      const blocking = results.violations.filter((violation) =>
        ["serious", "critical"].includes(violation.impact ?? ""),
      );
      // Soft: report every screen even when one fails.
      expect
        .soft(
          blocking.map((violation) => `${violation.id}: ${violation.help}`),
          `axe ${name}`,
        )
        .toEqual([]);
    };

    try {
      await fixtures.create(source, target);
      const { names, ids } = fixtures;
      await trackGlossaryMatches(page, fixtures.isOwn);
      const dialog = translations.editTranslationDialog;

      await translations.openKeyDetails(ids.key);
      await translations.openEditTranslation(target.languageName);
      await expect(translations.glossaryTerm(dialog, names.translate)).toBeVisible({
        timeout: 15_000,
      });
      await translations.editTranslationTextarea.fill("Öffnen Sie Ihren Werkbereich");
      await expect(
        translations.violationItem(dialog, '"Werkbereich" is not allowed'),
      ).toBeVisible();
      await audit("edit-translation-modal", '[role="dialog"]');
      await translations.glossaryTerm(dialog, names.translate).click();
      await expect(translations.termPopover).toBeVisible();
      await audit("term-popover", '[role="dialog"][aria-label^="Glossary term"]');
      await page.keyboard.press("Escape");
      await translations.closeEditTranslation();

      await openModules(page);
      await modules.searchModules(names.module);
      await modules.openTagGlossaryDialog(names.module);
      await modules.searchInTagPicker(fixtures.tag);
      await expect(modules.tagGlossaryDialog.getByRole("option").first()).toBeVisible({
        timeout: 15_000,
      });
      await audit("glossary-picker", '[role="dialog"]');
      await page.keyboard.press("Escape");
      await modules.tagGlossaryDialog.getByRole("button", { name: "Cancel" }).click();
    } finally {
      await fixtures.cleanup();
    }
  });

  test("/Glossary/Match per editor open: request count and latency (SPEC7 §5, C14)", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);
    const OPENS = 10;

    try {
      await fixtures.create(source, target);
      const { names, ids } = fixtures;
      const matches = await trackGlossaryMatches(page);
      const dialog = translations.editTranslationDialog;
      const durations: number[] = [];

      await translations.openKeyDetails(ids.key);
      for (let open = 0; open < OPENS; open++) {
        // Cold match cache: a reload empties the in-memory query cache.
        await page.reload();
        await expect(page.getByRole("button", { name: "Tag Glossary" })).toBeVisible({
          timeout: 15_000,
        });
        const before = matches.forText(fixtures.source).length;
        const responsePromise = page.waitForResponse((response) =>
          isGlossaryMatchUrl(new URL(response.url())),
        );
        await translations.openEditTranslation(target.languageName);
        const response = await responsePromise;
        await expect(translations.glossaryTerm(dialog, names.translate)).toBeVisible({
          timeout: 15_000,
        });
        // End-to-end: request start to the last response byte.
        durations.push(response.request().timing().responseEnd);
        await page.waitForTimeout(500);
        expect(matches.forText(fixtures.source).length - before).toBe(1);
        await translations.closeEditTranslation();
      }

      const summary = {
        opens: OPENS,
        matchP50: percentile(durations, 50),
        matchP95: percentile(durations, 95),
        matchMax: Math.max(...durations),
      };
      await testInfo.attach("match-latency.json", {
        body: JSON.stringify(summary, null, 2),
        contentType: "application/json",
      });
      console.log("[SPEC7 §5 /Glossary/Match]", summary);
      // Budget: end-to-end p95 ≤ 300 ms on dev (A3). Soft: the numbers belong in the PR either way.
      expect.soft(summary.matchP95).toBeLessThanOrEqual(300);
    } finally {
      await fixtures.cleanup();
    }
  });
});
