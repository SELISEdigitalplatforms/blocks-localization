import fs from "fs";
import path from "path";
import { chromium } from "@playwright/test";
import { deleteCreatedProject } from "./support/create-and-delete-project";
import { e2eOsBaseUrl } from "./support/env";

// fixtures/auth.json is the login/logout smoke test's session -- it's
// revoked by the logout login.spec.ts performs right after saving it.
// fixtures/flow-session.json (from flow.setup.spec.ts) is the live session.
const AUTH_FILE = "fixtures/flow-session.json";
const PROJECT_NAME_FILE_PATH = path.resolve(__dirname, "fixtures/project-name.json");

interface ProjectNameFile {
  projectName: string;
  // false (or absent, for older fixtures) means this project was reused, not
  // created by this run -- e.g. E2E_REUSE_PROJECT_NAME points at a real,
  // deliberately named project. Never auto-delete one of those.
  wasCreated?: boolean;
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
  let wasCreated: boolean;
  try {
    const raw = fs.readFileSync(PROJECT_NAME_FILE_PATH, "utf8");
    const parsed = JSON.parse(raw) as ProjectNameFile;
    projectName = parsed.projectName;
    if (!projectName) throw new Error("missing projectName field");
    wasCreated = parsed.wasCreated === true;
  } catch (err) {
    console.warn(
      `[e2e teardown] Failed to read project name from ${PROJECT_NAME_FILE_PATH}: ${err}. Skipping cleanup.`,
    );
    return;
  }

  if (!wasCreated) {
    console.log(
      `[e2e teardown] "${projectName}" was reused, not created by this run — leaving it in place.`,
    );
    try {
      fs.unlinkSync(PROJECT_NAME_FILE_PATH);
    } catch {
      // already gone — fine.
    }
    return;
  }

  let osBaseUrl: string;
  try {
    osBaseUrl = e2eOsBaseUrl();
  } catch (err) {
    console.warn(`[e2e teardown] ${err} — skipping project deletion.`);
    return;
  }

  console.log(`[e2e teardown] Deleting project "${projectName}"...`);

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL: osBaseUrl,
      storageState: AUTH_FILE,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    const deleted = await deleteCreatedProject(page, projectName);
    if (deleted) {
      console.log(`[e2e teardown] Deleted project "${projectName}".`);
    }
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