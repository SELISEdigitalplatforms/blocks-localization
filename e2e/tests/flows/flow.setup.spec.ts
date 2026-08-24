import { test, expect } from "@playwright/test";
import { loginThroughOidc } from "../../support/login-helper";
import { reuseOrCreateSharedProject } from "../../support/create-and-delete-project";
import { FLOW_SESSION_PATH, writeFlowProject } from "../../support/flow-project";

// Mirrors blocks-logic's workflow.setup.spec.ts: log in once, reuse or
// create the one shared project, and open its Development environment here
// -- ONCE -- so every flow spec can navigate straight to the saved
// dashboardUrl instead of independently entering the environment itself.
//
// The POST /api/auth/impersonate call behind "opening an environment" is
// rate-limited (roughly 3 successful calls per run, confirmed empirically:
// flow-setup + the first two flow specs succeeded, then every spec after
// that failed with a 401 "session_expired", even with a brand new login
// immediately before each attempt -- ruling out session/token expiry).
//
// The fix is the storageState save's position: it must happen AFTER
// reuseOrCreateSharedProject, not before. Capturing the session post-entry
// means it already carries whatever cookie the one successful impersonation
// call sets, so downstream specs load pages as already-impersonated instead
// of each independently calling impersonate again and burning the limit.
test.describe("flow setup", () => {
  test("login, reuse or create the shared project, open its environment", async ({ page }) => {
    test.setTimeout(180_000);

    await loginThroughOidc(page);
    await expect(
      page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
    ).toBeVisible({ timeout: 30_000 });

    const { projectName, dashboardUrl, itemId, wasCreated } = await reuseOrCreateSharedProject(page);
    if (!itemId) {
      throw new Error(`Could not resolve itemId from dashboard URL: ${dashboardUrl}`);
    }

    await page.context().storageState({ path: FLOW_SESSION_PATH });
    writeFlowProject({ projectName, itemId, dashboardUrl, wasCreated });
  });
});
