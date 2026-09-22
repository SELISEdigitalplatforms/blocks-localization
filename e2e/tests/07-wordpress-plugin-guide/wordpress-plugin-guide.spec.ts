import { test } from "../../support/test-base";
import { WordPressPluginGuidePage } from "../../support/pages/wordpress-plugin-guide.page";
import { openWordPressPluginGuide } from "../../support/localization-helpers";

test.describe("WordPress Plugin Guide", () => {
  test.beforeEach(async ({ page }) => {
    await openWordPressPluginGuide(page);
  });

  test("WordPress Plugin Guide Page", async ({ page }) => {
    const guides = new WordPressPluginGuidePage(page);

    await test.step("WordPress Plugin Guide page loads with main sections", async () => {
      await guides.expectPageLoaded();
    });

    await test.step("Setup Status card shows project configuration and credentials entry point", async () => {
      await guides.expectSetupStatusSectionsVisible();
    });

    await test.step("Client credentials resolve to a list or an explicit empty state", async () => {
      await guides.expectCredentialsResolved();

      const firstCredential = page.getByRole("button", { name: /Active|Inactive/ }).first();
      if (await firstCredential.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await guides.expandFirstCredential();
      }
    });

    await test.step("Project configuration snippets copy to the clipboard", async () => {
      await guides.copyXBlocksKey();
      await guides.copyOrigin();
    });

    await test.step("Setup Instructions accordions expand and collapse", async () => {
      const accordions = [
        "Create wp-user role with permissions",
        "Create client credentials",
        "Collect required credentials",
      ];
      for (const name of accordions) {
        const row = guides.getAccordionButton(name);
        await guides.expectAccordionCollapsed(row);
        await guides.expandAccordion(row);
        await guides.collapseAccordion(row);
        await guides.expectAccordionCollapsed(row);
      }
    });
  });
});
