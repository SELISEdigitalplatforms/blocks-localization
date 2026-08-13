import { expect, type Locator, type Page } from "@playwright/test";
import { expectToast } from "../../test-base";
import { waitForUiSettle } from "../../utils/wait-for";

export type WebhookInput = {
  url: string;
  headerKey: string;
  secret: string;
  disable?: boolean;
};

/** Configuration page — languages + webhooks (/services/configure). */
export class ConfigurePage {
  readonly page: Page;
  readonly newLanguageButton: Locator;
  readonly saveWebhookButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.newLanguageButton = page.getByRole("button", { name: "New Language" });
    this.saveWebhookButton = page.getByRole("button", { name: "Save Webhook" });
  }

  async openFromSidebar() {
    await this.page.getByRole("link", { name: "Configuration" }).click();
    await this.waitForReady();
  }

  async waitForReady(timeout = 45_000) {
    await this.page.waitForURL(/\/services\/configure/, { timeout });
    await expect(this.page.getByRole("heading", { name: "Configure Languages" })).toBeVisible({
      timeout,
    });
  }

  /** Languages table only — avoids matching header rows. */
  private languagesTable() {
    return this.page
      .getByRole("heading", { name: "Languages" })
      .locator("xpath=ancestor::div[contains(@class,'rounded')]")
      .getByRole("table");
  }

  private languageRow(languageName: string) {
    return this.languagesTable()
      .locator("tbody tr")
      .filter({
        has: this.page.locator("td").first().getByText(languageName, { exact: true }),
      });
  }

  async expectLanguageVisible(languageName: string) {
    await expect(this.languageRow(languageName)).toBeVisible();
  }

  async expectLanguageNotVisible(languageName: string) {
    await expect(this.languageRow(languageName)).toHaveCount(0);
  }

  async expectDefaultLanguage(languageName: string) {
    await expect(this.languageRow(languageName).getByText("Default")).toBeVisible({
      timeout: 15_000,
    });
  }

  async dismissOverlays() {
    await this.page.keyboard.press("Escape");
  }

  async openLanguageRowMenu(languageName: string) {
    await this.dismissOverlays();
    await this.languageRow(languageName).getByRole("button").click();
    await this.page.getByRole("menuitem", { name: "Make default language" }).waitFor({
      state: "visible",
    });
  }

  async confirmDialog(title: string, buttonName: string) {
    const dialog = this.page.getByRole("dialog", { name: title });
    await dialog.getByRole("button", { name: buttonName }).click();
    await expect(dialog).toBeHidden({ timeout: 15_000 });
  }

  async makeDefaultLanguage(languageName: string) {
    await this.openLanguageRowMenu(languageName);
    await this.page.getByRole("menuitem", { name: "Make default language" }).click();
    await this.confirmDialog("Make default language", "Save");
    await expectToast(this.page, "Make default successfully");
    await waitForUiSettle(this.page);
  }

  async deleteLanguage(languageName: string) {
    await this.dismissOverlays();
    await this.languageRow(languageName).getByRole("button").click();
    await this.page.getByRole("menuitem", { name: "Delete language" }).click();
    await this.confirmDialog("Delete language", "Delete");
    await expectToast(this.page, "Deleted successfully");
    await waitForUiSettle(this.page);
  }

  async addLanguage(languageName: string) {
    await this.newLanguageButton.click();
    const dialog = this.page.getByRole("dialog", { name: "New Language" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Language" }).click();
    await this.page.getByRole("option", { name: languageName, exact: true }).click();
    await dialog.getByRole("button", { name: "Save" }).click();
    await expectToast(this.page, "Language added successfully.");
    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await waitForUiSettle(this.page);
  }

  async addLanguageIfMissing(languageName: string) {
    const exists = await this.languageRow(languageName)
      .isVisible()
      .catch(() => false);

    if (!exists) {
      await this.addLanguage(languageName);
    }
  }

  private async fillTextbox(locator: Locator, value: string) {
    await locator.click();
    await locator.fill("");
    await locator.fill(value);
  }

  async configureWebhook(input: WebhookInput) {
    const urlField = this.page.getByRole("textbox", { name: "URL" });
    const headerField = this.page.getByRole("textbox", { name: "Secret Header Key" });
    const secretField = this.page.getByRole("textbox", { name: "Secret", exact: true });

    await this.fillTextbox(urlField, input.url);
    await this.fillTextbox(headerField, input.headerKey);
    await this.fillTextbox(secretField, input.secret);

    if (input.disable !== undefined) {
      const disableSwitch = this.page.getByRole("switch", { name: "Disable webhook" });
      const isDisabled = await disableSwitch.isChecked();
      if (isDisabled !== input.disable) {
        await disableSwitch.click();
      }
    }

    // Button stays disabled when values match the saved webhook (form not dirty).
    if (!(await this.saveWebhookButton.isEnabled())) {
      await this.fillTextbox(secretField, `${input.secret}-e2e-${Date.now()}`);
    }

    await expect(this.saveWebhookButton).toBeEnabled({ timeout: 5_000 });
    await this.saveWebhookButton.click();
    await expectToast(this.page, "Webhook saved successfully.");
    await waitForUiSettle(this.page);
  }
}
