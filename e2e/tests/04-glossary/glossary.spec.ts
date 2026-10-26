import { test, expect } from "../../support/test-base";
import {
  GlossaryPage,
  enableGlossaryEnforcement,
  readGlossaryEnforcementFlag,
  GLOSSARY_ENFORCEMENT_PLACEHOLDER,
} from "../../support/pages/glossary.page";
import { openGlossary } from "../../support/localization-helpers";

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
      // This test runs with the flag off: Variants is hidden, so a new term stores none (C17).
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

  test("Glossary — variants and case-sensitive with the flag on", async ({ page }) => {
    test.setTimeout(240_000);
    const flag = await enableGlossaryEnforcement(page);
    await openGlossary(page);
    const glossary = new GlossaryPage(page);
    await glossary.expectPageLoaded();
    expect(await readGlossaryEnforcementFlag(page)).toBe("true");
    expect(flag.state.rewritten).toBeGreaterThan(0);

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

  test("Glossary — flag off hides variants and case-sensitive and keeps them (C17)", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await openGlossary(page);
    const glossary = new GlossaryPage(page);
    await glossary.expectPageLoaded();
    // C1: the HTML is served with the unreplaced placeholder (checked in the Q4 test); the
    // loaded page may clear it to "", and either way the flag reads as off.
    expect(["", GLOSSARY_ENFORCEMENT_PLACEHOLDER]).toContain(
      await readGlossaryEnforcementFlag(page),
    );

    const name = `E2E Stored variants ${Date.now()}`;
    const storedNote = `${META_PREFIX}${JSON.stringify({
      rule: "translate",
      caseSensitive: true,
      variants: [`${name}s`],
    })}`;
    await glossary.createGlossaryWithStoredNote(name, storedNote);

    try {
      await test.step("The sheet hides both fields and saving keeps them (C17)", async () => {
        await glossary.openEditFromList(name);
        await expect(glossary.editorSheet.getByRole("textbox", { name: "Name *" })).toBeVisible();
        // C17: no Variants input and no Case-sensitive switch with the flag off.
        await expect(glossary.variantsInput).toHaveCount(0);
        await expect(glossary.caseSensitiveSwitch).toHaveCount(0);
        const payload = await glossary.saveAndCapturePayload();
        await expect(
          page.getByText("Glossary item updated successfully.", { exact: true }),
        ).toBeVisible({ timeout: 20_000 });
        // C17: the stored values survive the save unchanged.
        expect(parseMeta(payload.additionalNote)).toMatchObject({
          caseSensitive: true,
          variants: [`${name}s`],
        });
      });

      await test.step("The details page shows neither (C17)", async () => {
        await glossary.searchGlossaries(name);
        await glossary.openGlossaryDetail(name);
        await expect(page.getByText("Variants:", { exact: true })).toHaveCount(0);
        await expect(page.getByText("Case-sensitive", { exact: true })).toHaveCount(0);
        await glossary.goBackToList();
      });
    } finally {
      await test.step("Clean up fixtures", async () => {
        await openGlossary(page);
        await glossary.deleteGlossaryFromList(name);
      });
    }
  });
});
