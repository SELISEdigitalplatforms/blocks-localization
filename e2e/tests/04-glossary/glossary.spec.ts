import { test, expect } from "../../support/test-base";
import { GlossaryPage } from "../../support/pages/glossary.page";
import { openGlossary } from "../../support/localization-helpers";

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
      await glossary.fillGlossaryName(glossaryName);
    });

    await test.step("Select Language", async () => {
      await glossary.selectLanguage("English");
    });

    await test.step("Select Type", async () => {
      await glossary.selectType("Full form");
    });

    await test.step("Add to global context", async () => {
      await glossary.toggleGlobalContext();
    });

    await test.step("Select module", async () => {
      await glossary.selectTagModule();
    });

    await test.step("Fill Context and Additional Notes", async () => {
      await glossary.fillContext("This is a Testing context.");
      await glossary.fillAdditionalNotes("This is Additional Notes");
    });

    await test.step("Add glossary and verify success", async () => {
      await glossary.clickAddButton();
      await glossary.expectAddSuccess(glossaryName);
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
      // A new glossary has no tagged keys: the empty state shows, not the error.
      await glossary.expectNoTaggedKeys();
      page.off("request", onRequest);
      expect(taggedKeyRequests).toHaveLength(1);
      expect(JSON.parse(taggedKeyRequests[0])).toMatchObject({ pageNumber: 0, pageSize: 10 });
    });

    await test.step("Edit dialog does not warn about the glossary's own name", async () => {
      await glossary.clickEditButton();
      await glossary.expectNoDuplicateNameWarning();
      await page.keyboard.press("Escape");
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
});
