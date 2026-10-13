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

  // Needs blocks-localization::module::delete (seed T6a) on the test role; otherwise the delete is a 403.
  test.describe("Delete module", () => {
    // Modules a scenario created and has not yet seen deleted; afterEach removes leftovers.
    let pendingCleanup: string[] = [];

    test.afterEach(async ({ page }) => {
      if (pendingCleanup.length === 0) return;
      const modules = new ModulesPage(page);
      await openModules(page);
      for (const name of pendingCleanup) {
        await modules.deleteModuleIfPresent(name);
      }
      pendingCleanup = [];
    });

    test("Cascade delete removes the module", async ({ page }) => {
      const modules = new ModulesPage(page);
      const moduleName = `DeleteCascade-${Date.now()}`;

      await test.step("Create a throwaway module", async () => {
        await modules.expectPageLoaded();
        pendingCleanup.push(moduleName);
        await modules.createModule(moduleName);
      });

      await test.step("Row menu Delete opens the dialog with cascade as the default", async () => {
        await modules.openDeleteModuleDialog(moduleName);
        // H4: both options are offered and cascade is preselected.
        await expect(modules.cascadeOption).toBeVisible();
        await expect(modules.moveOption).toBeVisible();
        await expect(modules.cascadeOption).toBeChecked();
        await expect(modules.moveOption).not.toBeChecked();
      });

      await test.step("Confirming deletes the module", async () => {
        await modules.confirmDeleteModuleButton.click();
        // H5: success toast, dialog closes, and the row disappears after the list refresh.
        await modules.expectModuleDeleted(moduleName);
        pendingCleanup = pendingCleanup.filter((name) => name !== moduleName);
      });
    });

    test("Move delete removes the module and keeps the target", async ({ page }) => {
      const modules = new ModulesPage(page);
      const stamp = Date.now();
      const sourceName = `DeleteMoveSrc-${stamp}`;
      const targetName = `DeleteMoveDst-${stamp}`;

      await test.step("Create a source and a target module", async () => {
        await modules.expectPageLoaded();
        pendingCleanup.push(sourceName, targetName);
        await modules.createModule(targetName);
        await modules.createModule(sourceName);
      });

      await test.step("Move mode requires a target, picked from the full module list", async () => {
        await modules.openDeleteModuleDialog(sourceName);
        await modules.moveOption.click();
        // Move mode (canSubmit, alongside C7): Delete stays disabled until a target is chosen.
        await expect(modules.confirmDeleteModuleButton).toBeDisabled();
        // H4 (T7): the table is filtered to the source, yet the picker still offers the target.
        await modules.selectMoveTarget(targetName);
        await expect(modules.confirmDeleteModuleButton).toBeEnabled();
      });

      await test.step("Confirming deletes the source and leaves the target", async () => {
        await modules.confirmDeleteModuleButton.click();
        // H5: success toast, dialog closes, and the source row disappears.
        await modules.expectModuleDeleted(sourceName);
        pendingCleanup = pendingCleanup.filter((name) => name !== sourceName);
        // H2: the target module survives the move (key migration is out of scope, §8).
        await modules.searchModules(targetName);
        await expect(modules.getModuleRow(targetName)).toBeVisible({ timeout: 10_000 });
      });
    });
  });
});
