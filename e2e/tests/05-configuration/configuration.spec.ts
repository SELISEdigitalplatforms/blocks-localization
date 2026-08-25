import { test, expect } from "../../support/test-base";
import { openConfiguration } from "../../support/localization-helpers";

test.describe("Configuration", () => {
  test.beforeEach(async ({ page }) => {
    await openConfiguration(page);
  });

  test("Configuration Page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Configure Languages" })).toBeVisible();
    const newLanguageButton = page.getByRole("button", {
      name: "New Language",
    });

    await test.step("Add a new language (Arabic)", async () => {
      await expect(newLanguageButton).toBeVisible();
      await newLanguageButton.click();

      await expect(page.getByRole("heading", { name: "New Language" })).toBeVisible();

      const languageButton = page
        .getByRole("button", { name: "Language" })
        .or(page.getByRole("button", { name: "Language *" }))
        .first();
      await expect(languageButton).toBeVisible();
      await languageButton.click();

      await page.getByPlaceholder("Search language...").fill("arabic");

      await page.getByRole("option", { name: "Arabic" }).click();

      await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();

      await page.getByRole("button", { name: "Save" }).click();

      const arabicRow = page.getByRole("row").filter({
        hasText: "Arabic",
      });

      // exact: true because a live-region echo of the same toast text ("Notification
      // SuccessLanguage added successfully.") also matches the non-exact query.
      const successMessage = page
        .getByText("Language added successfully.", { exact: true })
        .or(page.getByText(/language.*added successfully/i));

      const duplicateMessage = page.getByText(
        /Language is already added|already added.*language/i,
      );

      await expect
        .poll(
          async () => {
            if (await successMessage.isVisible().catch(() => false)) {
              return "success";
            }

            if (await duplicateMessage.isVisible().catch(() => false)) {
              await page.getByRole("button", { name: "Close" }).click();
              return "duplicate";
            }

            if (await arabicRow.isVisible().catch(() => false)) {
              return "row";
            }

            return null;
          },
          {
            timeout: 20_000,
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
      await expect(page.getByRole("columnheader", { name: "Language", exact: true })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Language Code", exact: true })).toBeVisible();
      await expect(arabicRow).toBeVisible();
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

      await expect
        .poll(
          async () => {
            if (
              await page
                .getByText(/language.*deleted successfully/i)
                .isVisible()
                .catch(() => false)
            ) {
              return "toast";
            }
            if (!(await arabicRow.isVisible().catch(() => false))) {
              return "removed";
            }
            return null;
          },
          { timeout: 15_000, intervals: [200, 500, 1000] },
        )
        .not.toBeNull();
    });

    await test.step("Webhooks section is visible", async () => {
      const webhooksHeading = page.getByRole("heading", { name: "Webhooks" });
      await webhooksHeading.scrollIntoViewIfNeeded();
      await expect(webhooksHeading).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("textbox", { name: "URL" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Content Type" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Secret Header Key" })).toBeVisible();
      await expect(page.getByRole("textbox", { name: "Secret", exact: true })).toBeVisible();
      await expect(page.getByText("Disable webhook")).toBeVisible();
    });

    await test.step("Required field validation", async () => {
      await page.getByRole("textbox", { name: "URL" }).fill("");
      await page.keyboard.press("Tab");

      await page.getByRole("textbox", { name: "Content Type" }).fill("");
      await page.keyboard.press("Tab");

      await page.getByRole("textbox", { name: "Secret Header Key" }).fill("");
      await page.keyboard.press("Tab");

      await page.getByRole("textbox", { name: "Secret", exact: true }).fill("");
      await page.keyboard.press("Tab");
      await page.getByRole("button", { name: "Save Webhook" }).click();

      await expect(page.getByRole("textbox", { name: "URL" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByRole("textbox", { name: "Content Type" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByRole("textbox", { name: "Secret Header Key" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByRole("textbox", { name: "Secret", exact: true })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      await expect(page.getByRole("button", { name: "Save Webhook" })).toBeEnabled();
    });

    await test.step("Invalid URL shows a validation message", async () => {
      await page.getByRole("textbox", { name: "URL" }).click();
      await page.getByRole("textbox", { name: "URL" }).fill("abcdef");
      await expect(
        page
          .getByText("Enter a valid URL starting with http:// or https://")
          .or(page.getByText("Must be a valid URL")),
      ).toBeVisible();
    });

    await test.step("Webhook creates successfully with valid data", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Configure Languages" })).toBeVisible();
      await page.getByRole("heading", { name: "Webhooks" }).scrollIntoViewIfNeeded();

      const stamp = Date.now();
      await page.getByRole("textbox", { name: "URL" }).fill(`https://example.com/webhook-${stamp}`);
      await page.getByRole("textbox", { name: "Content Type" }).fill("application/json");
      await page.getByRole("textbox", { name: "Secret Header Key" }).fill("X-Webhook-Secret");
      await page
        .getByRole("textbox", { name: "Secret", exact: true })
        .fill(`secret-${stamp}`);

      const saveButton = page.getByRole("button", { name: "Save Webhook" });
      await expect(saveButton).toBeEnabled({ timeout: 15_000 });

      const saveResponsePromise = page.waitForResponse(
        (response) =>
          response.request().method() === "POST" && response.url().includes("SaveWebHook"),
        { timeout: 20_000 },
      );
      await saveButton.click();
      const saveResponse = await saveResponsePromise;
      expect(saveResponse.ok()).toBeTruthy();
      await expect(saveResponse.json()).resolves.toMatchObject({ success: true });
    });
  });
});
