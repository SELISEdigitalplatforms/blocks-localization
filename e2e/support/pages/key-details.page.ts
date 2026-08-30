import { type Page, type Locator, expect } from "@playwright/test";

export class KeyDetailsPage {
  readonly page: Page;

  private readonly detailsTab: Locator;
  private readonly historyTab: Locator;
  private readonly deleteButton: Locator;
  private readonly deleteDialog: Locator;

  constructor(page: Page) {
    this.page = page;

    this.detailsTab = page.getByRole("tab", { name: "Details" });
    this.historyTab = page.getByRole("tab", { name: "History" });
    this.deleteButton = page.getByRole("button", { name: "Delete" });
    this.deleteDialog = page.getByRole("dialog", { name: "Delete Key" });
  }

  async navigateTo(itemId: string | undefined, baseUrl: string) {
    await this.page.goto(`${baseUrl}/app/${itemId}/services/language/translations/${itemId}`);
    await expect(this.page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
  }

  async expectTabsVisible() {
    await expect(this.detailsTab).toBeVisible();
    await expect(this.historyTab).toBeVisible();
  }

  async expectDetailsTabActive() {
    await expect(this.detailsTab).toHaveAttribute("data-state", "active");
  }

  async expectHistoryTabActive() {
    await expect(this.historyTab).toHaveAttribute("data-state", "active");
  }

  async switchToHistoryTab() {
    await this.historyTab.click();
    await this.expectHistoryTabActive();
  }

  async expectActivityHeadingVisible() {
    await expect(this.page.getByRole("heading", { name: "Activity" })).toBeVisible({
      timeout: 15_000,
    });
  }

  async expectTimelineDescriptionVisible() {
    await expect(this.page.getByText("View language value change timeline.")).toBeVisible();
  }

  async switchToDetailsTab() {
    await this.detailsTab.click();
    await this.expectDetailsTabActive();
  }

  async openDeleteDialog() {
    await this.deleteButton.click();
    await expect(this.deleteDialog).toBeVisible();
  }

  async confirmDelete() {
    await this.deleteDialog.getByRole("button", { name: "Delete Key" }).click();
  }

  async expectDeleteSuccess() {
    await expect(this.page.getByText("Key deleted successfully.", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  }

  async expectRedirectedToTranslations() {
    await expect(this.page).toHaveURL(/\/services\/language$/, { timeout: 15_000 });
  }
}
