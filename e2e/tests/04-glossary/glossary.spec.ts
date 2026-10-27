import { test, expect } from "../../support/test-base";
import { GlossaryPage } from "../../support/pages/glossary.page";
import { ModulesPage } from "../../support/pages/modules.page";
import { LocalizationApi, TranslationsPage } from "../../support/pages/translations.page";
import { openGlossary, openModules } from "../../support/localization-helpers";

const META_PREFIX = "@@glossary-meta:v1@@";

const parseMeta = (additionalNote: unknown) => {
  const text = String(additionalNote);
  expect(text.startsWith(META_PREFIX)).toBe(true);
  return JSON.parse(text.slice(META_PREFIX.length));
};

test.describe("Glossary", () => {
  test("Glossary — full flow", async ({ page }) => {
    test.setTimeout(180_000);
    await openGlossary(page);

    const glossary = new GlossaryPage(page);

    await test.step("Glossary Management page loads", async () => {
      await glossary.expectPageLoaded();
    });

    const glossaryName = `Testing-${Date.now()}`;

    await test.step("Open Add Glossary and fill in the name", async () => {
      await glossary.openNewGlossaryDialog();
      await glossary.expectAddGlossaryDialogLoaded();
      // The sheet shows Term → Translations → Meaning → Scope → Additional note (H1).
      await glossary.expectEditorSectionsInOrder();
      await glossary.fillGlossaryName(glossaryName);
    });

    await test.step("Select Language", async () => {
      await glossary.selectLanguage("English");
    });

    await test.step("Select Type", async () => {
      await glossary.selectType("Full form");
    });

    // Project languages differ per environment: use the editor's own translation rows.
    let translationCodes: string[] = [];

    await test.step("Fill rule, translations and forbidden alternatives", async () => {
      await glossary.setRule("Translate");
      translationCodes = await glossary.getTranslationCodes();
      if (translationCodes.length > 0) {
        await glossary.fillTranslation(translationCodes[0], "Arbeitsbereich");
        await glossary.addForbidden(translationCodes[0], "Werkbereich");
      }
    });

    await test.step("Select module scope", async () => {
      await glossary.setScope("Specific modules");
    });

    await test.step("Fill Definition and Additional note", async () => {
      await glossary.fillDefinition("This is a Testing context.");
      await glossary.fillInternalNote("This is Additional Notes");
    });

    await test.step("Add glossary and verify the saved terminology data (H3, H11)", async () => {
      const payload = await glossary.saveAndCapturePayload();
      await glossary.expectAddSuccess(glossaryName);

      const meta = parseMeta(payload.additionalNote);
      expect(meta.rule).toBe("translate");
      // No variants were entered, so the new term stores none.
      expect(meta.variants ?? []).toEqual([]);
      expect(meta.note).toBe("This is Additional Notes");
      expect(payload.isGlobal).toBe(false);
      expect((payload.moduleIds as string[]).length).toBe(1);

      if (translationCodes.length > 0) {
        const [code] = translationCodes;
        expect(meta.translations).toEqual({ [code]: "Arbeitsbereich" });
        expect(meta.forbidden).toEqual({ [code]: ["Werkbereich"] });
        expect(payload.context).toBe(
          `This is a Testing context. ⟦rule: ${code}→Arbeitsbereich; avoid ${code}: Werkbereich⟧`,
        );
      } else {
        expect(payload.context).toBe("This is a Testing context.");
      }
    });

    await test.step("Table shows the rule and translation chips, not the note (H6, H7)", async () => {
      await glossary.searchGlossaries(glossaryName);
      const row = page.getByRole("row").filter({ hasText: glossaryName });
      await expect(row.getByText("Translate", { exact: true })).toBeVisible();
      if (translationCodes.length > 0) {
        await expect(row.getByText(translationCodes[0], { exact: true })).toBeVisible();
        for (const code of translationCodes.slice(1, 4)) {
          await expect(row.getByText(`${code} missing`, { exact: true })).toBeVisible();
        }
      }
      await expect(row.getByText("This is Additional Notes")).toHaveCount(0);
      await expect(row.getByText("This is a Testing context.")).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Additional Note" })).toHaveCount(0);
      await glossary.clearSearch();
    });

    await test.step("Search narrows the glossary list and shows the empty state on no match", async () => {
      await glossary.searchGlossaries(glossaryName);
      await glossary.expectGlossaryRowVisible(glossaryName);

      await glossary.searchGlossaries(`no-such-glossary-${Date.now()}`);
      await glossary.expectNoMatchingGlossaries();

      await glossary.clearSearch();
      await glossary.expectGlossaryRowVisible(glossaryName);
    });

    await test.step("Add dialog warns about a case-insensitive duplicate name", async () => {
      await glossary.openNewGlossaryDialog();
      await glossary.fillGlossaryName(`  ${glossaryName.toUpperCase()} `);
      await glossary.expectDuplicateNameWarning(glossaryName);
      await glossary.fillGlossaryName(`${glossaryName}-other`);
      await glossary.expectNoDuplicateNameWarning();
      await glossary.fillGlossaryName(glossaryName.toLowerCase());
      await glossary.expectDuplicateNameWarning(glossaryName);
      await glossary.openDuplicateGlossary();
      await expect(page.getByRole("heading", { name: glossaryName })).toBeVisible({
        timeout: 15_000,
      });
      // Let the tagged-keys request finish before leaving: an in-flight request is reused when
      // the detail page mounts again, and the next step counts that page's own request.
      await glossary.expectNoTaggedKeys();
      await glossary.goBackToList();
    });

    await test.step("Open glossary detail and verify sections", async () => {
      const taggedKeyRequests: string[] = [];
      const onRequest = (request: import("@playwright/test").Request) => {
        if (request.method() === "POST" && /\/Key\/Gets/.test(request.url())) {
          const body = request.postData() ?? "";
          if (body.includes('"glossaryId"')) taggedKeyRequests.push(body);
        }
      };
      page.on("request", onRequest);
      await glossary.openGlossaryDetail(glossaryName);
      await glossary.expectDetailSections();
      // Rule and scope badges replace "Is Global"; the definition has no marker (H8, H9).
      await expect(page.getByText("Is Global", { exact: true })).toHaveCount(0);
      await expect(page.getByText("1 module", { exact: true })).toBeVisible();
      await expect(page.getByText("This is a Testing context.", { exact: true })).toBeVisible();
      await expect(page.getByText(/⟦rule:/)).toHaveCount(0);
      // A new glossary has no tagged keys: the empty state shows, not the error.
      await glossary.expectNoTaggedKeys();
      page.off("request", onRequest);
      expect(taggedKeyRequests).toHaveLength(1);
      expect(JSON.parse(taggedKeyRequests[0])).toMatchObject({ pageNumber: 0, pageSize: 10 });
    });

    await test.step("Edit dialog does not warn about the glossary's own name", async () => {
      await glossary.clickEditButton();
      await glossary.expectNoDuplicateNameWarning();
      await glossary.cancelEditor();
    });

    await test.step("Editor validation blocks invalid terminology (C5, C12)", async () => {
      await glossary.clickEditButton();
      let saveRequests = 0;
      const onRequest = (request: import("@playwright/test").Request) => {
        if (/\/Glossary\/Save/.test(request.url())) saveRequests++;
      };
      page.on("request", onRequest);

      if (translationCodes.length > 0) {
        await glossary.addForbidden(translationCodes[0], "arbeitsbereich");
        await glossary.clickSaveButton();
        await glossary.expectFieldError("A translation can't also be forbidden");
        await glossary.editorSheet
          .getByRole("button", {
            name: `Remove forbidden alternative arbeitsbereich for ${translationCodes[0]}`,
          })
          .click();
      }

      await glossary.editorSheet.getByRole("button", { name: /^Remove module / }).click();
      await glossary.clickSaveButton();
      await glossary.expectFieldError("Select at least one module");

      page.off("request", onRequest);
      expect(saveRequests).toBe(0);
      await glossary.editorSheet.getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("Saving unchanged sends the same terminology data (H5)", async () => {
      await glossary.clickEditButton();
      const first = await glossary.saveAndCapturePayload();
      await glossary.expectEditSuccess(glossaryName);
      await glossary.clickEditButton();
      const second = await glossary.saveAndCapturePayload();
      await glossary.expectEditSuccess(glossaryName);
      expect(second.additionalNote).toBe(first.additionalNote);
      expect(second.context).toBe(first.context);
    });

    await test.step("Keep hides translations and writes the keep marker (H10, H11)", async () => {
      await glossary.clickEditButton();
      await glossary.setRule("Keep");
      await expect(glossary.editorSheet.getByRole("heading", { name: "Translations" })).toHaveCount(
        0,
      );
      await glossary.setScope("Whole project");
      const payload = await glossary.saveAndCapturePayload();
      await glossary.expectEditSuccess(glossaryName);
      expect(String(payload.context).endsWith("⟦rule: keep as-is in all languages⟧")).toBe(true);
      expect(payload).toMatchObject({ isGlobal: true, moduleIds: [] });
      expect(parseMeta(payload.additionalNote).rule).toBe("keep");
      await expect(page.getByText("Kept as-is in all languages.")).toBeVisible();
    });

    const updatedName = `Testing-${Date.now()} updated`;

    await test.step("Edit the glossary name", async () => {
      await glossary.clickEditButton();
      await glossary.expectEditDialogLoaded();
      await glossary.fillEditName(updatedName);
      await glossary.clickUpdateButton();
      await glossary.expectEditSuccess(updatedName);
    });

    await test.step("Delete the glossary", async () => {
      await glossary.goBackToList();
      const cascadeRequests: string[] = [];
      const onRequest = (request: import("@playwright/test").Request) => {
        const match = /\/(Key\/SaveKeys|Glossary\/Delete)/.exec(request.url());
        if (match) cascadeRequests.push(match[1]);
      };
      page.on("request", onRequest);
      await glossary.openDeleteGlossaryDialog(updatedName);
      // An untagged glossary is deleted directly, with no SaveKeys request.
      await glossary.expectDeleteUsage("Not used by any keys.");
      await glossary.confirmDeleteGlossary();
      await expect(
        page.getByText("Glossary item deleted successfully.", { exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "Glossary Management" })).toBeVisible({
        timeout: 15_000,
      });
      page.off("request", onRequest);
      expect(cascadeRequests).toEqual(["Glossary/Delete"]);
    });
  });

  test("Glossary — stored terminology data from other clients", async ({ page }) => {
    test.setTimeout(180_000);
    await openGlossary(page);
    const glossary = new GlossaryPage(page);
    await glossary.expectPageLoaded();

    const stamp = Date.now();
    const legacyName = `E2E Legacy ${stamp}`;
    const corruptName = `E2E Corrupt ${stamp}`;
    const corruptNote = `${META_PREFIX}{broken`;

    await test.step("Create fixtures with a plain and a corrupt stored note", async () => {
      await glossary.createGlossaryWithStoredNote(legacyName, "legacy note");
      await glossary.createGlossaryWithStoredNote(corruptName, corruptNote);
    });

    try {
      await test.step("A plain note opens unchanged as a Translate term (H4)", async () => {
        await glossary.openEditFromList(legacyName);
        await expect(glossary.editorSheet.getByRole("radio", { name: "Translate" })).toBeChecked();
        await glossary.expectInternalNote("legacy note");
        await expect(
          glossary.editorSheet.getByText("Stored terminology data could not be read."),
        ).toHaveCount(0);
      });

      await test.step("Saving twice without edits sends the same data (H5)", async () => {
        const first = await glossary.saveAndCapturePayload();
        expect(parseMeta(first.additionalNote)).toEqual({ rule: "translate", note: "legacy note" });
        await expect(
          page.getByText("Glossary item updated successfully.", { exact: true }),
        ).toBeVisible({ timeout: 20_000 });

        await glossary.openEditFromList(legacyName);
        const second = await glossary.saveAndCapturePayload();
        expect(second.additionalNote).toBe(first.additionalNote);
      });

      await test.step("Corrupt data warns, keeps the raw text and saves fresh JSON (C1)", async () => {
        await glossary.openEditFromList(corruptName);
        await expect(
          glossary.editorSheet.getByText(
            "Stored terminology data could not be read. Saving will replace it.",
          ),
        ).toBeVisible();
        await glossary.expectInternalNote(corruptNote);
        const payload = await glossary.saveAndCapturePayload();
        expect(parseMeta(payload.additionalNote)).toEqual({ rule: "translate", note: corruptNote });
      });
    } finally {
      await test.step("Clean up fixtures", async () => {
        await page.keyboard.press("Escape");
        await glossary.deleteGlossaryFromList(legacyName);
        await glossary.deleteGlossaryFromList(corruptName);
      });
    }
  });

  test("Glossary — variants and case-sensitive", async ({ page }) => {
    test.setTimeout(240_000);
    await openGlossary(page);
    const glossary = new GlossaryPage(page);
    await glossary.expectPageLoaded();

    const stamp = Date.now();
    const variantName = `E2E Workspace ${stamp}`;
    const caseName = `E2E SELISE ${stamp}`;
    const created: string[] = [];
    let translationCodes: string[] = [];

    try {
      await test.step("The sheet shows Case-sensitive and Variants (A8)", async () => {
        await glossary.openNewGlossaryDialog();
        await expect(glossary.caseSensitiveSwitch).toBeVisible();
        await expect(glossary.variantsInput).toBeVisible();
        await glossary.fillGlossaryName(variantName);
        await glossary.setRule("Translate");
        translationCodes = await glossary.getTranslationCodes();
      });

      await test.step("Invalid variants block the save (C16)", async () => {
        let saveRequests = 0;
        const onRequest = (request: import("@playwright/test").Request) => {
          if (/\/Glossary\/Save/.test(request.url())) saveRequests++;
        };
        page.on("request", onRequest);

        // C16: a variant equal to the term (normalized) is rejected.
        await glossary.addVariant(variantName.toLowerCase());
        await glossary.clickSaveButton();
        await glossary.expectFieldError("Variant can't be the same as the term");
        await glossary.removeVariant(variantName.toLowerCase());

        // C16: two variants that differ only in case are duplicates.
        await glossary.addVariant(`${variantName}s`);
        await glossary.addVariant(`${variantName.toUpperCase()}S`);
        await glossary.clickSaveButton();
        await glossary.expectFieldError("Variant already listed");
        await glossary.removeVariant(`${variantName.toUpperCase()}S`);

        page.off("request", onRequest);
        expect(saveRequests).toBe(0);
      });

      await test.step("Comma adds a chip and chips are removable (H13)", async () => {
        await glossary.addVariantWithComma(`${variantName}es`);
        await expect(glossary.variantsInput).toHaveValue("");
        const chipRemove = glossary.editorSheet.getByRole("button", {
          name: `Remove variant ${variantName}es`,
        });
        await expect(chipRemove).toBeVisible();
        await chipRemove.click();
        await expect(chipRemove).toHaveCount(0);
      });

      await test.step("Save stores the variant (H13)", async () => {
        if (translationCodes.length > 0) {
          await glossary.fillTranslation(translationCodes[0], "Arbeitsbereich");
          await glossary.addForbidden(translationCodes[0], "Werkbereich");
        }
        await glossary.setScope("Whole project");
        const payload = await glossary.saveAndCapturePayload();
        created.push(variantName);
        await glossary.expectAddSuccess(variantName);
        const meta = parseMeta(payload.additionalNote);
        // H13: the chip entered with Enter is saved in `variants`.
        expect(meta.variants).toEqual([`${variantName}s`]);
        expect(meta.caseSensitive ?? false).toBe(false);
      });

      await test.step("Case-sensitive on is saved (H14)", async () => {
        await glossary.openNewGlossaryDialog();
        await glossary.fillGlossaryName(caseName);
        await glossary.setRule("Keep");
        await glossary.setCaseSensitive(true);
        await glossary.setScope("Whole project");
        const payload = await glossary.saveAndCapturePayload();
        created.push(caseName);
        await glossary.expectAddSuccess(caseName);
        const meta = parseMeta(payload.additionalNote);
        // H14: the switch is saved as `caseSensitive`.
        expect(meta).toMatchObject({ rule: "keep", caseSensitive: true });
      });

      await test.step("Details pages show the variant chips and the badge (H13, H14)", async () => {
        await glossary.searchGlossaries(variantName);
        await glossary.openGlossaryDetail(variantName);
        // H13: the details page lists the variants as chips.
        await expect(page.getByText("Variants:", { exact: true })).toBeVisible();
        await expect(page.getByText(`${variantName}s`, { exact: true })).toBeVisible();
        await expect(page.getByText("Case-sensitive", { exact: true })).toHaveCount(0);
        await glossary.goBackToList();

        await glossary.searchGlossaries(caseName);
        await glossary.openGlossaryDetail(caseName);
        // H14: the "Case-sensitive" badge is shown when set; no variants row without variants.
        await expect(page.getByText("Case-sensitive", { exact: true })).toBeVisible();
        await expect(page.getByText("Variants:", { exact: true })).toHaveCount(0);
        await glossary.goBackToList();
      });
    } finally {
      await test.step("Clean up fixtures", async () => {
        // Back to a fresh list page, wherever a failed step left the browser.
        await openGlossary(page);
        for (const name of created) {
          await glossary
            .deleteGlossaryFromList(name)
            .catch((error) => console.warn(`[e2e] Cleanup could not delete "${name}":`, error));
        }
      });
    }
  });
});

test.describe("Glossary — shared picker and keyboard (SPEC4)", () => {
  test("Tagging picker, create, seed, errors and row keyboard (steps 4-8, 11-13)", async ({
    page,
  }) => {
    test.setTimeout(420_000);
    const api = await LocalizationApi.capture(page);
    const glossary = new GlossaryPage(page);
    const modules = new ModulesPage(page);
    const translations = new TranslationsPage(page);
    const languages = await api.languages();
    const source = languages.find((language) => language.isDefault) ?? languages[0];

    const tag = Array.from({ length: 8 }, () =>
      String.fromCharCode(97 + Math.floor(Math.random() * 26)),
    ).join("");
    const names = {
      module: `e2e-picker-m-${tag}`,
      term: `Gadget${tag}`,
      second: `Widget${tag}`,
      created: `zzz-none-${tag}`,
      key: `e2e.picker.${tag}`,
    };
    const ids = { module: "", term: "", second: "", key: "" };
    const extraGlossaries: string[] = [];
    const tagDialog = modules.tagGlossaryDialog;
    const keyTagDialog = page.getByRole("dialog", { name: "Tag Glossary" });

    const openModuleTagging = async () => {
      await openModules(page);
      await modules.searchModules(names.module);
      await modules.openTagGlossaryDialog(names.module);
    };

    try {
      await test.step("Create fixtures", async () => {
        ids.module = await api.createModule(names.module);
        ids.term = await api.createGlossary({
          name: names.term,
          additionalNote: `${META_PREFIX}${JSON.stringify({ rule: "translate" })}`,
          isGlobal: false,
          moduleIds: [ids.module],
        });
        ids.second = await api.createGlossary({
          name: names.second,
          additionalNote: `${META_PREFIX}${JSON.stringify({ rule: "keep" })}`,
          isGlobal: true,
        });
        ids.key = await api.createKey({
          keyName: names.key,
          moduleId: ids.module,
          culture: source.languageCode,
          value: `Open the ${names.term}`,
          context: "Formal tone.",
          glossaryIds: [ids.term, ids.second],
        });
      });

      await test.step("Step 4: module tagging creates a missing term and saves it (H7-H9)", async () => {
        await openModuleTagging();
        // H14: the seed shows the module's tagged term.
        await expect(tagDialog.getByRole("button", { name: `Remove ${names.term}` })).toBeVisible({
          timeout: 15_000,
        });
        await modules.searchInTagPicker(names.created);
        await tagDialog.getByRole("button", { name: `Create "${names.created}"` }).click();
        await expect(glossary.editorSheet).toBeVisible();
        await expect(glossary.editorSheet.getByRole("textbox", { name: "Name *" })).toHaveValue(
          names.created,
        );
        await glossary.clickSaveButton();
        await expect(glossary.editorSheet).toHaveCount(0, { timeout: 20_000 });
        const created = await api.findGlossaryId(names.created);
        if (created) extraGlossaries.push(created);
        await expect(
          tagDialog.getByRole("button", { name: `Remove ${names.created}` }),
        ).toBeVisible({ timeout: 15_000 });
        const request = page.waitForRequest((r) => /\/Module\/TagGlossary/.test(r.url()));
        await page.keyboard.press("Escape");
        await tagDialog.getByRole("button", { name: "Save" }).click();
        const body = (await request).postDataJSON() as { glossaryIds: string[] };
        expect(body.glossaryIds).toEqual(expect.arrayContaining([ids.term, created]));
        await expect(tagDialog).toHaveCount(0, { timeout: 15_000 });
      });

      await test.step("Step 7: the picker fits a 390 px screen (C11)", async () => {
        const size = page.viewportSize();
        await page.setViewportSize({ width: 390, height: 844 });
        try {
          await openModuleTagging();
          await modules.searchInTagPicker(names.term);
          const listbox = tagDialog.getByRole("listbox");
          await expect(listbox).toBeVisible();
          for (const box of [await listbox.boundingBox(), await tagDialog.boundingBox()]) {
            expect(box).not.toBeNull();
            expect(box!.x).toBeGreaterThanOrEqual(0);
            expect(box!.x + box!.width).toBeLessThanOrEqual(390);
          }
          await page.keyboard.press("Escape");
          await tagDialog.getByRole("button", { name: "Cancel" }).click();
        } finally {
          if (size) await page.setViewportSize(size);
        }
      });

      await test.step("Step 11: the seed loads every page; Save sends all ids (H14, C15)", async () => {
        const fake = (from: number, count: number) =>
          Array.from({ length: count }, (_, index) => ({
            itemId: `seed-${tag}-${from + index}`,
            name: `Seed ${from + index}`,
          }));
        const seedRequests: string[] = [];
        let failSecondPage = false;
        const seedRoute = async (route: import("@playwright/test").Route) => {
          const url = new URL(route.request().url());
          if (url.searchParams.get("ModuleId") !== ids.module) return route.continue();
          seedRequests.push(url.toString());
          const pageNumber = Number(url.searchParams.get("PageNumber"));
          if (pageNumber === 1 && failSecondPage) {
            return route.fulfill({ status: 500, json: { errors: "scripted failure" } });
          }
          return route.fulfill({
            json:
              pageNumber === 0
                ? { items: fake(0, 100), totalCount: 101 }
                : { items: fake(100, 1), totalCount: 101 },
          });
        };
        const tagRoute = (route: import("@playwright/test").Route) =>
          route.fulfill({ json: { isSuccess: true } });
        await page.route(/\/Glossary\/Gets/, seedRoute);
        await page.route(/\/Module\/TagGlossary/, tagRoute);
        try {
          await openModuleTagging();
          await expect(tagDialog.getByRole("button", { name: /^Remove Seed/ })).toHaveCount(101, {
            timeout: 15_000,
          });
          expect(seedRequests).toHaveLength(2);
          const request = page.waitForRequest((r) => /\/Module\/TagGlossary/.test(r.url()));
          await tagDialog.getByRole("button", { name: "Save" }).click();
          const body = (await request).postDataJSON() as { glossaryIds: string[] };
          expect(body.glossaryIds).toHaveLength(101);

          failSecondPage = true;
          await openModuleTagging();
          await expect(tagDialog.getByText("Couldn't load this module's glossaries")).toBeVisible({
            timeout: 15_000,
          });
          await expect(tagDialog.getByRole("button", { name: "Save" })).toBeDisabled();
          await tagDialog.getByRole("button", { name: "Cancel" }).click();
        } finally {
          await page.unroute(/\/Glossary\/Gets/, seedRoute);
          await page.unroute(/\/Module\/TagGlossary/, tagRoute);
        }
      });

      await test.step("Step 12: a duplicate offers 'Select it'; Escape closes only the sheet (H15, C18, H16)", async () => {
        await openModuleTagging();
        await expect(tagDialog.getByRole("button", { name: `Remove ${names.term}` })).toBeVisible({
          timeout: 15_000,
        });
        await modules.searchInTagPicker(`${names.second}-nomatch`);
        await tagDialog.getByRole("button", { name: `Create "${names.second}-nomatch"` }).click();
        const nameField = glossary.editorSheet.getByRole("textbox", { name: "Name *" });
        await nameField.fill(names.second.toLowerCase());
        await expect(page.getByText(`'${names.second}' already exists.`)).toBeVisible({
          timeout: 10_000,
        });
        await glossary.selectDuplicateGlossary();
        await expect(glossary.editorSheet).toHaveCount(0);
        await expect(tagDialog).toBeVisible();
        await expect(
          tagDialog.getByRole("button", { name: `Remove ${names.second}` }),
        ).toBeVisible();

        // C18: Escape inside the sheet closes only the sheet.
        await modules.searchInTagPicker(`${names.created}-again`);
        await tagDialog.getByRole("button", { name: `Create "${names.created}-again"` }).click();
        await glossary.editorSheet.getByRole("textbox", { name: "Name *" }).click();
        await page.keyboard.press("Escape");
        await expect(glossary.editorSheet).toHaveCount(0);
        await expect(tagDialog).toBeVisible();
        await expect(tagDialog.getByRole("button", { name: `Remove ${names.term}` })).toBeVisible();
        await page.keyboard.press("Escape");
        await tagDialog.getByRole("button", { name: "Cancel" }).click();

        // H16: from the glossary table the warning still offers "Open it".
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.openNewGlossaryDialog();
        await glossary.fillGlossaryName(names.second.toLowerCase());
        await glossary.expectDuplicateNameWarning(names.second);
        await glossary.cancelEditor();
      });

      await test.step("Steps 8 and 13: row keyboard navigation (H11, C17)", async () => {
        await openGlossary(page);
        await glossary.expectPageLoaded();
        await glossary.searchGlossaries(names.term);
        await glossary.waitForRowMenuButton(names.term);
        // C17: Enter on the row's actions button opens the menu, no navigation.
        const listUrl = page.url();
        await glossary.getRowMenuButton(names.term).focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
        expect(page.url()).toBe(listUrl);
        await page.keyboard.press("Escape");
        // H11: Enter on the focused row opens the details page.
        await page.getByRole("row").filter({ hasText: names.term }).focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("heading", { name: names.term })).toBeVisible({
          timeout: 15_000,
        });
        const keyRow = page.getByRole("row").filter({ hasText: names.key });
        await expect(keyRow).toBeVisible({ timeout: 15_000 });
        await keyRow.focus();
        await page.keyboard.press("Enter");
        await expect(page).toHaveURL(new RegExp(`/services/language/translations/${ids.key}$`));
      });

      await test.step("Step 6: unknown tagged glossary and search error (C7, C9)", async () => {
        // Force the key's tags to resolve through Glossary/Get, and make one of them fail.
        const emptyLists = (route: import("@playwright/test").Route) => {
          const url = new URL(route.request().url());
          if (url.searchParams.get("ModuleId") || url.searchParams.get("IsGlobal")) {
            return route.continue();
          }
          if (url.searchParams.get("SearchText")) {
            return route.fulfill({ status: 500, json: { errors: "scripted failure" } });
          }
          return route.fulfill({ json: { items: [], totalCount: 0 } });
        };
        const missing = (route: import("@playwright/test").Route) =>
          new URL(route.request().url()).searchParams.get("itemId") === ids.term
            ? route.fulfill({ status: 404, json: {} })
            : route.continue();
        await page.route(/\/Glossary\/Gets/, emptyLists);
        await page.route(/\/Glossary\/Get\?/, missing);
        try {
          await translations.openKeyDetails(ids.key);
          await page.getByRole("button", { name: "Tag Glossary" }).click();
          await expect(
            keyTagDialog.getByRole("button", { name: "Remove Unknown glossary" }),
          ).toBeVisible({ timeout: 15_000 });
          await keyTagDialog.getByRole("combobox").click();
          await keyTagDialog.getByPlaceholder("Search glossary...").fill(names.second);
          await expect(keyTagDialog.getByText("Couldn't search glossaries")).toBeVisible({
            timeout: 20_000,
          });
          await expect(
            keyTagDialog.getByRole("button", { name: "Remove Unknown glossary" }),
          ).toBeVisible();
          await page.keyboard.press("Escape");
          await keyTagDialog.getByRole("button", { name: "Cancel" }).click();
        } finally {
          await page.unroute(/\/Glossary\/Gets/, emptyLists);
          await page.unroute(/\/Glossary\/Get\?/, missing);
        }
      });

      await test.step("Step 5: View Details uses the same picker; key context is kept (H9, C13)", async () => {
        await translations.openKeyDetails(ids.key);
        await page.getByRole("button", { name: "Tag Glossary" }).click();
        await keyTagDialog.getByRole("button", { name: `Remove ${names.second}` }).click();
        const payload = await translations.captureKeySave(() =>
          keyTagDialog.getByRole("button", { name: "Update" }).click(),
        );
        expect(payload).toMatchObject({
          itemId: ids.key,
          context: "Formal tone.",
          glossaryIds: [ids.term],
        });
        await expect
          .poll(async () => (await api.findKey(names.key, ids.module))?.glossaryIds ?? [], {
            timeout: 15_000,
          })
          .toEqual([ids.term]);
        expect((await api.findKey(names.key, ids.module))?.context).toBe("Formal tone.");
      });
    } finally {
      await test.step("Clean up fixtures", async () => {
        if (ids.key) await api.deleteKey(ids.key);
        for (const id of [ids.term, ids.second, ...extraGlossaries]) {
          if (id) await api.deleteGlossary(id);
        }
        if (ids.module) await api.deleteModule(ids.module);
      });
    }
  });
});
