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
      await glossary.selectTagModule("common");
    });

    await test.step("Fill Context and Additional Notes", async () => {
      await glossary.fillContext("This is a Testing context.");
      await glossary.fillAdditionalNotes("This is Additional Notes");
    });

    await test.step("Add glossary and verify success", async () => {
      await glossary.clickAddButton();
      await glossary.expectAddSuccess(glossaryName);
    });

    await test.step("Open glossary detail and verify sections", async () => {
      await glossary.openGlossaryDetail(glossaryName);
      await glossary.expectDetailSections();
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
      await glossary.openDeleteGlossaryDialog(updatedName);
      await glossary.confirmDeleteGlossary();
      await expect(
        page.getByText("Glossary item deleted successfully.", { exact: true }),
      ).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "Glossary Management" })).toBeVisible({
        timeout: 15_000,
      });
    });
  });
});
