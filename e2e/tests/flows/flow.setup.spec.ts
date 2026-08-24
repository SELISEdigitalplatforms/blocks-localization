import { test, expect } from "@playwright/test"
import fs from "fs"
import path from "path"
import { reuseOrCreateSharedProject } from "../../support/create-and-delete-project"
import { loginThroughOidc } from "../../support/login-helper"
import { FLOW_SESSION_PATH, writeFlowProject } from "../../support/flow-project"
import { resetRunOutcome } from "../../support/run-outcome"

test.describe("localization setup", () => {
  test("login, reuse or create one shared project", async ({ page }) => {
    test.setTimeout(300_000)
    resetRunOutcome()

    await loginThroughOidc(page)
    await expect(
      page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
    ).toBeVisible({ timeout: 30_000 })

    fs.mkdirSync(path.dirname(FLOW_SESSION_PATH), { recursive: true })
    await page.context().storageState({ path: FLOW_SESSION_PATH })

    const { projectName, dashboardUrl, itemId } = await reuseOrCreateSharedProject(page)
    if (!itemId) {
      throw new Error(`Could not resolve itemId from dashboard URL: ${dashboardUrl}`)
    }

    writeFlowProject({
      projectName,
      itemId,
      dashboardUrl: dashboardUrl.replace(/\?.*$/, ""),
    })
  })
})
