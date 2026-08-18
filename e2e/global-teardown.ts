import fs from "fs";
import { chromium, expect } from "@playwright/test";
import { OSProjectPage } from "@/pages/os/project.page";
import { PROJECT_NAME_FILE_PATH } from "@/support/project-name";

const AUTH_FILE = "fixtures/auth.json";

interface ProjectNameFile {
  projectName: string;
}

export default async function globalTeardown() {
  console.log(`[e2e teardown] started (project fixture: ${PROJECT_NAME_FILE_PATH})`);

  if (!fs.existsSync(PROJECT_NAME_FILE_PATH)) {
    console.warn(
      `[e2e teardown] ${PROJECT_NAME_FILE_PATH} not found — skipping project deletion. ` +
        `Did the setup project run?`,
    );
    return;
  }

  if (!fs.existsSync(AUTH_FILE)) {
    console.warn(
      `[e2e teardown] ${AUTH_FILE} not found — skipping project deletion (no auth state to reuse).`,
    );
    return;
  }

  let projectName: string;
  try {
    const raw = fs.readFileSync(PROJECT_NAME_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ProjectNameFile;
    projectName = parsed.projectName;
    if (!projectName) throw new Error("missing projectName field");
  } catch (err) {
    console.warn(
      `[e2e teardown] Failed to read project name from ${PROJECT_NAME_FILE_PATH}: ${err}. Skipping cleanup.`,
    );
    return;
  }

  const osBaseUrl = process.env.E2E_OS_BASE_URL;
  if (!osBaseUrl) {
    console.warn(
      `[e2e teardown] E2E_OS_BASE_URL is not set — skipping project deletion.`,
    );
    return;
  }

  console.log(`[e2e teardown] Deleting project "${projectName}" via OSProjectPage...`);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL: osBaseUrl,
      storageState: AUTH_FILE,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const osProject = new OSProjectPage(page);

    await osProject.gotoConsole();

    await expect(
      page.locator("div").filter({ hasText: projectName }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await osProject.clickProjectSettings(projectName);
    await osProject.clickEnvironment("Development");
    await osProject.clickDeleteButton();
    await osProject.confirmDelete();
    await osProject.expectSuccessfullyDeletedToast();

    console.log(`[e2e teardown] Deleted project "${projectName}".`);
    await context.close();
  } catch (err) {
    console.error(
      `[e2e teardown] Project deletion failed for "${projectName}":`,
      err,
    );
    console.error(
      `[e2e teardown] The project may need to be removed manually from the OS console.`,
    );
  } finally {
    await browser.close();
  }

  try {
    fs.unlinkSync(PROJECT_NAME_FILE_PATH);
  } catch {
    // already gone — fine.
  }
}