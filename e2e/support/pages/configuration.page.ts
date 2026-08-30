import { type Page, type Locator, expect } from "@playwright/test";

export class ConfigurationPage {
  readonly page: Page;

  private readonly heading: Locator;
  private readonly newLanguageButton: Locator;
  private readonly languagesHeading: Locator;
  private readonly languageColumnHeader: Locator;
  private readonly languageCodeColumnHeader: Locator;
  private readonly actionsColumnHeader: Locator;
  private readonly webhooksHeading: Locator;
  private readonly urlInput: Locator;
  private readonly contentTypeInput: Locator;
  private readonly secretHeaderKeyInput: Locator;
  private readonly secretInput: Locator;
  private readonly disableWebhookSwitch: Locator;
  private readonly saveWebhookButton: Locator;
  private readonly newLanguageDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole("heading", { name: "Configure Languages" });
    this.newLanguageButton = page.getByRole("button", { name: "New Language" });
    this.languagesHeading = page.getByRole("heading", { name: "Languages", exact: true });
    this.languageColumnHeader = page.getByRole("columnheader", { name: "Language", exact: true });
    this.languageCodeColumnHeader = page.getByRole("columnheader", { name: "Language Code", exact: true });
    this.actionsColumnHeader = page.getByRole("columnheader", { name: "Actions", exact: true });
    this.webhooksHeading = page.getByRole("heading", { name: "Webhooks" });
    this.urlInput = page.getByRole("textbox", { name: "URL" });
    this.contentTypeInput = page.getByRole("textbox", { name: "Content Type" });
    this.secretHeaderKeyInput = page.getByRole("textbox", { name: "Secret Header Key" });
    this.secretInput = page.getByRole("textbox", { name: /^Secret \*$/ });
    this.disableWebhookSwitch = page.getByRole("switch", { name: "Disable webhook" });
    this.saveWebhookButton = page.getByRole("button", { name: "Save Webhook" });
    this.newLanguageDialog = page.getByRole("dialog", { name: "New Language" });
  }

  async expectPageLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.newLanguageButton).toBeVisible();
  }

  async expectLanguagesSectionVisible() {
    await expect(this.languagesHeading).toBeVisible({ timeout: 15_000 });
    await expect(this.languageColumnHeader).toBeVisible();
    await expect(this.languageCodeColumnHeader).toBeVisible();
    await expect(this.actionsColumnHeader).toBeVisible();
  }

  async expectWebhooksSectionVisible() {
    await this.webhooksHeading.scrollIntoViewIfNeeded();
    await expect(this.webhooksHeading).toBeVisible({ timeout: 15_000 });
    await expect(this.urlInput).toBeVisible();
    await expect(this.contentTypeInput).toBeVisible();
    await expect(this.secretHeaderKeyInput).toBeVisible();
    await expect(this.secretInput).toBeVisible();
    await expect(this.disableWebhookSwitch).toBeVisible();
    await expect(this.saveWebhookButton).toBeVisible();
  }

  async openNewLanguageDialog() {
    await this.newLanguageButton.click();
    await expect(this.newLanguageDialog).toBeVisible();
  }

  async expectNewLanguageDialogLoaded() {
    await expect(this.newLanguageDialog).toBeVisible();
    const languageButton = this.page
      .getByRole("button", { name: "Language" })
      .or(this.page.getByRole("button", { name: "Language *" }))
      .first();
    await expect(languageButton).toBeVisible();
  }

  async selectLanguage(languageName: string) {
    const languageButton = this.page
      .getByRole("button", { name: "Language" })
      .or(this.page.getByRole("button", { name: "Language *" }))
      .first();
    await languageButton.click();
    await this.page.getByPlaceholder("Search language...").fill(languageName.toLowerCase());
    await this.page.getByRole("option", { name: languageName }).click();
  }

  async saveNewLanguage() {
    const saveButton = this.page.getByRole("button", { name: "Save" });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
  }

  async waitForLanguageResult(languageName: string) {
    const successMessage = this.page.getByText("Language added successfully.", { exact: true });
    const duplicateMessage = this.page.getByText(/Language is already added|already added.*language/i);
    const languageRow = this.page.getByRole("row").filter({ hasText: languageName });

    await expect
      .poll(
        async () => {
          if (await successMessage.isVisible().catch(() => false)) return "success";
          if (await duplicateMessage.isVisible().catch(() => false)) {
            await this.page.getByRole("button", { name: "Close" }).click();
            return "duplicate";
          }
          if (await languageRow.isVisible().catch(() => false)) return "row";
          return null;
        },
        { timeout: 20_000, intervals: [200, 500, 1000] },
      )
      .not.toBeNull();

    return { successMessage, duplicateMessage, languageRow };
  }

  getLanguageRowMenuButton(languageName: string) {
    const languageRow = this.page.getByRole("row").filter({ hasText: languageName });
    return languageRow.getByRole("button").filter({
      has: this.page.locator("svg.lucide-ellipsis-vertical"),
    });
  }

  async openMakeDefaultDialog(languageName: string) {
    const menuButton = this.getLanguageRowMenuButton(languageName);
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(this.page.getByRole("menuitem", { name: "Make default language" })).toBeVisible();
    await this.page.getByRole("menuitem", { name: "Make default language" }).click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }

  async confirmMakeDefault() {
    const dialog = this.page.getByRole("dialog");
    await expect(dialog.getByText("Are you sure you want to set this language as default?", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Save" }).click();
  }

  async openDeleteDialog(languageName: string) {
    const menuButton = this.getLanguageRowMenuButton(languageName);
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(this.page.getByRole("menuitem", { name: "Delete language" })).toBeVisible();
    await this.page.getByRole("menuitem", { name: "Delete language" }).click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }

  async confirmDeleteLanguage() {
    const dialog = this.page.getByRole("dialog");
    await expect(dialog.getByText("Are you sure you want to delete this language?", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "Delete" }).click();
  }

  async waitForDeleteResult(languageName: string) {
    const languageRow = this.page.getByRole("row").filter({ hasText: languageName });
    await expect
      .poll(
        async () => {
          if (
            await this.page
              .getByText(/language.*deleted successfully/i)
              .isVisible()
              .catch(() => false)
          ) {
            return "toast";
          }
          if (!(await languageRow.isVisible().catch(() => false))) {
            return "removed";
          }
          return null;
        },
        { timeout: 15_000, intervals: [200, 500, 1000] },
      )
      .not.toBeNull();
  }

  async fillWebhookForm(data: {
    url: string;
    contentType: string;
    headerKey: string;
    secret: string;
  }) {
    await this.urlInput.fill(data.url);
    await this.contentTypeInput.fill(data.contentType);
    await this.secretHeaderKeyInput.fill(data.headerKey);
    await this.secretInput.fill(data.secret);
    await this.page.keyboard.press("Tab");
  }

  async saveWebhook() {
    await expect
      .poll(async () => (await this.saveWebhookButton.isEnabled()) ? true : null, {
        timeout: 20_000,
        intervals: [200, 500, 1000],
      })
      .toBe(true);
    const saveResponsePromise = this.page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("SaveWebHook"),
      { timeout: 20_000 },
    );
    await this.saveWebhookButton.click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBeTruthy();
    await expect(saveResponse.json()).resolves.toMatchObject({ success: true });
  }

  async waitForWebhookSaveToast() {
    await expect
      .poll(() => this.page.getByText("Webhook saved successfully.", { exact: true }).isVisible().catch(() => false), {
        timeout: 20_000,
      })
      .toBeTruthy();
  }

  async toggleDisableWebhook() {
    await expect(this.disableWebhookSwitch).toBeVisible();
    await this.disableWebhookSwitch.click();
  }

  async expectWebhookFormValidation() {
    await this.urlInput.fill("");
    await this.page.keyboard.press("Tab");
    await this.contentTypeInput.fill("");
    await this.page.keyboard.press("Tab");
    await this.secretHeaderKeyInput.fill("");
    await this.page.keyboard.press("Tab");
    await this.secretInput.fill("");
    await this.page.keyboard.press("Tab");
    await this.saveWebhookButton.click();

    await expect(this.urlInput).toHaveAttribute("aria-invalid", "true");
    await expect(this.contentTypeInput).toHaveAttribute("aria-invalid", "true");
    await expect(this.secretHeaderKeyInput).toHaveAttribute("aria-invalid", "true");
    await expect(this.secretInput).toHaveAttribute("aria-invalid", "true");
  }

  async expectInvalidUrlValidation() {
    await this.urlInput.fill("abcdef");
    await expect(
      this.page
        .getByText("Enter a valid URL starting with http:// or https://", { exact: true })
        .or(this.page.getByText("Must be a valid URL", { exact: true })),
    ).toBeVisible();
  }
}
