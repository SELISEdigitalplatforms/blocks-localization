import { Page, expect } from "@playwright/test";
import { readFlowProject } from "./flow-project";

/**
 * Opens the shared project's Development environment dashboard.
 *
 * Navigates straight to the dashboardUrl saved by flow.setup.spec.ts. That
 * fixture's session (fixtures/flow-session.json) is captured AFTER
 * flow-setup successfully enters the environment, so it already carries
 * whatever the one successful impersonation call granted -- this should
 * load as already-impersonated rather than triggering a fresh impersonate
 * call per spec, which is rate-limited (see flow.setup.spec.ts).
 */
export async function openProjectDashboard(page: Page) {
  const fixture = readFlowProject();
  if (!fixture) {
    throw new Error("Flow project fixture not found. Did flow-setup run?");
  }

  await page.goto(fixture.dashboardUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Project Details" })).toBeVisible({
    timeout: 30_000,
  });

  return { projectName: fixture.projectName };
}
