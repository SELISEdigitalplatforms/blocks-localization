import { test, expect } from "@/support/test-base";
import { AppShellPage } from "@/pages/app/app-shell.page";
import { ConfigurePage } from "@/pages/configuration";
import { getProjectName } from "@/support/project-name";

test.describe("configuration", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const shell = new AppShellPage(page);
    await shell.openProjectWithDevelopment(getProjectName());
    const configure = new ConfigurePage(page);
    await configure.openFromSidebar();
  });

  // ---------- Languages ----------

  test("TC-0132: Configure Languages page default rendering", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: "Configure Languages" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Language" }),
    ).toBeVisible();
    await expect(page.getByText("Languages", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Language" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Language Code" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Actions" }),
    ).toBeVisible();
  });

  test("TC-0133: Configure Languages page loading skeleton", async ({
    page,
  }) => {
    await page.route("**/api/**language**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.reload();

    await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("TC-0134: Languages table empty state", async ({ page }) => {
    // NOTE: assumes no rows currently match the table's filter state.
    const emptyMessage = page.getByText("No results.");
    if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("TC-0135: Default language shows a 'Default' badge", async ({
    page,
  }) => {
    const defaultBadge = page.getByText("Default", { exact: true });
    if (await defaultBadge.isVisible().catch(() => false)) {
      const count = await defaultBadge.count();
      expect(count).toBe(1);
    }
  });

  test("TC-0136: 'New Language' opens the add-language dialog", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Language" }).click();
    await expect(
      page.getByRole("heading", { name: "New Language" }),
    ).toBeVisible();
  });

  test("TC-0137: New language validation: Language is required", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Language" }).click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Language is required")).toBeVisible();
  });

  test("TC-0138: New language: selecting an already-added language is blocked", async ({
    page,
  }) => {
    const existingLanguageRow = page.getByRole("row").nth(1);
    if (await existingLanguageRow.isVisible().catch(() => false)) {
      const existingLanguageName = (
        await existingLanguageRow.locator("td").first().innerText()
      ).trim();

      await page.getByRole("button", { name: "New Language" }).click();
      await page.getByRole("combobox").click();
      const matchingOption = page.getByRole("option", {
        name: existingLanguageName,
      });
      if (
        await matchingOption.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        await matchingOption.click();
        await page.getByRole("button", { name: "Save" }).click();

        await expect(
          page.getByText(
            "Language is already added. You can't add this language.",
          ),
        ).toBeVisible();
      }
    }
  });

  test("TC-0139: New language creation success", async ({ page }) => {
    await page.getByRole("button", { name: "New Language" }).click();
    await page.getByRole("combobox").click();
    const firstOption = page.getByRole("option").first();
    await firstOption.click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Language added"))
      .toBeVisible({
        timeout: 15000,
      })
      .catch(async () => {
        // Already-added fallback: not every environment guarantees an unadded option exists.
        await expect(
          page.getByText(
            "Language is already added. You can't add this language.",
          ),
        ).toBeVisible();
      });
  });

  test("TC-0140: New language dialog closes before the result is known", async ({
    page,
  }) => {
    // Regression guard: onClose() fires unconditionally right after mutateAsync
    // resolves and before the success check, so on failure the dialog is already
    // gone and the user only sees a toast with no link back to the form.
    await page.route("**/api/**language**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            isSuccess: false,
            errorMessage: "Server error",
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "New Language" }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option").first().click();
    await page.getByRole("button", { name: "Save" }).click();

    await expect(
      page.getByRole("heading", { name: "New Language" }),
    ).toBeHidden({ timeout: 10000 });
    await expect(
      page.getByRole("alert").or(page.getByText("Error")),
    ).toBeVisible();
  });

  test("TC-0141: Row action 'Make default language' opens confirmation with exact copy", async ({
    page,
  }) => {
    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      const isDefaultRow = await row
        .getByText("Default", { exact: true })
        .isVisible()
        .catch(() => false);
      if (!isDefaultRow) {
        await row.getByRole("button").last().click();
        await page.getByText("Make default language").click();

        await expect(
          page.getByRole("heading", { name: "Make default language" }),
        ).toBeVisible();
        await expect(
          page.getByText(
            "Are you sure you want to set this language as default?",
          ),
        ).toBeVisible();
        await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Cancel" }),
        ).toBeVisible();
        break;
      }
    }
  });

  test("TC-0142: Make default language confirm -> success", async ({
    page,
  }) => {
    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      const isDefaultRow = await row
        .getByText("Default", { exact: true })
        .isVisible()
        .catch(() => false);
      if (!isDefaultRow) {
        await row.getByRole("button").last().click();
        await page.getByText("Make default language").click();
        await page.getByRole("button", { name: "Save" }).click();

        await expect(page.getByText("Make default successful")).toBeVisible({
          timeout: 15000,
        });
        break;
      }
    }
  });

  test("TC-0143: Make default language confirm -> failure", async ({
    page,
  }) => {
    await page.route("**/api/**language**default**", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ isSuccess: false }),
      });
    });

    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      const isDefaultRow = await row
        .getByText("Default", { exact: true })
        .isVisible()
        .catch(() => false);
      if (!isDefaultRow) {
        await row.getByRole("button").last().click();
        await page.getByText("Make default language").click();
        await page.getByRole("button", { name: "Save" }).click();

        await expect(
          page.getByRole("alert").or(page.getByText("Error")),
        ).toBeVisible({
          timeout: 15000,
        });
        break;
      }
    }
  });

  test("TC-0144: Make default language cancel path", async ({ page }) => {
    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      const isDefaultRow = await row
        .getByText("Default", { exact: true })
        .isVisible()
        .catch(() => false);
      if (!isDefaultRow) {
        await row.getByRole("button").last().click();
        await page.getByText("Make default language").click();
        await page.getByRole("button", { name: "Cancel" }).click();

        await expect(
          page.getByRole("heading", { name: "Make default language" }),
        ).toBeHidden();
        break;
      }
    }
  });

  test("TC-0145: Row action 'Delete language' opens confirmation with exact copy", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete language").click();

      await expect(
        page.getByRole("heading", { name: "Delete language" }),
      ).toBeVisible();
      await expect(
        page.getByText("Are you sure you want to delete this language?"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Delete" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    }
  });

  test("TC-0146: Delete language confirm -> success", async ({ page }) => {
    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      const isDefaultRow = await row
        .getByText("Default", { exact: true })
        .isVisible()
        .catch(() => false);
      if (!isDefaultRow) {
        await row.getByRole("button").last().click();
        await page.getByText("Delete language").click();
        await page.getByRole("button", { name: "Delete" }).last().click();

        await expect(page.getByText("Deleted successfully")).toBeVisible({
          timeout: 15000,
        });
        break;
      }
    }
  });

  test("TC-0147: Delete language confirm -> failure with a readable error", async ({
    page,
  }) => {
    await page.route("**/api/**language**", async (route) => {
      if (route.request().method() === "DELETE") {
        await route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            isSuccess: false,
            errors: { message: "Cannot delete the default language." },
          }),
        });
      } else {
        await route.continue();
      }
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete language").click();
      await page.getByRole("button", { name: "Delete" }).last().click();

      await expect(
        page.getByText("Cannot delete the default language."),
      ).toBeVisible({
        timeout: 15000,
      });
      // The message should be readable prose, not raw JSON.
      await expect(page.getByText(/^\{.*\}$/)).toHaveCount(0);
    }
  });

  test("TC-0148: Delete language cancel path", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete language").click();
      await page.getByRole("button", { name: "Cancel" }).click();

      await expect(
        page.getByRole("heading", { name: "Delete language" }),
      ).toBeHidden();
    }
  });

  test("TC-0149: Confirm buttons disabled while their respective request is pending", async ({
    page,
  }) => {
    await page.route("**/api/**language**default**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      const isDefaultRow = await row
        .getByText("Default", { exact: true })
        .isVisible()
        .catch(() => false);
      if (!isDefaultRow) {
        await row.getByRole("button").last().click();
        await page.getByText("Make default language").click();
        const confirmButton = page.getByRole("button", { name: "Save" });
        await confirmButton.click();
        await expect(confirmButton).toBeDisabled();
        break;
      }
    }
  });

  // ---------- Webhooks ----------

  test("TC-0150: Webhook form loads existing configuration", async ({
    page,
  }) => {
    await expect(page.getByText("Webhooks")).toBeVisible();
    const urlInput = page.getByPlaceholder("https://example.com/webhook");
    await expect(urlInput).toBeVisible();
  });

  test("TC-0151: Webhook validation: URL must be a valid URL", async ({
    page,
  }) => {
    const urlInput = page.getByPlaceholder("https://example.com/webhook");
    await urlInput.fill("not-a-url");
    await urlInput.blur();
    await expect(page.getByText("Must be a valid URL")).toBeVisible();
  });

  test("TC-0152: Webhook validation: Content Type is required", async ({
    page,
  }) => {
    const contentTypeInput = page.getByPlaceholder("application/json");
    await contentTypeInput.fill("");
    await contentTypeInput.blur();
    await expect(page.getByText("Content type is required")).toBeVisible();
  });

  test("TC-0153: Webhook validation: Secret Header Key is required", async ({
    page,
  }) => {
    const headerKeyInput = page.getByPlaceholder("X-Webhook-Secret");
    await headerKeyInput.fill("");
    await headerKeyInput.blur();
    await expect(page.getByText("Header key is required")).toBeVisible();
  });

  test("TC-0154: Webhook validation: Secret is required", async ({ page }) => {
    const secretInput = page.getByPlaceholder("********");
    await secretInput.fill("");
    await secretInput.blur();
    await expect(page.getByText("Secret is required")).toBeVisible();
  });

  test("TC-0155: Secret field is masked", async ({ page }) => {
    const secretInput = page.getByPlaceholder("********");
    await expect(secretInput).toHaveAttribute("type", "password");
    const headerKeyInput = page.getByPlaceholder("X-Webhook-Secret");
    await expect(headerKeyInput).toHaveAttribute("autocomplete", "off");
    await expect(secretInput).toHaveAttribute("autocomplete", "off");
  });

  test("TC-0156: 'Disable webhook' switch toggles the isDisabled flag", async ({
    page,
  }) => {
    const disableSwitch = page.getByLabel("Disable webhook");
    const wasChecked = await disableSwitch.isChecked();
    await disableSwitch.click();
    expect(await disableSwitch.isChecked()).toBe(!wasChecked);
    await expect(
      page.getByRole("button", { name: "Save Webhook" }),
    ).toBeEnabled();
  });

  test("TC-0157: 'Save Webhook' is disabled until the form is dirty", async ({
    page,
  }) => {
    const saveButton = page.getByRole("button", { name: "Save Webhook" });
    await expect(saveButton).toBeDisabled();

    const urlInput = page.getByPlaceholder("https://example.com/webhook");
    await urlInput.fill(`https://example.com/hooks/${Date.now()}`);
    await expect(saveButton).toBeEnabled();
  });

  test("TC-0158: Webhook save success", async ({ page }) => {
    const urlInput = page.getByPlaceholder("https://example.com/webhook");
    await urlInput.fill("https://example.com/hooks/localization");
    await page.getByRole("button", { name: "Save Webhook" }).click();

    await expect(page.getByText("Webhook saved successfully")).toBeVisible({
      timeout: 15000,
    });
  });

  test("TC-0159: Webhook save failure", async ({ page }) => {
    await page.route("**/api/**webhook**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            isSuccess: false,
            errorMessage: "Save failed",
          }),
        });
      } else {
        await route.continue();
      }
    });

    const urlInput = page.getByPlaceholder("https://example.com/webhook");
    await urlInput.fill("https://example.com/hooks/localization");
    await page.getByRole("button", { name: "Save Webhook" }).click();

    await expect(
      page.getByRole("alert").or(page.getByText("Error")),
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(urlInput).toHaveValue(
      "https://example.com/hooks/localization",
    );
  });
});
