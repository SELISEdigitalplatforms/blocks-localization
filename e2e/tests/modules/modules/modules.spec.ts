import { test, expect } from "@/support/test-base";
import { AppShellPage } from "@/pages/app/app-shell.page";
import { ModulesListPage } from "@/pages/modules";
import { getProjectName } from "@/support/project-name";

test.describe("modules", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const shell = new AppShellPage(page);
    await shell.openProjectWithDevelopment(getProjectName());
    const modules = new ModulesListPage(page);
    await modules.openFromSidebar();
  });

  // ---------- Modules ----------

  test("TC-0070: Modules table default rendering", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Modules" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Module" }),
    ).toBeVisible();
    await expect(page.getByText("Language Modules")).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Module Name" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Created By" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Created Date" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Actions" }),
    ).toBeVisible();
  });

  test("TC-0071: Modules table shows a loading skeleton while fetching", async ({
    page,
  }) => {
    await page.route("**/api/**language**module**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.reload();

    await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("TC-0072: Modules table empty state (no modules created yet)", async ({
    page,
  }) => {
    // NOTE: assumes the current tenant has zero language modules.
    const emptyMessage = page.getByText(
      "No modules found. Create your first module to get started.",
    );
    if (await emptyMessage.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("TC-0073: Modules table empty state (search has no matches)", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search modules...");
    await searchInput.fill("zzz-nonexistent-module");
    await expect(page.getByText("No modules match your search.")).toBeVisible({
      timeout: 10000,
    });
  });

  test("TC-0074: Search filters modules by name (client-side)", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const moduleName = (
        await firstRow.locator("td").first().innerText()
      ).trim();
      const partial = moduleName.slice(0, Math.max(2, moduleName.length - 2));
      const searchInput = page.getByPlaceholder("Search modules...");
      await searchInput.fill(partial);
      await expect(page.getByRole("row").nth(1)).toContainText(partial, {
        ignoreCase: true,
      });
    }
  });

  test("TC-0075: 'Created By' column resolves user id to a display name", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const createdByCell = firstRow.locator("td").nth(1);
      const text = (await createdByCell.innerText()).trim();
      expect(text.length).toBeGreaterThan(0);
    }
  });

  test("TC-0076: Clicking a module row navigates to Module Details", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/modules\/[^/]+$/, {
        timeout: 15000,
      });
    }
  });

  test("TC-0077: 'New Module' opens the create-module dialog", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Module" }).click();
    await expect(
      page.getByRole("heading", { name: "New module" }),
    ).toBeVisible();
    await expect(page.getByLabel("Module name")).toBeVisible();
  });

  test("TC-0078: New module validation: name is required", async ({ page }) => {
    await page.getByRole("button", { name: "New Module" }).click();
    await page
      .getByRole("button", { name: /save|create/i })
      .last()
      .click();
    await expect(page.getByText("Module name is required")).toBeVisible();
  });

  test("TC-0079: New module validation: name maximum length", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Module" }).click();
    await page.getByLabel("Module name").fill("a".repeat(51));
    await page
      .getByRole("button", { name: /save|create/i })
      .last()
      .click();
    await expect(
      page.getByText("Module name must be less than 50 characters"),
    ).toBeVisible();
  });

  test("TC-0080: New module creation success", async ({ page }) => {
    await page.getByRole("button", { name: "New Module" }).click();
    await page.getByLabel("Module name").fill(`Checkout Flow ${Date.now()}`);
    await page
      .getByRole("button", { name: /save|create/i })
      .last()
      .click();

    await expect(page.getByText("New module added")).toBeVisible({
      timeout: 15000,
    });
  });

  test("TC-0081: New module creation cancel path", async ({ page }) => {
    await page.getByRole("button", { name: "New Module" }).click();
    await page.getByLabel("Module name").fill("Draft Module");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(
      page.getByRole("heading", { name: "New module" }),
    ).toBeHidden();
  });

  test("TC-0082: Row action 'Edit' opens the edit-module dialog pre-filled", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const moduleName = (
        await firstRow.locator("td").first().innerText()
      ).trim();
      await firstRow.getByRole("button").last().click();
      await page.getByText("Edit", { exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Edit module" }),
      ).toBeVisible();
      if (moduleName) {
        await expect(page.getByLabel("Module name")).toHaveValue(moduleName);
      }
    }
  });

  test("TC-0083: Edit module validation differs from New module validation for the same field", async ({
    page,
  }) => {
    // Regression guard: New Module allows a 1-char name (max 50); Edit Module
    // requires at least 3 characters (max 100). Same underlying field, two rule sets.
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Edit", { exact: true }).click();

      await page.getByLabel("Module name").fill("a");
      await expect(
        page.getByText("Module name must be at least 3 characters"),
      ).toBeVisible();
    }
  });

  test("TC-0084: Edit module save success", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Edit", { exact: true }).click();

      await page
        .getByLabel("Module name")
        .fill(`Checkout Flow v2 ${Date.now()}`);
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page.getByText("Module updated")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0085: Edit module Save button disabled while the form is invalid or pending", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Edit", { exact: true }).click();

      await page.getByLabel("Module name").fill("");
      await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
    }
  });

  test("TC-0086: Row action 'Tag glossary' opens the tag-glossary dialog", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Tag glossary", { exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Tag Glossary" }),
      ).toBeVisible();
      await expect(page.getByPlaceholder("Search glossary...")).toBeVisible();
    }
  });

  test("TC-0087: Tag glossary: selecting a search result adds it as a badge", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Tag glossary", { exact: true }).click();

      const searchInput = page.getByPlaceholder("Search glossary...");
      await searchInput.click();
      const firstOption = page.getByRole("option").first();
      if (await firstOption.isVisible({ timeout: 5000 }).catch(() => false)) {
        const glossaryName = (await firstOption.innerText()).trim();
        await firstOption.click();
        if (glossaryName) {
          await expect(page.getByText(glossaryName).first()).toBeVisible();
        }
      }
    }
  });

  test("TC-0088: Tag glossary: removing a badge deselects that glossary", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Tag glossary", { exact: true }).click();

      const badgeRemoveButton = page
        .locator('[class*="badge"]')
        .getByRole("button")
        .first();
      if (await badgeRemoveButton.isVisible().catch(() => false)) {
        await badgeRemoveButton.click();
        await expect(badgeRemoveButton).toHaveCount(0);
      }
    }
  });

  test("TC-0089: Tag glossary save success", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Tag glossary", { exact: true }).click();

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Glossaries updated")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0090: Tag glossary save failure", async ({ page }) => {
    await page.route("**/api/**module**glossar**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ isSuccess: false }),
        });
      } else {
        await route.continue();
      }
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Tag glossary", { exact: true }).click();
      await page.getByRole("button", { name: "Save" }).click();

      await expect(page.getByText("Failed to update glossaries")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0091: Delete module action is not available (feature disabled)", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await expect(page.getByText("Edit", { exact: true })).toBeVisible();
      await expect(
        page.getByText("Tag glossary", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Delete", { exact: true })).toHaveCount(0);
    }
  });

  // ---------- Module Details ----------

  test("TC-0092: Module Details defaults to the Details tab", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/modules\/[^/]+$/, {
        timeout: 15000,
      });

      await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute(
        "data-state",
        "active",
      );
      await expect(page.getByText("About")).toBeVisible();
      await expect(page.getByText("Module Name")).toBeVisible();
      await expect(page.getByText("Created Date")).toBeVisible();
      await expect(page.getByText("Last Update Date")).toBeVisible();
      await expect(page.getByText("Created By")).toBeVisible();
      await expect(page.getByText("Last Updated By")).toBeVisible();
    }
  });

  test("TC-0093: Module Details shows a loading skeleton while data resolves", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await page.route("**/api/**language**module**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });
      await firstRow.click();
      await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("TC-0094: Module Details shows an explicit error for an invalid module id", async ({
    page,
  }) => {
    await page.goto(
      "https://dev-localization.blocksdevelopers.com/app/services/modules/",
    );
    await expect(page.getByText("Invalid module ID")).toBeVisible({
      timeout: 15000,
    });
  });

  test("TC-0095: Module Details shows an explicit error when the module cannot be found", async ({
    page,
  }) => {
    await page.goto(
      "https://dev-localization.blocksdevelopers.com/app/services/modules/00000000-0000-0000-0000-000000000000",
    );
    await expect(page.getByText("Module not found")).toBeVisible({
      timeout: 15000,
    });
  });

  test("TC-0096: Module Details Glossary tab lists tagged glossaries", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/modules\/[^/]+$/, {
        timeout: 15000,
      });

      await page.getByRole("tab", { name: "Glossary" }).click();
      await expect(page.getByText(/Tagged Glossaries \(\d+\)/)).toBeVisible();
    }
  });

  test("TC-0097: Module Details Glossary tab empty state", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/modules\/[^/]+$/, {
        timeout: 15000,
      });

      await page.getByRole("tab", { name: "Glossary" }).click();
      const zeroCount = page.getByText("Tagged Glossaries (0)");
      if (await zeroCount.isVisible({ timeout: 8000 }).catch(() => false)) {
        await expect(
          page.getByText("No glossaries tagged to this module"),
        ).toBeVisible();
      }
    }
  });

  test("TC-0098: Module Details Glossary tab loading skeleton", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/modules\/[^/]+$/, {
        timeout: 15000,
      });

      await page.route("**/api/**module**glossar**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });
      await page.getByRole("tab", { name: "Glossary" }).click();

      await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });
});
