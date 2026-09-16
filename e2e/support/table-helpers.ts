import { expect, type Page } from "@playwright/test";

export const expectActionsColumnIsLast = async (page: Page) => {
  const headers = page.locator("thead tr").first().locator("th");
  const count = await headers.count();
  const lastHeaderText = (await headers.nth(count - 1).innerText()).replace(/\s+/g, " ").trim();
  expect(lastHeaderText).toContain("Actions");
};
