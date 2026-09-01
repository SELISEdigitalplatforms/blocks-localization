import { test, expect } from "../../support/test-base";
import { ModulesPage } from "../../support/pages/modules.page";
import { openModules } from "../../support/localization-helpers";

test.describe("Modules", () => {
  test.beforeEach(async ({ page }) => {
    await openModules(page);
  });

  test("Module Page", async ({ page }) => {
    const modules = new ModulesPage(page);

    await test.step("Language Modules page loads", async () => {
      await modules.expectPageLoaded();
      await modules.expectSearchVisible();
      await modules.expectTableHeadersVisible();
    });

    const newModuleButton = page.getByRole("button", { name: "New Module" });

    await test.step("Create Module: blank/whitespace name is rejected", async () => {
      await expect(newModuleButton).toBeVisible();
      await modules.openNewModuleDialog();
      await modules.expectModuleNameInputVisible();
      await modules.fillModuleName("   ");
      await modules.expectModuleNameErrorVisible();
      await modules.closeNewModuleDialog();
    });

    await test.step("Create Module: valid name succeeds", async () => {
      await expect(newModuleButton).toBeVisible();
      await modules.openNewModuleDialog();
      await modules.expectModuleNameInputVisible();
      await modules.fillModuleName(`Testing-${Date.now()}`);
      await modules.clickCreateButton();
      await modules.expectModuleAddedSuccess();
    });

    await test.step("Module Details page: Details tab", async () => {
      await modules.openModuleDetails("5/5/");
      await modules.expectDetailsTabLoaded();
    });

    await test.step("Module Details page: Glossary tab", async () => {
      await modules.switchToGlossaryTab();
      await modules.expectGlossaryTabLoaded();
      await modules.expectNoGlossariesTaggedOrTableVisible();
    });

    await test.step("Module row actions: Edit and Tag glossary", async () => {
      const moduleName = `Testing-${Date.now()}`;
      await openModules(page);
      await expect(newModuleButton).toBeVisible();
      await modules.openNewModuleDialog();
      await modules.expectModuleNameInputVisible();
      await modules.fillModuleName(moduleName);
      await modules.clickCreateButton();
      await modules.expectModuleAddedSuccess();
      await modules.closeNewModuleDialog();

      await modules.searchModules(moduleName);
      await modules.openEditModuleDialog(moduleName);
      await modules.closeNewModuleDialog();

      await modules.openTagGlossaryDialog(moduleName);
      await modules.closeNewModuleDialog();
    });
  });
});
