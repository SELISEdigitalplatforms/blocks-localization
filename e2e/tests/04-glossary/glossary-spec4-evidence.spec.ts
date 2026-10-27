import type { Page, Route, TestInfo } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "../../support/test-base";
import { ModulesPage } from "../../support/pages/modules.page";
import { GlossaryPage } from "../../support/pages/glossary.page";
import {
  LocalizationApi,
  TranslationsPage,
  isFullGlossaryPageUrl,
  type ProjectLanguage,
} from "../../support/pages/translations.page";
import {
  openGlossary,
  openModules,
  openNewKey,
  openTranslations,
} from "../../support/localization-helpers";

/**
 * SPEC4 evidence for the PR: screenshots (1440×900 and 390×844, light and dark), axe checks of
 * the Edit translation modal and the glossary picker, and the typing performance with a
 * 2,000-term glossary (C14). Opt-in, like glossary-visual.spec.ts:
 *
 *   E2E_VISUAL=1 npx playwright test tests/04-glossary/glossary-spec4-evidence.spec.ts
 *
 * Results are attached to the HTML report (`npm run report`).
 */
test.skip(!process.env.E2E_VISUAL, "Set E2E_VISUAL=1 to capture SPEC4 evidence.");

const META_PREFIX = "@@glossary-meta:v1@@";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const note = (meta: Record<string, unknown>) => `${META_PREFIX}${JSON.stringify(meta)}`;

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
      additionalNote: note({
        rule: "translate",
        translations: { [t]: "Arbeitsbereich" },
        forbidden: { [t]: ["Werkbereich"] },
      }),
    });
    ids.keep = await api.createGlossary({
      name: names.keep,
      isGlobal: true,
      additionalNote: note({ rule: "keep", caseSensitive: true }),
    });
    ids.forbidden = await api.createGlossary({
      name: names.forbidden,
      isGlobal: false,
      moduleIds: [ids.module],
      additionalNote: note({ rule: "forbidden", forbidden: { [t]: ["Portalseite"] } }),
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

  readonly isOwn = (glossary: { name?: string }) =>
    (glossary.name ?? "").toLowerCase().includes(this.tag);

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

/**
 * Keeps only this run's terms in the full-glossary load, so other terms of the shared project
 * don't change the screenshots; with `extra`, adds synthetic terms (the 2,000-term fixture).
 */
async function routeFullGlossary(
  page: Page,
  keep: (glossary: { name?: string }) => boolean,
  extra: Record<string, unknown>[] = [],
) {
  const handler = async (route: Route) => {
    const response = await route.fetch();
    const body = (await response.json()) as { items?: { name?: string }[] };
    // One page holds everything: the client stops once totalCount is reached.
    const items = [...(body.items ?? []).filter(keep), ...extra];
    await route.fulfill({ status: response.status(), json: { items, totalCount: items.length } });
  };
  await page.route(isFullGlossaryPageUrl, handler);
  return () => page.unroute(isFullGlossaryPageUrl, handler);
}

const syntheticTerms = (count: number, targetCode: string) =>
  Array.from({ length: count }, (_, index) => ({
    itemId: `perf-${index}`,
    name: `Perfterm${index}`,
    isGlobal: true,
    context: "",
    createDate: "",
    lastUpdateDate: "",
    additionalNote: note({
      rule: index % 10 === 0 ? "forbidden" : "translate",
      translations: { [targetCode]: `Begriff${index}` },
      forbidden: { [targetCode]: [`Verboten${index}`] },
    }),
  }));

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
      await routeFullGlossary(page, fixtures.isOwn);
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

          // Inline editor chip row.
          await openTranslations(page);
          await setTheme(page, theme);
          await translations.openTranslationKeysTab();
          await translations.expandKey(names.key);
          await expect(translations.glossaryTerm(page, names.translate)).toBeVisible({
            timeout: 15_000,
          });
          await shoot(page, testInfo, `inline-chip-row-${suffix}`);

          // New key chip row.
          await openNewKey(page);
          await setTheme(page, theme);
          await page.getByPlaceholder("Enter default value").fill(fixtures.source);
          await expect(translations.glossaryTerm(page, names.translate)).toBeVisible({
            timeout: 15_000,
          });
          await shoot(page, testInfo, `new-key-chip-row-${suffix}`);

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
          const unknownRoute = (route: Route) =>
            new URL(route.request().url()).searchParams.get("itemId") === unknownId
              ? route.fulfill({ status: 404, json: {} })
              : route.fallback();
          await page.route(/\/Glossary\/Gets/, seedRoute);
          await page.route(/\/Glossary\/Get\?/, unknownRoute);
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
            await expect(tagDialog.getByRole("button", { name: /^Create "zzz-none-/ })).toBeVisible(
              { timeout: 15_000 },
            );
            await shoot(page, testInfo, `picker-empty-create-${suffix}`);
            await page.keyboard.press("Escape");
            await tagDialog.getByRole("button", { name: "Cancel" }).click();
          } finally {
            await page.unroute(/\/Glossary\/Gets/, seedRoute);
            await page.unroute(/\/Glossary\/Get\?/, unknownRoute);
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
      await routeFullGlossary(page, fixtures.isOwn);
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

  test("typing performance with 2,000 terms (C14)", async ({ page, browser }, testInfo) => {
    test.setTimeout(300_000);
    const translations = new TranslationsPage(page);
    const { fixtures, source, target } = await setUp(page);

    try {
      await fixtures.create(source, target);
      const { names, ids } = fixtures;
      await routeFullGlossary(page, fixtures.isOwn, syntheticTerms(2000, target.languageCode));
      const dialog = translations.editTranslationDialog;

      await translations.openKeyDetails(ids.key);
      await translations.openEditTranslation(target.languageName);
      await expect(translations.glossaryTerm(dialog, names.translate)).toBeVisible({
        timeout: 30_000,
      });
      const textarea = translations.editTranslationTextarea;
      await textarea.fill("");
      await textarea.focus();

      // Input-to-paint per keystroke: input event → the frame after the next animation frame,
      // plus Chrome's Event Timing entries (INP-style, ≥ 16 ms only) as a cross-check.
      await page.evaluate(() => {
        const w = window as unknown as { __latencies: number[]; __eventTimings: number[] };
        w.__latencies = [];
        w.__eventTimings = [];
        document.addEventListener(
          "input",
          (event) => {
            const start = event.timeStamp;
            requestAnimationFrame(() =>
              setTimeout(() => w.__latencies.push(performance.now() - start), 0),
            );
          },
          true,
        );
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) w.__eventTimings.push(entry.duration);
        }).observe({
          type: "event",
          durationThreshold: 16,
          buffered: false,
        } as PerformanceObserverInit);
      });

      const tracePath = testInfo.outputPath("typing-trace.json");
      await browser.startTracing(page, { path: tracePath, screenshots: true });
      // 10 characters per second, ~6 s of typing, including a forbidden word mid-way.
      await textarea.pressSequentially("Öffnen Sie Ihren Werkbereich und Begriff12 jetzt", {
        delay: 100,
      });
      await page.waitForTimeout(500);
      await browser.stopTracing();
      await testInfo.attach("typing-trace.json (open in Chrome DevTools › Performance)", {
        path: tracePath,
        contentType: "application/json",
      });

      const { latencies, eventTimings } = await page.evaluate(() => {
        const w = window as unknown as { __latencies: number[]; __eventTimings: number[] };
        return { latencies: w.__latencies, eventTimings: w.__eventTimings };
      });
      const summary = {
        keystrokes: latencies.length,
        inputToPaintP50: percentile(latencies, 50),
        inputToPaintP95: percentile(latencies, 95),
        inputToPaintMax: Math.max(...latencies),
        eventTimingsOver16ms: eventTimings.length,
        eventTimingMax: eventTimings.length ? Math.max(...eventTimings) : 0,
      };
      await testInfo.attach("typing-performance.json", {
        body: JSON.stringify(summary, null, 2),
        contentType: "application/json",
      });
      console.log("[SPEC4 C14]", summary);

      await expect(
        translations.violationItem(dialog, '"Werkbereich" is not allowed'),
      ).toBeVisible();
      expect(summary.keystrokes).toBeGreaterThan(40);
      expect(summary.inputToPaintP95).toBeLessThanOrEqual(50);
      await translations.closeEditTranslation();
    } finally {
      await fixtures.cleanup();
    }
  });
});
