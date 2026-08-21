import { loginFresh } from "@/support/auth-helpers";
import test, { expect } from "@playwright/test";

test.describe("Glossary", async () => {
  test.beforeEach(async ({ page }) => {
    await loginFresh(page);
    await page
      .getByRole("button", { name: /Development/ })
      .first()
      .click();
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

    // Create glossary
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

    // Open Add Glossary
    await newGlossaryButton.click();

    const addGlossaryDialog = page.getByRole("dialog", { name: "Add Glossary" });

    await expect(page.getByRole("heading", { name: "Add Glossary" })).toBeVisible();

    await expect(page.getByText("Name *")).toBeVisible();

    // Enter glossary name
    await expect(glossaryNameInput).toBeVisible();
    await glossaryNameInput.fill(`Testing-${Date.now()}`);

    // Select Language
    // const languageField = addGlossaryDialog.getByText("Language", { exact: true });
    // await expect(languageField).toBeVisible();

    // await languageField.click();

    // await expect(page.getByRole("option", { name: "English" })).toBeVisible({ timeout: 10000 });

    // await page.getByRole("option", { name: "English" }).click();

    // Select Type
    const typeField = addGlossaryDialog.getByText("Type", { exact: true });
    await expect(typeField).toBeVisible();

    await typeField.click();

    await expect(page.getByRole("option", { name: "Full form" })).toBeVisible();

    await page.getByRole("option", { name: "Full form" }).click();

    // Add to global context
    const globalContextCheckbox = page.getByRole("checkbox", {
      name: "Add to global context",
    });

    await expect(globalContextCheckbox).toBeVisible();
    await globalContextCheckbox.click();

    // Select module
    const tagModules = page.getByText("Tag modules...", {
      exact: true,
    });

    await expect(tagModules).toBeVisible();
    await tagModules.click();

    await expect(page.getByRole("option", { name: "common" })).toBeVisible();

    await page.getByRole("option", { name: "common" }).click();

    // Context
    await expect(addGlossaryDialog.getByText("Context", { exact: true })).toBeVisible();

    await expect(contextInput).toBeVisible();
    await contextInput.fill("This is a Testing context.");

    // Additional Notes
    await expect(addGlossaryDialog.getByText("Additional Notes", { exact: true })).toBeVisible();

    await expect(additionalNotesInput).toBeVisible();
    await additionalNotesInput.fill("This is Additional Notes");

    // Add glossary
    await expect(addButton).toBeVisible();
    await addButton.click();

    // Verify success
    await expect(successMessage).toBeVisible({ timeout: 20000 });
  });
});
