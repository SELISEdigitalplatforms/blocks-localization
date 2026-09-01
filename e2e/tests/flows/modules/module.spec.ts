import { test, expect } from "../../../support/test-base";
import { openProjectDashboard } from "../../../support/flow-helpers";

test.describe("Modules", () => {
  test.beforeEach(async ({ page }) => {
    await openProjectDashboard(page);
  });

  test("Module Page", async ({ page }) => {
    await test.step("Language Modules page loads", async () => {
      await page.getByRole("link", { name: "Modules" }).click();
      await page.getByRole("heading", { name: "Modules", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Language Modules" })).toBeVisible({
        timeout: 15000,
      });

      await expect(page.getByRole("button", { name: "New Module" })).toBeVisible();

      await expect(page.getByRole("textbox", { name: "Search modules..." })).toBeVisible();

      await expect(page.getByRole("columnheader", { name: "Module Name" })).toBeVisible();

      await expect(page.getByRole("columnheader", { name: "Created By" })).toBeVisible();

      await expect(page.getByRole("columnheader", { name: "Created Date" })).toBeVisible();

      await expect(page.getByRole("columnheader", { name: "Actions" })).toBeVisible();
    });

    const newModuleButton = page.getByRole("button", {
      name: "New Module",
    });

    const moduleNameInput = page.getByRole("textbox", {
      name: "Enter Module name",
    });

    const createButton = page.getByRole("button", {
      name: "Create",
    });

    const moduleNameError = page.getByText("Module name is required", {
      exact: true,
    });

    await test.step("Create Module: blank/whitespace name is rejected", async () => {
      await expect(newModuleButton).toBeVisible();
      await newModuleButton.click();

      await expect(moduleNameInput).toBeVisible();

      await moduleNameInput.fill("   ");

      await expect(moduleNameError).toBeVisible({ timeout: 10000 });
      // await expect(createButton).toBeDisabled();
      await page.getByRole("button", { name: "Close" }).click();
    });

    const newModuleHeading = page.getByRole("heading", {
      name: "New module",
    });

    const moduleAddedMessage = page.getByText("New module added", {
      exact: true,
    });

    await test.step("Create Module: valid name succeeds", async () => {
      await expect(newModuleButton).toBeVisible();
      await newModuleButton.click();

      await expect(newModuleHeading).toBeVisible();

      await expect(moduleNameInput).toBeVisible();
      await moduleNameInput.fill(`Testing-${Date.now()}`);

      await expect(createButton).toBeVisible();
      await createButton.click();
      await expect(moduleAddedMessage).toBeVisible({ timeout: 20000 });
    });

    await test.step("Module Details page: Details tab", async () => {
      await page.getByRole("cell", { name: "5/5/" }).first().click();

      await expect(page.getByRole("tab", { name: "Details" })).toBeVisible({ timeout: 15000 });

      // About Section
      await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Module Name" })).toBeVisible();

      await expect(page.getByRole("heading", { name: "Created By" })).toBeVisible();

      await expect(page.getByRole("heading", { name: "Created Date" })).toBeVisible();

      await expect(page.getByRole("heading", { name: "Last Update Date" })).toBeVisible();

      await expect(page.getByRole("heading", { name: "Last Updated By" })).toBeVisible();
    });

    await test.step("Module Details page: Glossary tab", async () => {
      await page.getByRole("tab", { name: "Glossary" }).click();
      await expect(page.getByRole("tab", { name: "Glossary" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /Tagged Glossaries/ })).toBeVisible({
        timeout: 15000,
      });

      // A freshly created module has no tagged glossaries, but the shared dev
      // project may already carry some from a previous run, so accept either state.
      const noGlossariesTagged = page.getByText(/No glossaries tagged to this/);
      const taggedGlossariesTable = page.getByRole("table");
      await expect(noGlossariesTagged.or(taggedGlossariesTable).first()).toBeVisible({
        timeout: 15000,
      });
    });

    // const actionsMenu = page.locator("#radix-_r_2cn_");

    // const editMenuItem = page.getByRole("menuitem", {
    //   name: "Edit",
    // });

    // const tagGlossaryText = page.getByText("Tag glossary");

    // // Open actions menu
    // await expect(actionsMenu).toBeVisible();
    // await actionsMenu.click();

    // // Edit
    // await expect(editMenuItem).toBeVisible();
    // await editMenuItem.click();

    // // Tag glossary
    // await expect(tagGlossaryText).toBeVisible();
  });
});
