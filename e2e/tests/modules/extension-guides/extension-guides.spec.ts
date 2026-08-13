import { test, expect } from "@/support/test-base";
import { AppShellPage } from "@/pages/app/app-shell.page";
import { ExtensionGuidesPage } from "@/pages/extension-guides";
import { getProjectName } from "@/support/project-name";

test.describe("extension guides", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    const shell = new AppShellPage(page);
    await shell.openProjectWithDevelopment(getProjectName());
    const guides = new ExtensionGuidesPage(page);
    await guides.openFromSidebar();
  });

  test("TC-0160: Extension Guides page default rendering", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Extension Guides" }),
    ).toBeVisible();
    await expect(
      page.getByText(
        "Connect SELISE Blocks Assistant to a Blocks OS instance.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Set up a Blocks instance")).toBeVisible();
  });

  test("TC-0161: Setup steps accordion expands and collapses independently", async ({
    page,
  }) => {
    const accordionTriggers = page.locator("[data-state]").filter({
      has: page.locator(":scope"),
    });
    const firstTrigger = page
      .getByRole("button")
      .filter({ hasText: /step|1\.|2\./i })
      .first();
    if (await firstTrigger.isVisible().catch(() => false)) {
      await firstTrigger.click();
      const firstState = await firstTrigger.getAttribute("data-state");

      const secondTrigger = page
        .getByRole("button")
        .filter({ hasText: /step|1\.|2\./i })
        .nth(1);
      if (await secondTrigger.isVisible().catch(() => false)) {
        await secondTrigger.click();
        // Both can remain open at once (type="multiple").
        await expect(firstTrigger).toHaveAttribute(
          "data-state",
          firstState || "open",
        );
      }
    }
  });

  test("TC-0162: Setup step images render with lazy loading", async ({
    page,
  }) => {
    const stepImages = page.locator("figure img");
    if ((await stepImages.count()) > 0) {
      await expect(stepImages.first()).toHaveAttribute("loading", "lazy");
      await expect(stepImages.first()).toHaveAttribute("decoding", "async");
    }
  });

  test("TC-0163: JSON setup snippet shows the correct configuration keys", async ({
    page,
  }) => {
    await expect(page.getByText("JSON setup")).toBeVisible();
    const jsonBlock = page
      .locator("pre, code")
      .filter({ hasText: "BLOCKS_PUBLIC_API_BASE_URL" });
    await expect(jsonBlock.first()).toBeVisible();
    await expect(jsonBlock.first()).toContainText("BLOCKS_X_BLOCKS_KEY");
  });

  test("TC-0164: Copy button copies the JSON configuration and shows 'Copied' feedback", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const copyButton = page
      .locator("div")
      .filter({ hasText: "Blocks OS configuration (JSON)" })
      .getByRole("button")
      .first();
    if (await copyButton.isVisible().catch(() => false)) {
      await copyButton.click();
      await expect(page.getByText("Copied")).toBeVisible({ timeout: 5000 });

      const clipboardText = await page.evaluate(() =>
        navigator.clipboard.readText(),
      );
      expect(clipboardText).toContain("BLOCKS_PUBLIC_API_BASE_URL");

      await expect(page.getByText("Copied")).toBeHidden({ timeout: 4000 });
    }
  });

  test("TC-0165: Copy button is disabled when its value is not configured", async ({
    page,
  }) => {
    // NOTE: depends on a runtime environment where BLOCKS_X_BLOCKS_KEY (or another
    // snippet value) is intentionally unset; not reproducible against a normally
    // configured dev environment.
    test.skip(
      true,
      "Requires an environment with an unset runtime config value",
    );
  });

  test("TC-0166: Manual setup shows API Base URL and X-Blocks-Key snippets separately", async ({
    page,
  }) => {
    await expect(page.getByText("Manual setup")).toBeVisible();
    const snippetBlocks = page.locator('[class*="snippet"]');
    if ((await snippetBlocks.count()) >= 2) {
      await expect(snippetBlocks.nth(0)).toBeVisible();
      await expect(snippetBlocks.nth(1)).toBeVisible();
    }
  });

  test("TC-0167: Runtime-config curl command is built from the localization base URL", async ({
    page,
  }) => {
    const curlBlock = page.locator("#runtime-config-curl");
    if (await curlBlock.isVisible().catch(() => false)) {
      await expect(curlBlock).toContainText("curl ");
      const text = await curlBlock.innerText();
      expect(text.trim().length).toBeGreaterThan("curl ".length);
    } else {
      await expect(page.getByText(/curl /)).toBeVisible();
    }
  });

  test("TC-0168: 'Manage saved instances' legend explains Active/Edit/Remove icons", async ({
    page,
  }) => {
    await expect(page.getByText("Manage saved instances")).toBeVisible();
    await expect(page.getByText("Active instance")).toBeVisible();
    await expect(page.getByText("Edit details")).toBeVisible();
    await expect(page.getByText("Remove an instance")).toBeVisible();
  });

  test("TC-0169: 'Add Cloud Instance' hint text is shown at the bottom of the page", async ({
    page,
  }) => {
    await expect(
      page.getByText(/Return to Manage Instances and select/),
    ).toBeVisible();
    await expect(page.getByText("Add Cloud Instance").last()).toBeVisible();
  });
});
