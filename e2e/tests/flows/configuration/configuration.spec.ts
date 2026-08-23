import { test, expect } from "../../../support/test-base";
import { openProjectDashboard } from "../../../support/flow-helpers";

test.describe("Configuration", () => {
  test.beforeEach(async ({ page }) => {
    await openProjectDashboard(page);
  });

  test("Configuration Page", async ({ page }) => {
    await page.getByRole("link", { name: "Configuration" }).click();
    await expect(page.getByRole("heading", { name: "Configure Languages" })).toBeVisible();
    const newLanguageButton = page.getByRole("button", {
      name: "New Language",
    });

    await test.step("Add a new language (Arabic)", async () => {
      await expect(newLanguageButton).toBeVisible();
      await newLanguageButton.click();

      await expect(page.getByRole("heading", { name: "New Language" })).toBeVisible();

      await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

      await expect(page.getByText("Language *")).toBeVisible();

      await page.getByRole("button", { name: "Language *" }).click();

      await page.getByPlaceholder("Search language...").fill("arabic");

      await page.getByRole("option", { name: "Arabic" }).click();

      await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();

      await page.getByRole("button", { name: "Save" }).click();

      // exact: true because a live-region echo of the same toast text ("Notification
      // SuccessLanguage added successfully.") also matches the non-exact query.
      const successMessage = page.getByText("Language added successfully.", { exact: true });

      const duplicateMessage = page.getByText(
        "Language is already added. You can't add this language.",
        { exact: true },
      );

      await expect
        .poll(
          async () => {
            if (await successMessage.isVisible()) {
              return "success";
            }

            if (await duplicateMessage.isVisible()) {
              await page.getByRole("button", { name: "Close" }).click();
              return "duplicate";
            }

            return null;
          },
          {
            timeout: 10000,
            intervals: [200, 500, 1000],
          },
        )
        .not.toBeNull();
    });

    const arabicRow = page.getByRole("row").filter({
      hasText: "Arabic",
    });

    const menuButton = arabicRow.getByRole("button").filter({
      has: page.locator("svg.lucide-ellipsis-vertical"),
    });

    await test.step("Languages section lists the new language", async () => {
      await expect(page.getByRole("heading", { name: "Languages", exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("Language", { exact: true })).toBeVisible();
      await expect(page.getByText("Language Code")).toBeVisible();
      await expect(page.getByText("Actions")).toBeVisible();
    });

    await test.step("Make Arabic the default language", async () => {
      await expect(menuButton).toBeVisible();

      await menuButton.click();

      await page.getByText("Make default language", { exact: true }).click();

      await expect(page.getByRole("heading", { name: "Make default language" })).toBeVisible();

      await page.getByRole("button", { name: "Save" }).click();

      // Default Language shows a default badge
      await expect(page.getByText("Default", { exact: true })).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Delete the language", async () => {
      // Open the same Arabic row menu again
      await expect(menuButton).toBeVisible();

      await menuButton.click();

      await page.getByText("Delete language", { exact: true }).click();

      await expect(page.getByRole("heading", { name: "Delete language" })).toBeVisible();

      await expect(page.getByText(/Are you sure you want to/)).toBeVisible();

      await page.getByRole("button", { name: "Delete" }).click();

      await expect(page.getByText("Language deleted successfully.", { exact: true })).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Webhooks section is visible", async () => {
      await expect(page.getByRole("heading", { name: "Webhooks" })).toBeVisible();
      await expect(page.getByText("URL *")).toBeVisible();
      await expect(page.getByText("Content Type *")).toBeVisible();
      await expect(page.getByText("Secret Header Key *")).toBeVisible();
      await expect(page.getByText("Secret *")).toBeVisible();
      await expect(page.getByText("Disable webhook")).toBeVisible();
    });

    await test.step("Required field validation", async () => {
      await page.getByRole("textbox", { name: "URL *" }).fill("");
      await page.keyboard.press("Tab");

      await page.getByRole("textbox", { name: "Content Type *" }).fill("");
      await page.keyboard.press("Tab");

      await page.getByRole("textbox", { name: "Secret Header Key *" }).fill("");
      await page.keyboard.press("Tab");

      await page.getByRole("textbox", { name: "Secret *" }).fill("");
      await page.keyboard.press("Tab");
      await page.getByRole("button", { name: "Save Webhook" }).click();

      // Verify validation messages. These briefly render a generic "Required"
      // before settling on the field-specific text below; Playwright's
      // auto-retrying getByText already waits out that transition.
      await expect(page.getByText("URL is required", { exact: true })).toBeVisible();

      await expect(page.getByText("Header key is required", { exact: true })).toBeVisible();

      await expect(page.getByText("Content type is required", { exact: true })).toBeVisible();

      await expect(page.getByText("Secret is required", { exact: true })).toBeVisible();
    });

    await test.step("Invalid URL shows a validation message", async () => {
      await page.getByRole("textbox", { name: "URL *" }).click();
      await page.getByRole("textbox", { name: "URL *" }).fill("abcdef");
      await expect(
        page.getByText("Enter a valid URL starting with http:// or https://"),
      ).toBeVisible();
    });

    await test.step("Webhook creates successfully with valid data", async () => {
      await page.getByRole("textbox", { name: "URL *" }).click();
      await page.getByRole("textbox", { name: "URL *" }).fill("https://example.com");
      await page.getByRole("textbox", { name: "Content Type *" }).fill("Application/JSON");
      await page.getByRole("textbox", { name: "Secret Header Key *" }).click();
      await page.getByRole("textbox", { name: "Secret Header Key *" }).fill("secretheadrkey");
      await page.getByRole("textbox", { name: "Secret *" }).click();
      await page.getByRole("textbox", { name: "Secret *" }).fill(`secret-${Date.now()}`);
      await page.getByRole("button", { name: "Save Webhook" }).click();
      await expect(page.getByText("Webhook saved successfully.", { exact: true })).toBeVisible({
        timeout: 15000,
      });
    });
  });
});
