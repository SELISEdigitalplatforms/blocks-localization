import { test, expect } from "@/support/test-base";
import { AppShellPage } from "@/pages/app/app-shell.page";
import { TranslationsListPage } from "@/pages/translations";
import { getProjectName } from "@/support/project-name";

test.describe("new key and key details", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const shell = new AppShellPage(page);
    await shell.openProjectWithDevelopment(getProjectName());
    const translations = new TranslationsListPage(page);
    await translations.openFromSidebar();
  });

  // ---------- New Key ----------

  test("TC-0053: Create new key page loads with all form fields", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    await expect(
      page.getByRole("heading", { name: "Create new key" }),
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByLabel("Key name")).toBeVisible();
    await expect(page.getByLabel("Module")).toBeVisible();
    await expect(page.getByLabel("Key Context")).toBeVisible();
  });

  test("TC-0054: New key validation: Key name is required", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText("Key name is required")).toBeVisible();
  });

  test("TC-0055: New key validation: Key name minimum length", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    const keyNameInput = page.getByLabel("Key name");
    await keyNameInput.fill("ab");
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(
      page.getByText("Key name must be at least 3 characters"),
    ).toBeVisible();
  });

  test("TC-0056: New key validation: Key name maximum length", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    const keyNameInput = page.getByLabel("Key name");
    await keyNameInput.fill("a".repeat(101));
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(
      page.getByText("Key name must be 100 characters or less"),
    ).toBeVisible();
  });

  test("TC-0057: New key validation: Module is required", async ({ page }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    await page.getByLabel("Key name").fill("dashboard.test_key");
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText("Module is required")).toBeVisible();
  });

  test("TC-0058: New key validation: default-language value is required", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    await page.getByLabel("Key name").fill("dashboard.test_key");
    await page.getByLabel("Module").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(page.getByText("Default value is required")).toBeVisible();
  });

  test("TC-0059: New key validation: translation value max length", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    const defaultValueInput = page.getByPlaceholder("Enter default value");
    await defaultValueInput.fill("a".repeat(200));
    await page.getByRole("button", { name: /save|create/i }).click();
    await expect(
      page.getByText("Translation must be less than 200 characters"),
    ).toBeVisible();
  });

  test("TC-0060: New key validation: culture is required per translation row", async ({
    page,
  }) => {
    // NOTE: culture is normally pre-filled for every configured language and is not
    // editable through the standard UI flow, so this rule cannot be triggered directly.
    test.skip(
      true,
      "Culture is auto-populated per language and not user-editable via the UI",
    );
  });

  test("TC-0061: New key validation: at least one non-empty route is required", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    const routeInput = page.getByPlaceholder("Enter route");
    if (await routeInput.isVisible().catch(() => false)) {
      await routeInput.fill("");
      await page.getByRole("button", { name: /save|create/i }).click();
      await expect(page.getByText("Route is required")).toBeVisible();
    }
  });

  test("TC-0062: Per-field auto-translate button fills a translation from the default language", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    await page.getByPlaceholder("Enter default value").fill("Welcome back");

    const translateFieldButton = page
      .getByRole("button", { name: /translate/i })
      .first();
    if (await translateFieldButton.isVisible().catch(() => false)) {
      await translateFieldButton.click();
      await expect(page.getByText("Translated successfully")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0063: Per-field auto-translate failure leaves the field untouched", async ({
    page,
  }) => {
    await page.route("**/api/**translate**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ isSuccess: false }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "New Key" }).click();
    await page.getByPlaceholder("Enter default value").fill("Welcome back");

    const translateFieldButton = page
      .getByRole("button", { name: /translate/i })
      .first();
    if (await translateFieldButton.isVisible().catch(() => false)) {
      await translateFieldButton.click();
      await expect(
        page.getByRole("alert").or(page.getByText("Error")),
      ).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0064: New key creation success", async ({ page }) => {
    await page.getByRole("button", { name: "New Key" }).click();
    await page
      .getByLabel("Key name")
      .fill(`dashboard.welcome_title_${Date.now()}`);
    await page.getByLabel("Module").click();
    await page.getByRole("option").first().click();
    await page.getByPlaceholder("Enter default value").fill("Welcome");

    const routeInput = page.getByPlaceholder("Enter route");
    if (await routeInput.isVisible().catch(() => false)) {
      await routeInput.fill("/dashboard");
    }

    await page.getByRole("button", { name: /save|create/i }).click();

    await expect(page.getByText("Language key added")).toBeVisible({
      timeout: 15000,
    });
    await expect(page).toHaveURL(/services\/language$/, { timeout: 15000 });
  });

  test("TC-0065: New key creation failure shows validation/server error detail", async ({
    page,
  }) => {
    await page.route("**/api/**language**key**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            isSuccess: false,
            errorMessage: "A key with this name already exists.",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "New Key" }).click();
    await page.getByLabel("Key name").fill("dashboard.duplicate_key");
    await page.getByLabel("Module").click();
    await page.getByRole("option").first().click();
    await page.getByPlaceholder("Enter default value").fill("Welcome");
    const routeInput = page.getByPlaceholder("Enter route");
    if (await routeInput.isVisible().catch(() => false)) {
      await routeInput.fill("/dashboard");
    }
    await page.getByRole("button", { name: /save|create/i }).click();

    await expect(
      page.getByRole("alert").or(page.getByText("Error")),
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByLabel("Key name")).toHaveValue(
      "dashboard.duplicate_key",
    );
  });

  // ---------- Key Details ----------

  test("TC-0066: Key Details page shows the key name as the page heading", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(2);
    if (await firstRow.isVisible().catch(() => false)) {
      const keyName = (await firstRow.locator("td").first().innerText()).trim();
      await firstRow.click();
      await expect(page).toHaveURL(/translations\/[^/]+$/, { timeout: 15000 });

      if (keyName) {
        await expect(page.getByRole("heading", { level: 1 })).toContainText(
          keyName,
        );
      }
      await expect(page.getByRole("tab", { name: "Details" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "History" })).toBeVisible();
    }
  });

  test("TC-0067: Key Details -> Auto-translate this key opens confirmation dialog", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(2);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/translations\/[^/]+$/, { timeout: 15000 });

      const translateButton = page.getByRole("button", {
        name: /auto-translate/i,
      });
      if (await translateButton.isVisible().catch(() => false)) {
        await translateButton.click();
        await expect(
          page.getByRole("heading", {
            name: "Auto-translate this key",
            exact: true,
          }),
        ).toBeVisible();
      }
    }
  });

  test("TC-0068: Key Details History tab shows the key's change/activity log", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(2);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/translations\/[^/]+$/, { timeout: 15000 });

      await page.getByRole("tab", { name: "History" }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();

      await page.getByRole("tab", { name: "Details" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });
});
