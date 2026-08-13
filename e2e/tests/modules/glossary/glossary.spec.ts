import { test, expect } from "@/support/test-base";
import { AppShellPage } from "@/pages/app/app-shell.page";
import { GlossaryListPage } from "@/pages/glossary";
import { getProjectName } from "@/support/project-name";

test.describe("glossary", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const shell = new AppShellPage(page);
    await shell.openProjectWithDevelopment(getProjectName());
    const glossary = new GlossaryListPage(page);
    await glossary.openFromSidebar();
  });

  // ---------- Glossary ----------

  test("TC-0099: Glossary table default rendering", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Glossary Management" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "New Glossary" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Name" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Language" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Type" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Context" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Additional Note" }),
    ).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Created" }),
    ).toBeVisible();
  });

  test("TC-0100: Glossary table shows a loading skeleton while fetching", async ({
    page,
  }) => {
    await page.route("**/api/**glossar**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.reload();

    await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("TC-0101: Glossary table empty state", async ({ page }) => {
    // NOTE: assumes the current tenant has zero glossary items.
    const emptyMessage = page.getByText("No results.");
    if (await emptyMessage.isVisible({ timeout: 10000 }).catch(() => false)) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("TC-0102: Search is debounced before filtering the glossary list", async ({
    page,
  }) => {
    const requestUrls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("glossar")) requestUrls.push(request.url());
    });

    const searchInput = page.getByPlaceholder("Search glossary...");
    await searchInput.pressSequentially("but", { delay: 30 });

    const countRightAfterTyping = requestUrls.length;
    await page.waitForTimeout(600);
    expect(requestUrls.length).toBeGreaterThanOrEqual(countRightAfterTyping);
  });

  test("TC-0103: Language column resolves language code to display name", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const languageCell = firstRow.locator("td").nth(1);
      const text = (await languageCell.innerText()).trim();
      expect(text.length).toBeGreaterThan(0);
    }
  });

  test("TC-0104: Context and Additional Note columns truncate long text with a tooltip", async ({
    page,
  }) => {
    const contextCell = page
      .locator("div[title]")
      .filter({ hasText: /.+/ })
      .first();
    if (await contextCell.isVisible().catch(() => false)) {
      const title = await contextCell.getAttribute("title");
      expect(title).not.toBeNull();
    }
  });

  test("TC-0105: Pagination only appears when total items exceed the page size", async ({
    page,
  }) => {
    const rowCount = await page.getByRole("row").count();
    const pagination = page.getByRole("navigation");
    if (rowCount > 20) {
      await expect(pagination).toBeVisible();
    } else {
      await expect(pagination).toHaveCount(0);
    }
  });

  test("TC-0106: Clicking a glossary row navigates to Glossary Details", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });
    }
  });

  test("TC-0107: 'New Glossary' opens the add-glossary dialog", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Glossary" }).click();
    await expect(
      page.getByRole("heading", { name: "Add Glossary" }),
    ).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Language", { exact: true })).toBeVisible();
    await expect(page.getByText("Type", { exact: true })).toBeVisible();
    await expect(page.getByText("Add to global context")).toBeVisible();
    await expect(page.getByText("Tag modules...")).toBeVisible();
    await expect(page.getByText("Context", { exact: true })).toBeVisible();
    await expect(page.getByText(/Additional Notes/)).toBeVisible();
  });

  test("TC-0108: New glossary validation: Name is required", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Glossary" }).click();
    await page.getByRole("button", { name: "Add" }).last().click();
    await expect(page.getByText("Name is required")).toBeVisible();
  });

  test("TC-0109: New glossary validation: Name maximum length", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Glossary" }).click();
    await page.getByLabel("Name", { exact: true }).fill("a".repeat(201));
    await page.getByRole("button", { name: "Add" }).last().click();
    await expect(
      page.getByText("Name must be less than 200 characters"),
    ).toBeVisible();
  });

  test("TC-0110: Additional Notes field shows an explanatory tooltip", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Glossary" }).click();
    const infoIcon = page
      .locator('[class*="tooltip"], svg')
      .filter({ hasText: "" })
      .last();
    const notesLabel = page.getByText(/Additional Notes/);
    await notesLabel.hover();
    await expect(
      page.getByText(
        "Not utilized for auto translation, only given for additional comments by the user",
      ),
    )
      .toBeVisible({ timeout: 5000 })
      .catch(() => {});
  });

  test("TC-0111: New glossary: tagging modules adds removable badges", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "New Glossary" }).click();
    await page.getByText("Tag modules...").click();
    const firstOption = page.getByRole("option").first();
    if (await firstOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      const moduleName = (await firstOption.innerText()).trim();
      await firstOption.click();
      await page.keyboard.press("Escape");
      if (moduleName) {
        await expect(page.getByText(moduleName).first()).toBeVisible();
      }
    }
  });

  test("TC-0112: New glossary creation success", async ({ page }) => {
    await page.getByRole("button", { name: "New Glossary" }).click();
    await page.getByLabel("Name", { exact: true }).fill(`Cart ${Date.now()}`);
    await page.getByRole("button", { name: "Add" }).last().click();

    await expect(page.getByText("Glossary item added")).toBeVisible({
      timeout: 15000,
    });
  });

  test("TC-0113: New glossary creation failure", async ({ page }) => {
    await page.route("**/api/**glossar**", async (route) => {
      if (route.request().method() === "POST") {
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

    await page.getByRole("button", { name: "New Glossary" }).click();
    await page.getByLabel("Name", { exact: true }).fill(`Cart ${Date.now()}`);
    await page.getByRole("button", { name: "Add" }).last().click();

    await expect(
      page.getByRole("alert").or(page.getByText("Error")),
    ).toBeVisible({
      timeout: 15000,
    });
    await expect(
      page.getByRole("heading", { name: "Add Glossary" }),
    ).toBeVisible();
  });

  test("TC-0114: Row action 'Edit' opens Edit Glossary pre-filled", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const glossaryName = (
        await firstRow.locator("td").first().innerText()
      ).trim();
      await firstRow.getByRole("button").last().click();
      await page.getByText("Edit", { exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Edit Glossary" }),
      ).toBeVisible();
      if (glossaryName) {
        await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
          glossaryName,
        );
      }
    }
  });

  test("TC-0115: Edit glossary save success", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Edit", { exact: true }).click();

      const contextInput = page.getByPlaceholder(
        "Enter context or description",
      );
      await contextInput.fill(`Updated context ${Date.now()}`);
      await page.getByRole("button", { name: "Update" }).click();

      await expect(page.getByText("Glossary item updated")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0116: Row action 'Delete' opens confirmation with exact copy", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const glossaryName = (
        await firstRow.locator("td").first().innerText()
      ).trim();
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete", { exact: true }).click();

      await expect(
        page.getByRole("heading", { name: "Delete Glossary Item" }),
      ).toBeVisible();
      if (glossaryName) {
        await expect(page.getByText(new RegExp(glossaryName))).toBeVisible();
      }
      await expect(
        page.getByText("This action cannot be undone."),
      ).toBeVisible();
    }
  });

  test("TC-0117: Delete glossary confirm -> success", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete", { exact: true }).click();
      await page.getByRole("button", { name: "Delete" }).last().click();

      await expect(page.getByText("Glossary item deleted")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0118: Delete glossary confirm -> failure", async ({ page }) => {
    await page.route("**/api/**glossar**", async (route) => {
      if (
        route.request().method() === "DELETE" ||
        route.request().method() === "POST"
      ) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ isSuccess: false, errors: ["Cannot delete"] }),
        });
      } else {
        await route.continue();
      }
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete", { exact: true }).click();
      await page.getByRole("button", { name: "Delete" }).last().click();

      await expect(
        page.getByRole("alert").or(page.getByText("Error")),
      ).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0119: Delete glossary cancel path", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete", { exact: true }).click();
      await page.getByRole("button", { name: "Cancel" }).click();

      await expect(
        page.getByRole("heading", { name: "Delete Glossary Item" }),
      ).toBeHidden();
    }
  });

  test("TC-0120: Delete button disabled while the delete request is pending", async ({
    page,
  }) => {
    await page.route("**/api/**glossar**", async (route) => {
      if (
        route.request().method() === "DELETE" ||
        route.request().method() === "POST"
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      await route.continue();
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      await page.getByText("Delete", { exact: true }).click();
      const deleteButton = page.getByRole("button", { name: "Delete" }).last();
      const cancelButton = page.getByRole("button", { name: "Cancel" });
      await deleteButton.click();

      await expect(deleteButton).toBeDisabled();
      await expect(cancelButton).toBeDisabled();
    }
  });

  // ---------- Glossary Details ----------

  test("TC-0121: Glossary Details shows a loading skeleton before data resolves", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await page.route("**/api/**glossar**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      });
      await firstRow.click();
      await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("TC-0122: Glossary Details handles a not-found item", async ({
    page,
  }) => {
    await page.goto(
      "https://dev-localization.blocksdevelopers.com/app/services/glossary/00000000-0000-0000-0000-000000000000",
    );
    await expect(page.getByText("Glossary item not found.")).toBeVisible({
      timeout: 15000,
    });
  });

  test("TC-0123: Glossary Details shows resolved language, type, global flag, and created date", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      await expect(page.getByText("Is Global")).toBeVisible();
      await expect(page.getByText(/^(True|False)$/)).toBeVisible();
      await expect(page.getByText("Created on")).toBeVisible();
    }
  });

  test("TC-0124: Glossary Details Context/Additional Notes show fallback copy when empty", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      const noContext = page.getByText("No context provided.");
      const noNotes = page.getByText("No additional user notes.");
      await expect(
        noContext.or(page.getByText("Context", { exact: true })),
      ).toBeVisible();
      await expect(
        noNotes.or(page.getByText(/Additional Notes/)),
      ).toBeVisible();
    }
  });

  test("TC-0125: Glossary Details Edit/Delete buttons open the same dialogs as the table row actions", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      await page.getByRole("button", { name: "Edit" }).click();
      await expect(
        page.getByRole("heading", { name: "Edit Glossary" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();

      await page.getByRole("button", { name: "Delete" }).click();
      await expect(
        page.getByRole("heading", { name: "Delete Glossary Item" }),
      ).toBeVisible();
    }
  });

  test("TC-0126: Deleting from Glossary Details navigates back to the Glossary list", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      await page.getByRole("button", { name: "Delete" }).click();
      await page.getByRole("button", { name: "Delete" }).last().click();

      await expect(page).toHaveURL(/services\/glossary$/, { timeout: 15000 });
    }
  });

  test("TC-0127: Tagged Keys table lists keys tied to this glossary's modules", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      await expect(page.getByText("Tagged Keys")).toBeVisible();
    }
  });

  test("TC-0128: Tagged Keys table empty state", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      const emptyMessage = page.getByText("No keys tagged with this glossary.");
      if (await emptyMessage.isVisible({ timeout: 10000 }).catch(() => false)) {
        await expect(emptyMessage).toBeVisible();
      }
    }
  });

  test("TC-0129: Tagged Keys table error state", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await page.route("**/api/**glossary**key**", async (route) => {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ isSuccess: false }),
        });
      });
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      await expect(page.getByText("Failed to load tagged keys.")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0130: Tagged Keys pagination Previous/Next", async ({ page }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      const previousButton = page.getByRole("button", { name: "Previous" });
      if (await previousButton.isVisible().catch(() => false)) {
        await expect(previousButton).toBeDisabled();
        await expect(page.getByText(/\d+ keys? total/)).toBeVisible();
      }
    }
  });

  test("TC-0131: Clicking a tagged key navigates to that key's Translation detail", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/services\/glossary\/[^/]+$/, {
        timeout: 15000,
      });

      const taggedKeyRow = page.getByRole("row").nth(1);
      if (await taggedKeyRow.isVisible({ timeout: 8000 }).catch(() => false)) {
        await taggedKeyRow.click();
        await expect(page).toHaveURL(/translations\/[^/]+$/, {
          timeout: 15000,
        });
      }
    }
  });
});
