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
    const moduleName = `Testing-${Date.now()}`;

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
      await modules.fillModuleName(moduleName);
      await modules.clickCreateButton();
      await modules.expectModuleAddedSuccess();
    });

    await test.step("Module search: filters rows and shows empty state on no match", async () => {
      await modules.searchModules(moduleName);
      await expect(page.getByRole("row").filter({ hasText: moduleName })).toBeVisible({
        timeout: 10_000,
      });

      await modules.searchModules(`no-such-module-${Date.now()}`);
      await expect(page.getByText("No modules match your search.")).toBeVisible({
        timeout: 10_000,
      });

      // Clearing the search restores the unfiltered list. The shared project
      // can hold more modules than one page shows, so verify the list is back
      // and re-search to land on the created row again.
      await modules.searchModules("");
      await expect(page.getByText("No modules match your search.")).toBeHidden();
      await expect(page.getByRole("cell").first()).toBeVisible();
      await modules.searchModules(moduleName);
      await expect(page.getByRole("row").filter({ hasText: moduleName })).toBeVisible({
        timeout: 10_000,
      });
    });

    await test.step("Module Details page: Details tab", async () => {
      await modules.openModuleDetails(moduleName);
      await modules.expectDetailsTabLoaded();
    });

    await test.step("Module Details page: Glossary tab", async () => {
      await modules.switchToGlossaryTab();
      await modules.expectGlossaryTabLoaded();
      await modules.expectNoGlossariesTaggedOrTableVisible();
    });

    await test.step("Module row actions: Edit and Tag glossary", async () => {
      await openModules(page);
      await expect(newModuleButton).toBeVisible();
      await modules.searchModules(moduleName);
      await modules.openEditModuleDialog(moduleName);

      await test.step("Edit Module: rename and verify", async () => {
        const renamedModule = `${moduleName} updated`;
        const nameInput = page.getByRole("textbox", { name: "Enter module name" });
        await nameInput.fill(renamedModule);
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.getByText("Module updated", { exact: true })).toBeVisible({
          timeout: 20_000,
        });
        await modules.searchModules(renamedModule);
        await expect(page.getByRole("row").filter({ hasText: renamedModule })).toBeVisible({
          timeout: 10_000,
        });
      });

      await test.step("Tag glossary dialog opens and closes", async () => {
        const renamedLocator = page.getByRole("row").filter({ hasText: `${moduleName} updated` });
        await modules.openTagGlossaryDialog(`${moduleName} updated`);
        await modules.closeNewModuleDialog();
        await expect(renamedLocator).toBeVisible({ timeout: 10_000 });
      });
    });
  });
});
