import fs from "fs";
import { test, expect } from "@/support/test-base";
import { AppShellPage } from "@/pages/app/app-shell.page";
import { OSCreateProjectPage } from "@/pages/os/create-project.page";
import { LoginPage } from "@/pages/login/login.page";
import { OidcLoginPage } from "@/pages/login/oidc-login.page";
import { PROJECT_NAME_FILE_PATH } from "@/support/project-name";

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
const osBaseUrl = process.env.E2E_OS_BASE_URL;

test.describe("Authentication + project setup", () => {
  test.beforeAll(() => {
    if (!username || !password) {
      throw new Error(
        "E2E_USERNAME / E2E_PASSWORD are not set. Fill them in e2e/.env.e2e before running.",
      );
    }
    if (!osBaseUrl) {
      throw new Error(
        "E2E_OS_BASE_URL is not set. Set it in e2e/.env.e2e before running.",
      );
    }
  });

  test("logs in, creates the run's test project in OS, and persists state", async ({
    page,
  }) => {
    const holdMs = Number(process.env.E2E_HOLD_MS ?? 0);
    if (holdMs > 0) test.setTimeout(holdMs + 60_000);

    // 1. Login page of the Localization app.
    const login = new LoginPage(page);
    await login.goto();
    await login.startOidcLogin();

    // 2. dev-iam OIDC login page (cross-origin).
    const oidc = new OidcLoginPage(page);
    await oidc.waitForReady();
    await oidc.login(username!, password!);

    // 3. Back on the Localization app, authenticated → console.
    await page.waitForURL("**/app/console", { timeout: 45_000 });
    await expect(page).toHaveURL(/\/app\/console/);
    const shell = new AppShellPage(page);
    await shell.waitForAuthenticated();

    await page.context().storageState({ path: "fixtures/auth.json" });

    // 4. Create the run's project in the OS app.
    const projectName = `Localization Test ${Date.now()}`;
    const osCreate = new OSCreateProjectPage(page);

    await osCreate.goto();
    await osCreate.fillProjectName(projectName);
    await osCreate.checkConfirmationCheckboxes();
    await osCreate.clickContinue();
    await osCreate.clickAddRepository();
    // The repo the Localization project should attach to. Override via env if
    // a different test repo is needed.
    const repoOwner = process.env.E2E_OS_TEST_REPO_OWNER ?? "SELISEdigitalplatforms";
    const repoName = process.env.E2E_OS_TEST_REPO_NAME ?? "blocks-localization-fixtures";
    await osCreate.selectRepository(repoOwner, repoName);
    await osCreate.clickAdd();
    await osCreate.clickContinue();
    await osCreate.checkEnvironment("Development");
    await osCreate.clickSubmit();

    // Wait for the OS success toast before moving on.
    await expect(
      page.locator("div").filter({ hasText: "Your project has been created." }),
    ).toBeVisible({ timeout: 60_000 });

    // 5. Persist the project name so every spec + the teardown can reference it.
    fs.writeFileSync(
      PROJECT_NAME_FILE_PATH,
      JSON.stringify({ projectName }, null, 2),
      "utf8",
    );

    // 6. Return to the Localization console and confirm the new project card.
    const consolePage = new AppShellPage(page);
    await consolePage.gotoConsole();
    await page.reload();
    await expect(
      page.locator("div").filter({ hasText: projectName }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await page.context().storageState({ path: "fixtures/auth.json" });

    if (holdMs > 0) {
      await page.waitForTimeout(holdMs);
    }
  });
});