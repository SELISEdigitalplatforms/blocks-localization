import { test, expect } from "../../support/test-base";
import { ConfigurationPage } from "../../support/pages/configuration.page";
import { openConfiguration } from "../../support/localization-helpers";

test.describe("Configuration", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await openConfiguration(page);
  });

  test("Configuration Page", async ({ page }) => {
    const config = new ConfigurationPage(page);

    await test.step("Page loads with expected sections", async () => {
      await config.expectPageLoaded();
      await config.expectLanguagesSectionVisible();
    });

    await test.step("Add a new language", async () => {
      await config.openNewLanguageDialog();
      await config.expectNewLanguageDialogLoaded();
      await config.selectLanguage("Arabic");
      await config.saveNewLanguage();

      const result = await config.waitForLanguageResult("Arabic");
      expect(result).not.toBeNull();

      if (await config.page.getByText(/Language is already added/i).isVisible().catch(() => false)) {
        await config.page.getByRole("button", { name: "Close" }).click();
      }

      await expect(config.page.getByRole("row").filter({ hasText: "Arabic" })).toBeVisible({
        timeout: 10_000,
      });
    });

    await test.step("Make Arabic the default language", async () => {
      await config.openMakeDefaultDialog("Arabic");
      await config.confirmMakeDefault();
      await expect(config.page.getByRole("row").filter({ hasText: "Arabic" }).getByText("Default", { exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await config.page.keyboard.press("Escape");
    });

    await test.step("Delete the language", async () => {
      await config.openDeleteDialog("Arabic");
      await config.confirmDeleteLanguage();
      await config.waitForDeleteResult("Arabic");
    });

    await test.step("Webhooks section is visible", async () => {
      await config.expectWebhooksSectionVisible();
    });

    await test.step("Required field validation", async () => {
      await config.expectWebhookFormValidation();
    });

    await test.step("Invalid URL shows a validation message", async () => {
      await config.expectInvalidUrlValidation();
    });

    await test.step("Webhook creates successfully with valid data", async () => {
      const stamp = Date.now();
      await config.fillWebhookForm({
        url: `https://example.com/webhook-${stamp}`,
        contentType: "application/json",
        headerKey: "X-Webhook-Secret",
        secret: `secret-${stamp}`,
      });
      await config.saveWebhook();
      await config.waitForWebhookSaveToast();
    });

    await test.step("Edit an existing webhook and toggle Disable", async () => {
      const urlInput = config.page.getByRole("textbox", { name: "URL" });
      const headerKeyInput = config.page.getByRole("textbox", { name: "Secret Header Key" });
      const secretInput = config.page.getByRole("textbox", { name: /^Secret \*$/ });
      const saveButton = config.page.getByRole("button", { name: "Save Webhook" });

      await test.step("Ensure a webhook exists", async () => {
        const existingUrl = (await urlInput.inputValue()).trim();
        if (!existingUrl) {
          const stamp = Date.now();
          await urlInput.fill(`https://e2e-${stamp}.example.com/webhook`);
          await headerKeyInput.fill("X-E2E-Secret");
          await secretInput.fill("e2e-secret-value");
          await expect(saveButton).toBeEnabled({ timeout: 10_000 });
          await saveButton.click();
          await config.waitForWebhookSaveToast();
        }
      });

      await test.step("Edit webhook fields and save", async () => {
        const stamp = Date.now();
        await config.fillWebhookForm({
          url: `https://e2e-${stamp}.example.com/webhook`,
          contentType: "application/json",
          headerKey: `X-E2E-Secret-${stamp}`,
          secret: `e2e-secret-value-${stamp}`,
        });
        await config.saveWebhook();
        await config.waitForWebhookSaveToast();
      });

      await test.step("Toggle Disable webhook and save", async () => {
        await config.fillWebhookForm({
          url: `https://e2e-toggle-${Date.now()}.example.com/webhook`,
          contentType: "application/json",
          headerKey: "X-E2E-Secret",
          secret: "e2e-secret-value",
        });
        await config.toggleDisableWebhook();
        await config.saveWebhook();
        await config.waitForWebhookSaveToast();
      });
    });
  });
});
