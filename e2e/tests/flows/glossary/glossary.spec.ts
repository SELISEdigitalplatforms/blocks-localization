import { test, expect } from "../../../support/test-base";
import { openProjectDashboard } from "../../../support/flow-helpers";

test.describe("Glossary", () => {
  test.beforeEach(async ({ page }) => {
    await openProjectDashboard(page);
  });

  test("Glossary Page", async ({ page }) => {
    const glossaryLink = page.getByRole("link", {
      name: "Glossary",
    });

    const newGlossaryButton = page.getByRole("button", {
      name: "New Glossary",
    });

    const glossaryManagementHeading = page.getByRole("heading", {
      name: "Glossary Management",
    });

    const noGlossariesMessage = page.getByText("No glossaries yet");

    const glossaryDescription = page.getByText("Glossaries help keep");
    const firstGlossaryRow = page.getByRole("row").nth(1);

    await test.step("Glossary Management page loads", async () => {
      await expect(glossaryLink).toBeVisible();
      await glossaryLink.click();

      await expect(glossaryManagementHeading).toBeVisible({ timeout: 15000 });

      // The project may already have glossaries from a previous run, so the
      // empty state is only expected on a fresh project.
      if (await noGlossariesMessage.isVisible().catch(() => false)) {
        await expect(glossaryDescription).toBeVisible({ timeout: 10000 });
      } else {
        await expect(firstGlossaryRow).toBeVisible({ timeout: 10000 });
        await expect(firstGlossaryRow).toBeVisible({ timeout: 10000 });
      }
      await expect(newGlossaryButton).toBeVisible();
    });

    const glossaryNameInput = page.getByRole("textbox", {
      name: "Name *",
    });

    const contextInput = page.getByRole("textbox", {
      name: "Context",
    });

    const additionalNotesInput = page.getByRole("textbox", {
      name: "Additional Notes",
    });

    const addButton = page.getByRole("button", {
      name: "Add",
    });

    const successMessage = page.getByText("Glossary item added successfully.", {
      exact: true,
    });

    const addGlossaryDialog = page.getByRole("dialog", { name: "Add Glossary" });

    await test.step("Open Add Glossary and fill in the name", async () => {
      await newGlossaryButton.click();

      await expect(page.getByRole("heading", { name: "Add Glossary" })).toBeVisible();

      await expect(page.getByText("Name *")).toBeVisible();

      await expect(glossaryNameInput).toBeVisible();
      await glossaryNameInput.fill(`Testing-${Date.now()}`);
    });

    await test.step("Select Language", async () => {
      // Required for submission; the Add click otherwise silently fails to
      // submit and the dialog just stays open with no error.
      const languageField = addGlossaryDialog.getByRole("button", { name: "Language" });
      await expect(languageField).toBeVisible();

      await languageField.click();

      await expect(page.getByRole("option", { name: "English" })).toBeVisible({ timeout: 10000 });

      await page.getByRole("option", { name: "English" }).click();
    });

    await test.step("Select Type", async () => {
      const typeField = addGlossaryDialog.getByText("Type", { exact: true });
      await expect(typeField).toBeVisible();

      await typeField.click();

      await expect(page.getByRole("option", { name: "Full form" })).toBeVisible();

      await page.getByRole("option", { name: "Full form" }).click();
    });

    await test.step("Add to global context", async () => {
      const globalContextCheckbox = page.getByRole("checkbox", {
        name: "Add to global context",
      });

      await expect(globalContextCheckbox).toBeVisible();
      await globalContextCheckbox.click();
    });

    await test.step("Select module", async () => {
      const tagModules = page.getByText("Tag modules...", {
        exact: true,
      });

      await expect(tagModules).toBeVisible();
      await tagModules.click();

      await expect(page.getByRole("option", { name: "common" })).toBeVisible();

      await page.getByRole("option", { name: "common" }).click();
    });

    await test.step("Fill Context and Additional Notes", async () => {
      await expect(addGlossaryDialog.getByText("Context", { exact: true })).toBeVisible();

      await expect(contextInput).toBeVisible();
      await contextInput.fill("This is a Testing context.");

      await expect(addGlossaryDialog.getByText("Additional Notes", { exact: true })).toBeVisible();

      await expect(additionalNotesInput).toBeVisible();
      await additionalNotesInput.fill("This is Additional Notes");
    });

    await test.step("Add glossary and verify success", async () => {
      await expect(addButton).toBeVisible();
      await addButton.click();

      await expect(successMessage).toBeVisible({ timeout: 20000 });
    });
  });
});
