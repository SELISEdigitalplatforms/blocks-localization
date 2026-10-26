import { test, expect } from "../../support/test-base";
import { ExtensionGuidesPage } from "../../support/pages/extension-guides.page";
import { openExtensionGuides } from "../../support/localization-helpers";

test.describe("Extension Guides", () => {
  test.beforeEach(async ({ page }) => {
    await openExtensionGuides(page);
  });

  test("Extension Guides Page", async ({ page }) => {
    const guides = new ExtensionGuidesPage(page);

    await test.step("Extension Guides page loads with main sections", async () => {
      await guides.expectPageLoaded();
      await guides.expectConnectBlocksVisible();
    });

    const extensionRow = page.getByRole("button", {
      name: "Install the browser extension",
    });

    await test.step("Set up a Blocks instance: expand/collapse the browser-extension accordion", async () => {
      await guides.expectAccordionCollapsed(extensionRow);
      await guides.expandAccordion(extensionRow);
    });

    // The external store page is not loaded: from the runner Google shows a
    // cookie-consent page first (approved on #345, Q2: B).
    await test.step("Chrome Web Store link points to the extension's store listing", async () => {
      await guides.expectChromeWebStoreLinkTargetsListing();
      await guides.collapseAccordion(extensionRow);
      await guides.expectAccordionCollapsed(extensionRow);
    });

    await test.step("Remaining setup-step accordions expand and collapse", async () => {
      const accordions = [
        "Open Manage Instances",
        "Add a cloud instance",
        "Enter the instance details",
        "Save and select the instance",
        "Sign in",
      ];
      for (const name of accordions) {
        const row = guides.getAccordionButton(name);
        await guides.expectAccordionCollapsed(row);
        await guides.expandAccordion(row);
        await guides.collapseAccordion(row);
        await guides.expectAccordionCollapsed(row);
      }
    });

    await test.step("Alternative setup options section: copy buttons work", async () => {
      await guides.expectAlternativeSetupOptionsVisible();
      await guides.grantClipboardPermissions();
      await expect(page.getByRole("heading", { name: "JSON setup" })).toBeVisible();
      await guides.copyButton("Copy Blocks OS configuration");
      await expect(page.getByRole("heading", { name: "Manual setup" })).toBeVisible();
      await guides.copyButton("Copy API Base URL");
      await guides.copyButton("Copy X-Blocks-Key");
      await expect(
        page.getByRole("heading", { name: "Get the runtime configuration" }),
      ).toBeVisible();
      await guides.copyButton("Copy Terminal command");
    });

    await test.step("Manage saved instances section is visible", async () => {
      await guides.expectActiveInstanceVisible();
      await guides.expectEditDetailsVisible();
      await guides.expectRemoveInstanceVisible();
    });
  });
});
