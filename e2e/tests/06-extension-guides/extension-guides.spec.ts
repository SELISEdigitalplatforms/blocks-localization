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

  test("Extension Guides Page", async ({ page }) => {
    await page.getByRole("link", { name: "Extension Guides" }).click();
    await expect(page.getByRole("heading", { name: "Extension Guides" })).toBeVisible();
    expect(await page.getByText(/Connect SELISE Blocks/)).toBeVisible();

    // Set up a Blocks instance section
    const extensionRow = page.getByRole("button", {
      name: "Install the browser extension",
    });

    // Accordion is initially collapsed
    await expect(extensionRow).toBeVisible();
    await expect(extensionRow).toHaveAttribute("aria-expanded", "false");
    await expect(extensionRow).toHaveAttribute("data-state", "closed");

    // Expand accordion
    await extensionRow.click();

    await expect(extensionRow).toHaveAttribute("aria-expanded", "true");
    await expect(extensionRow).toHaveAttribute("data-state", "open");

    // Chrome Web Store is now available
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

    await verifyAccordion("Open Manage Instances");
    await verifyAccordion("Add a cloud instance");
    await verifyAccordion("Enter the instance details");
    await verifyAccordion("Save and select the instance");
    await verifyAccordion("Sign in");

    // Alternative setup options section
    await expect(page.getByRole("heading", { name: "Alternative setup options" })).toBeVisible();

    const copyAndVerify = async (buttonName: string) => {
      await page.getByRole("button", { name: buttonName }).click();
      await expect(page.getByText("Copied")).toBeVisible();
    };

    await expect(page.getByRole("heading", { name: "JSON setup" })).toBeVisible();
    await copyAndVerify("Copy Blocks OS configuration");

    await expect(page.getByRole("heading", { name: "Manual setup" })).toBeVisible();
    await copyAndVerify("Copy API Base URL");
    await copyAndVerify("Copy X-Blocks-Key");

    await expect(
      page.getByRole("heading", { name: "Get the runtime configuration" }),
    ).toBeVisible();
    await copyAndVerify("Copy Terminal command");

    // Manage saved instances section
    await expect(page.getByRole("heading", { name: "Manage saved instances" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Active instance" })).toBeVisible();

    await expect(page.getByText("The ACTIVE label identifies")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Edit details" })).toBeVisible();

    await expect(page.getByText("Use the pencil button to")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Remove an instance" })).toBeVisible();

    await expect(page.getByText("Use the trash button to")).toBeVisible();
  });
});
