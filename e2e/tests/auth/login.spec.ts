import { test, expect } from "../../support/test-base"
import { loginToTranslations } from "../../support/auth"

test.describe("Authentication", () => {
  test.beforeEach(async ({ page }) => {
    await loginToTranslations(page)
  })

  test("logs in and lands on Translations", async ({ page }) => {
    await expect(page).toHaveURL(/\/services\/language/)
    await expect(
      page.getByRole("tab", { name: "Translation Keys" }),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText("Configure keys")).toBeVisible()
  })
})
