import { expect, type Page } from "@playwright/test"

/** Wait for a toast/notification message to appear. */
export const waitForToast = async (
  page: Page,
  message: string | RegExp,
  timeout = 60_000,
) => {
  await expect(page.getByText(message).first()).toBeVisible({ timeout })
}

/** Best-effort wait for in-flight requests / UI settle. */
export const waitForUiSettle = async (page: Page, timeout = 15_000) => {
  await page.waitForLoadState("networkidle", { timeout }).catch(() => {})
}

/** Poll until predicate passes — for async backend jobs without stable UI signals. */
export const waitUntil = async (
  predicate: () => Promise<boolean>,
  options: { timeout?: number; interval?: number } = {},
) => {
  const timeout = options.timeout ?? 120_000
  const interval = options.interval ?? 2_000
  const started = Date.now()

  while (Date.now() - started < timeout) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw new Error(`Timed out after ${timeout}ms waiting for condition`)
}
