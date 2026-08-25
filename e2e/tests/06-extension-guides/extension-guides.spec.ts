import { test, expect } from "../../support/test-base";
import { openExtensionGuides } from "../../support/localization-helpers";

test.describe("Extension Guides", () => {
  test.beforeEach(async ({ page }) => {
    await openExtensionGuides(page);
  });

  test("Extension Guides Page", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Extension Guides" })).toBeVisible();
    expect(await page.getByText(/Connect SELISE Blocks/)).toBeVisible();

    const extensionRow = page.getByRole("button", {
      name: "Install the browser extension",
    });

    await test.step("Set up a Blocks instance: expand/collapse the browser-extension accordion", async () => {
      // Accordion is initially collapsed
      await expect(extensionRow).toBeVisible();
      await expect(extensionRow).toHaveAttribute("aria-expanded", "false");
      await expect(extensionRow).toHaveAttribute("data-state", "closed");

      // Expand accordion
      await extensionRow.click();

      await expect(extensionRow).toHaveAttribute("aria-expanded", "true");
      await expect(extensionRow).toHaveAttribute("data-state", "open");
    });

    await test.step("Chrome Web Store link opens the extension's store page", async () => {
      const page3Promise = page.waitForEvent("popup");

      await page.getByRole("link", { name: "Chrome Web Store" }).click();

      const page3 = await page3Promise;

      await page3.waitForLoadState("domcontentloaded");

      await expect(
        page3.getByRole("heading", {
          name: "SELISE Blocks Assistant",
          exact: true,
        }),
      ).toBeVisible();

      // Come back to your application
      await page.bringToFront();

      // Collapse accordion
      await extensionRow.click();

      await expect(extensionRow).toHaveAttribute("aria-expanded", "false");
      await expect(extensionRow).toHaveAttribute("data-state", "closed");
    });

    const verifyAccordion = async (name: string) => {
      const row = page.getByRole("button", { name });

      await expect(row).toBeVisible();
      await expect(row).toHaveAttribute("aria-expanded", "false");
      await expect(row).toHaveAttribute("data-state", "closed");

      await row.click();

      await expect(row).toHaveAttribute("aria-expanded", "true");
      await expect(row).toHaveAttribute("data-state", "open");

      await row.click();

      await expect(row).toHaveAttribute("aria-expanded", "false");
      await expect(row).toHaveAttribute("data-state", "closed");
    };

    await test.step("Remaining setup-step accordions expand and collapse", async () => {
      await verifyAccordion("Open Manage Instances");
      await verifyAccordion("Add a cloud instance");
      await verifyAccordion("Enter the instance details");
      await verifyAccordion("Save and select the instance");
      await verifyAccordion("Sign in");
    });

    const copyAndVerify = async (buttonName: string) => {
      const button = page.getByRole("button", { name: buttonName });
      await button.click();
      await expect
        .poll(
          async () => {
            if (await page.getByText("Copied").isVisible().catch(() => false)) return "toast";
            const label = await button.getAttribute("aria-label");
            if (label && /copied/i.test(label)) return "label";
            try {
              const text = await page.evaluate(async () => navigator.clipboard.readText());
              if (text.length > 0) return "clipboard";
            } catch {
              // Clipboard may be blocked in some headed runs.
            }
            return null;
          },
          { timeout: 5000 },
        )
        .not.toBeNull();
    };

    await test.step("Alternative setup options section: copy buttons work", async () => {
      await expect(page.getByRole("heading", { name: "Alternative setup options" })).toBeVisible();

      // Clipboard access is required for the copy buttons to flip their tooltip
      // to "Copied" and for the copy operation to complete without an error.
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);

      await expect(page.getByRole("heading", { name: "JSON setup" })).toBeVisible();
      await copyAndVerify("Copy Blocks OS configuration");

      await expect(page.getByRole("heading", { name: "Manual setup" })).toBeVisible();
      await copyAndVerify("Copy API Base URL");
      await copyAndVerify("Copy X-Blocks-Key");

      await expect(
        page.getByRole("heading", { name: "Get the runtime configuration" }),
      ).toBeVisible();
      await copyAndVerify("Copy Terminal command");
    });

    await test.step("Manage saved instances section is visible", async () => {
      await expect(page.getByRole("heading", { name: "Manage saved instances" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Active instance" })).toBeVisible();

      await expect(page.getByText("The ACTIVE label identifies")).toBeVisible();

      await expect(page.getByRole("heading", { name: "Edit details" })).toBeVisible();

      await expect(page.getByText("Use the pencil button to")).toBeVisible();

      await expect(page.getByRole("heading", { name: "Remove an instance" })).toBeVisible();

      await expect(page.getByText("Use the trash button to")).toBeVisible();
    });
  });
});
