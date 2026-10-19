import type { Page, TestInfo } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { GlossaryPage } from "../../support/pages/glossary.page";
import { openGlossary } from "../../support/localization-helpers";

/**
 * Evidence for the glossary editor PR (screenshots, keyboard check, table timings).
 * Opt-in: these run only with E2E_VISUAL=1, so the regular suite is unaffected.
 *
 *   E2E_VISUAL=1 npx playwright test tests/04-glossary/glossary-visual.spec.ts
 *
 * The timing test uses only UI that exists before and after the change, so running it
 * against the deployed `dev` site gives the "before" number and the local build the "after".
 */
test.skip(!process.env.E2E_VISUAL, "Set E2E_VISUAL=1 to capture glossary visual evidence.");

const META_PREFIX = "@@glossary-meta:v1@@";
const VIEWPORTS = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
] as const;
const THEMES = ["light", "dark"] as const;
type Theme = (typeof THEMES)[number];

const setTheme = async (page: Page, theme: Theme) => {
  await page.emulateMedia({ colorScheme: theme });
  // A saved app setting can override the system scheme; force the class the app uses.
  await page.evaluate((isDark) => {
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, theme === "dark");
};

const shoot = async (page: Page, testInfo: TestInfo, name: string) => {
  const file = testInfo.outputPath(`${name}.png`);
  await page.waitForTimeout(400); // let sheet/tooltip animations settle
  await page.screenshot({ path: file, fullPage: true });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
};

test.describe("Glossary — visual evidence", () => {
  test("screenshots for every viewport and theme", async ({ page }, testInfo) => {
    test.setTimeout(600_000);
    await openGlossary(page);
    const glossary = new GlossaryPage(page);
    await glossary.expectPageLoaded();

    const stamp = Date.now();
    const prefix = `E2E Visual ${stamp}`;
    await glossary.openNewGlossaryDialog();
    const codes = await glossary.getTranslationCodes();
    await page.keyboard.press("Escape");

    const translations = Object.fromEntries(
      codes.slice(0, 1).map((code) => [code, "Arbeitsbereich"]),
    );
    const fixtures = {
      translate: `${META_PREFIX}${JSON.stringify({
        rule: "translate",
        caseSensitive: true,
        variants: ["workspaces"],
        translations,
        ...(codes[0] ? { forbidden: { [codes[0]]: ["Werkbereich"] } } : {}),
        note: "Internal team note",
      })}`,
      keep: `${META_PREFIX}{"rule":"keep"}`,
      forbidden: `${META_PREFIX}{"rule":"forbidden"}`,
      corrupt: `${META_PREFIX}{broken`,
      newer: "@@glossary-meta:v2@@{}",
    };
    const names = Object.fromEntries(
      Object.keys(fixtures).map((key) => [key, `${prefix} ${key}`]),
    ) as Record<keyof typeof fixtures, string>;

    for (const [key, note] of Object.entries(fixtures)) {
      await glossary.createGlossaryWithStoredNote(names[key as keyof typeof fixtures], note);
    }

    try {
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        for (const theme of THEMES) {
          const suffix = `${viewport.width}x${viewport.height}-${theme}`;
          await setTheme(page, theme);

          await glossary.searchGlossaries(prefix);
          await glossary.expectGlossaryRowVisible(names.translate);
          await shoot(page, testInfo, `table-mixed-rules-${suffix}`);

          for (const rule of ["Translate", "Keep", "Forbidden"] as const) {
            await glossary.openNewGlossaryDialog();
            await glossary.setRule(rule);
            await shoot(page, testInfo, `sheet-${rule.toLowerCase()}-${suffix}`);
            await page.keyboard.press("Escape");
          }

          await glossary.openEditFromList(names.corrupt);
          await shoot(page, testInfo, `sheet-parse-warning-${suffix}`);
          await page.keyboard.press("Escape");

          await glossary.openEditFromList(names.newer);
          await shoot(page, testInfo, `sheet-unsupported-version-${suffix}`);
          await page.keyboard.press("Escape");

          await glossary.openGlossaryDetail(names.translate);
          await setTheme(page, theme);
          await shoot(page, testInfo, `details-${suffix}`);
          await glossary.goBackToList();
        }
      }
    } finally {
      await page.setViewportSize(VIEWPORTS[0]);
      await page.keyboard.press("Escape");
      for (const name of Object.values(names)) {
        await glossary.deleteGlossaryFromList(name);
      }
    }
  });

  test("keyboard: tab order, chips, Escape and focus return", async ({ page }) => {
    test.setTimeout(120_000);
    await openGlossary(page);
    const glossary = new GlossaryPage(page);
    await glossary.expectPageLoaded();

    const trigger = page.getByRole("button", { name: "New Glossary" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const sheet = glossary.editorSheet;
    await expect(sheet).toBeVisible();

    // Walk the tab order and record which section each focused control belongs to.
    const sectionOf = () =>
      page.evaluate(() => {
        const active = document.activeElement as HTMLElement | null;
        const section = active?.closest("section");
        const heading = section?.querySelector("h3")?.textContent;
        if (heading) return heading;
        if (active?.textContent?.trim() === "Internal note") return "Internal note";
        return active?.getAttribute("aria-label") ?? active?.textContent?.trim() ?? "";
      });
    const visited: string[] = [];
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press("Tab");
      const section = await sectionOf();
      if (visited.at(-1) !== section) visited.push(section);
      if (section === "Save") break;
    }
    const order = ["Term", "Translations", "Meaning", "Scope", "Internal note"].filter((name) =>
      visited.includes(name),
    );
    expect(order.slice(0, 1)).toEqual(["Term"]);
    const indexes = order.map((name) => visited.indexOf(name));
    expect([...indexes].sort((a, b) => a - b)).toEqual(indexes);

    // Enter adds a chip; its remove button is labelled and reachable by keyboard.
    const variants = sheet.getByRole("textbox", { name: "Variants" });
    await variants.focus();
    await page.keyboard.type("workspaces");
    await page.keyboard.press("Enter");
    const remove = sheet.getByRole("button", { name: "Remove variant workspaces" });
    await expect(remove).toBeVisible();
    await remove.focus();
    await expect(remove).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(remove).toHaveCount(0);

    // Escape closes the sheet and focus returns to the trigger.
    await page.keyboard.press("Escape");
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("timing: glossary table render scripting time", async ({ page }, testInfo) => {
    test.setTimeout(120_000);
    await openGlossary(page);
    const glossary = new GlossaryPage(page);
    await glossary.expectPageLoaded();
    const rows = page.getByRole("row");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");
    const scriptSeconds = async () => {
      const { metrics } = await cdp.send("Performance.getMetrics");
      return metrics.find((metric) => metric.name === "ScriptDuration")?.value ?? 0;
    };

    // Re-render the full first page by filtering it away and back, 5 times; report the median.
    const samples: number[] = [];
    for (let run = 0; run < 5; run++) {
      await glossary.searchGlossaries(`no-such-glossary-${Date.now()}`);
      await glossary.expectNoMatchingGlossaries();
      const before = await scriptSeconds();
      await glossary.clearSearch();
      await expect(rows.nth(1)).toBeVisible();
      await page.waitForTimeout(300); // let the deferred chip/tooltip work finish
      samples.push((await scriptSeconds()) - before);
    }
    samples.sort((a, b) => a - b);
    const result = {
      baseUrl: page.url(),
      renderedRows: (await rows.count()) - 1,
      medianScriptMs: Math.round(samples[2] * 1000 * 10) / 10,
      samplesMs: samples.map((value) => Math.round(value * 1000 * 10) / 10),
    };
    await testInfo.attach("glossary-table-timing.json", {
      body: JSON.stringify(result, null, 2),
      contentType: "application/json",
    });
    console.log("[glossary-timing]", JSON.stringify(result));
  });
});
