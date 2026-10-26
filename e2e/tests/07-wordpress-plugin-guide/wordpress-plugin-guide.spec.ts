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

    await test.step("Open Integrations hands over to Blocks OS", async () => {
      await guides.expectOpenIntegrationsEnabled();
      await guides.openIntegrationsInBlocksOs();
    });
  });
});
