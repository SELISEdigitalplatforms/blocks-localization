import { test, expect } from "../../../support/test-base";
import { loginToProject } from "../../../support/auth";
import { ConfigurePage } from "../../../support/pages/configuration";

test.describe("Configuration", () => {
  test.beforeEach(async ({ page }) => {
    await loginToProject(page);
  });

  test("languages, default switch, webhook, add and delete language", async ({ page }) => {
    test.setTimeout(300_000);

    const configure = new ConfigurePage(page);
    const addedLanguage = "Slovenian";
    const webhookUrl =
      process.env.E2E_WEBHOOK_URL ?? "https://webhook.site/28986105-6782-4ea8-92f9-6e9a81f74274";
    const webhookHeaderKey =
      process.env.E2E_WEBHOOK_HEADER_KEY ?? "28986105-6782-4ea8-92f9-6e9a81f74274";
    const webhookSecret = process.env.E2E_WEBHOOK_SECRET ?? "newmamaa";

    await configure.openFromSidebar();

    // Switch default away from English, then restore English.
    await configure.makeDefaultLanguage("Bengali");
    await configure.expectDefaultLanguage("Bengali");
    await configure.makeDefaultLanguage("English");
    await configure.expectDefaultLanguage("English");

    // Add a language, configure webhook, then remove the language.
    await configure.addLanguageIfMissing(addedLanguage);
    await configure.expectLanguageVisible(addedLanguage);

    await configure.configureWebhook({
      url: webhookUrl,
      headerKey: webhookHeaderKey,
      secret: webhookSecret,
      disable: true,
    });

    await configure.deleteLanguage(addedLanguage);
    await configure.expectLanguageNotVisible(addedLanguage);
    await configure.expectDefaultLanguage("English");
  });
});
