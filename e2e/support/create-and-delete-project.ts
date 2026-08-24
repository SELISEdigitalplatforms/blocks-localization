import { Page, expect, test } from "@playwright/test"
import { e2eBaseUrl, e2eOsBaseUrl, e2eProjectId } from "./env"
import { ensureAuthenticated, ensureAuthenticatedOnCurrentOrigin, loginThroughOidc } from "./login-helper"

const ENV_BUTTON =
  /Development|Testing|Staging|IAT|UAT|Production|Pre-Prod|Prod Shadow/

const isVisibleNow = async (locator: {
  isVisible: (opts: { timeout: number }) => Promise<boolean>
}) => locator.isVisible({ timeout: 500 }).catch(() => false)

function getBaseProjectName(): string {
  return process.env.PROJECT_NAME?.trim() || "Test Project"
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getOrphanProjectPattern(): RegExp {
  return new RegExp(`${escapeRegExp(getBaseProjectName())} \\d+`, "g")
}

async function listOrphanProjectNames(page: Page): Promise<string[]> {
  const bodyText = await page.locator("body").innerText().catch(() => "")
  return [...new Set([...bodyText.matchAll(getOrphanProjectPattern())].map((match) => match[0]))]
}

function consoleBase(host: "localization" | "os" = "localization") {
  return host === "os" ? e2eOsBaseUrl() : e2eBaseUrl()
}

async function ensureLoggedIn(page: Page) {
  if (/\/login(?:\/|$|\?)/.test(new URL(page.url()).pathname)) {
    await loginThroughOidc(page)
  }
}
export async function ensureConsole(page: Page, host: "localization" | "os" = "localization") {
  const base = consoleBase(host)
  const href = page.url()
  const onConsole =
    /^https?:/.test(href) &&
    new URL(href).origin === new URL(base).origin &&
    /\/app\/console\/?$/.test(new URL(href).pathname)

  if (!onConsole) {
    await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
  }

  await ensureLoggedIn(page)

  await expect(
    page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
  ).toBeVisible({ timeout: 20_000 })
}

export function namedProjectCard(page: Page, projectName: string) {
  return page
    .locator("div")
    .filter({ has: page.getByText(projectName, { exact: true }) })
    .filter({
      has: page.getByRole("button", { name: ENV_BUTTON }),
    })
    .last()
}

/** Prod localization console sometimes renders a flat name + env-button list. */
function flatProjectBlock(page: Page, projectName: string) {
  return page
    .locator("main")
    .getByText(projectName, { exact: true })
    .locator("xpath=ancestor::*[.//button[contains(., 'Development') or contains(., 'Testing') or contains(., 'Staging') or contains(., 'Production')]][1]")
}

async function clickProjectEnvironment(
  page: Page,
  projectName: string,
  host: "localization" | "os" = "localization",
) {
  await ensureConsole(page, host)

  const card = namedProjectCard(page, projectName)
  if (await card.isVisible({ timeout: 1_500 }).catch(() => false)) {
    const envButton = card.getByRole("button", { name: ENV_BUTTON }).first()
    await expect(envButton).toBeVisible({ timeout: 10_000 })
    await envButton.click({ force: true })
    return
  }

  const flatBlock = flatProjectBlock(page, projectName)
  const flatEnvButton = flatBlock.getByRole("button", { name: ENV_BUTTON }).first()
  await expect(flatEnvButton).toBeVisible({ timeout: 10_000 })
  await flatEnvButton.click({ force: true })
}

/** Enter project dashboard from console in one pass (feature-test navigation). */
export async function enterProjectFromConsole(page: Page, projectName: string) {
  await waitForProjectCard(page, projectName, "localization")
  await clickProjectEnvironment(page, projectName, "localization")
  await waitForLocalizationDashboardReady(page)
}

async function waitForProjectCard(
  page: Page,
  projectName: string,
  host: "localization" | "os" = "localization",
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    await ensureConsole(page, host)

    if (
      await page
        .locator("main")
        .getByText(projectName, { exact: true })
        .isVisible({ timeout: 1_500 })
        .catch(() => false)
    ) {
      return
    }

    if (attempt < 5) {
      await page.reload({ waitUntil: "domcontentloaded" })
      await page.waitForTimeout(500)
    }
  }

  throw new Error(`Project "${projectName}" did not appear on the ${host} console`)
}

/** Localization project dashboard — Project Details / X-Blocks-Key. */
async function waitForLocalizationDashboardReady(page: Page) {
  await expect(async () => {
    await ensureLoggedIn(page)
    await expect(page).toHaveURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 5_000 })
    await expect(
      page
        .getByRole("heading", { name: "Project Details" })
        .or(page.getByText(/X-Blocks-Key/))
        .first(),
    ).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 30_000 })
}

/** OS project dashboard — project name heading + Delete button. */
async function waitForOsDashboardReady(page: Page, projectName: string) {
  await expect(page).toHaveURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 20_000 })
  await expect(page.getByRole("heading", { name: projectName })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeVisible({
    timeout: 20_000,
  })
}

async function readProjectNameFromDashboard(page: Page): Promise<string> {
  const sidebarProject = page.getByRole("button", { name: /^Project / })
  if (await sidebarProject.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const label = await sidebarProject.innerText()
    return label.replace(/^Project\s+/i, "").trim()
  }

  const details = page
    .locator("main")
    .filter({ has: page.getByRole("heading", { name: "Project Details" }) })
  const nameBlock = details.getByText(/^Name\s+\S/, { exact: false }).first()
  if (await nameBlock.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return (await nameBlock.innerText()).replace(/^Name\s+/, "").trim()
  }

  throw new Error(`Could not read project name from dashboard: ${page.url()}`)
}

async function openProjectById(page: Page, projectId: string) {
  await page.goto(`${e2eBaseUrl()}/app/${projectId}/dashboard`, { waitUntil: "domcontentloaded" })
  await waitForLocalizationDashboardReady(page)
  const projectName = await readProjectNameFromDashboard(page)
  return { projectName, dashboardUrl: page.url(), itemId: projectId }
}

export async function openNamedProjectDashboard(
  page: Page,
  projectName: string,
  options?: { dashboardUrl?: string; itemId?: string },
) {
  if (options?.dashboardUrl) {
    await page.goto(options.dashboardUrl, { waitUntil: "domcontentloaded" })
    await ensureLoggedIn(page)
    try {
      await waitForLocalizationDashboardReady(page)
      return
    } catch {
      // Fall through to card navigation.
    }
  }

  let lastError: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await ensureLoggedIn(page)
      await waitForProjectCard(page, projectName, "localization")
      await clickProjectEnvironment(page, projectName, "localization")
      await waitForLocalizationDashboardReady(page)
      return
    } catch (error) {
      lastError = error
      if (attempt < 2) {
        await page.waitForTimeout(500)
      }
    }
  }

  const dashboardUrl =
    options?.dashboardUrl ??
    (options?.itemId ? `${e2eBaseUrl()}/app/${options.itemId}/dashboard` : null)
  if (dashboardUrl) {
    await ensureLoggedIn(page)
    await page.goto(dashboardUrl, { waitUntil: "domcontentloaded" })
    await ensureLoggedIn(page)
    await page.reload({ waitUntil: "domcontentloaded" })
    await waitForLocalizationDashboardReady(page)
    return
  }

  throw lastError
}

async function openOsProjectDashboard(page: Page, projectName: string) {
  await ensureConsole(page, "os")

  for (let attempt = 0; attempt < 3; attempt++) {
    await waitForProjectCard(page, projectName, "os")
    await clickProjectEnvironment(page, projectName, "os")

    try {
      await waitForOsDashboardReady(page, projectName)
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}

async function deleteProjectOnOs(page: Page, projectName: string): Promise<boolean> {
  await page.goto(`${e2eOsBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" })
  await ensureAuthenticatedOnCurrentOrigin(page)
  await openOsProjectDashboard(page, projectName)

  await page.getByRole("button", { name: "Delete", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Delete this environment?" })).toBeVisible()
  await page.getByRole("button", { name: "Delete", exact: true }).last().click()
  await expect(page.getByText("Successfully deleted", { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page).toHaveURL(/\/app\/console$/, { timeout: 15_000 })
  return true
}

async function freeProjectSlotIfNeeded(page: Page) {
  await ensureConsole(page, "localization")

  const welcomeHeading = page.getByRole("heading", { name: "Welcome to SELISE Blocks" })
  if (await isVisibleNow(welcomeHeading)) return

  const addProjectButton = page.getByText("Add Project", { exact: true }).first()
  if (await isVisibleNow(addProjectButton)) return

  const atProjectLimit = page.getByText("Please delete an existing project to create a new one.")
  if (!(await isVisibleNow(atProjectLimit))) return

  for (let attempt = 0; attempt < 8; attempt++) {
    const orphanNames = await listOrphanProjectNames(page)
    if (orphanNames.length === 0) break

    await deleteCreatedProject(page, orphanNames[0]).catch(() => {})
    await ensureConsole(page, "localization")

    if (await isVisibleNow(addProjectButton)) return
  }

  await expect(addProjectButton).toBeVisible({ timeout: 15_000 })
}

/**
 * Creates a project via the OS-hosted wizard (Localization redirects to OS for this).
 */
export async function createProject(page: Page) {
  await test.step("Start a new project (redirects to OS)", async () => {
    await ensureAuthenticated(page)
    await ensureConsole(page, "localization")

    const welcomeHeading = page.getByRole("heading", { name: "Welcome to SELISE Blocks" })
    const createProjectButton = page.getByRole("button", { name: "Create a project" })
    const addProjectButton = page.getByText("Add Project", { exact: true }).first()

    await freeProjectSlotIfNeeded(page)

    if (await welcomeHeading.isVisible().catch(() => false)) {
      await createProjectButton.click()
    } else {
      await expect(addProjectButton).toBeVisible({ timeout: 15_000 })
      await addProjectButton.click()
    }

    await page.waitForURL(/\/app\/create-project$/, { timeout: 30_000 })
  })

  const baseProjectName = getBaseProjectName()
  const projectName = `${baseProjectName} ${Date.now()}`
  await test.step("Name the project and accept the agreements", async () => {
    await expect(page.getByRole("heading", { name: "Name your project" })).toBeVisible({
      timeout: 30_000,
    })
    const nameInput = page.locator('[placeholder="Enter your project name"]:visible')
    await nameInput.fill(projectName)

    await page.getByRole("checkbox", { name: "I confirm that I will use" }).click()
    await page.getByRole("checkbox", { name: "I accept the Terms of services" }).click()

    const continueButton = page.getByRole("button", { name: "Continue", exact: true })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
  })

  await test.step("Skip optional repositories", async () => {
    await expect(page.getByRole("heading", { name: "Add resource" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Continue", exact: true }).click()
  })

  await test.step("Select Development and submit", async () => {
    await expect(
      page.getByText("Select environments", { exact: true }).and(page.locator(":visible")),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByText("Development", { exact: true }).and(page.locator(":visible")).click()
    const submitButton = page.getByRole("button", { name: "Submit" })
    await expect(submitButton).toBeEnabled()
    await submitButton.click()
  })

  await test.step("Wait for create success (on OS)", async () => {
    await expect(page.getByText("Your project has been created.", { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page).toHaveURL(/\/app\/(console|project\/[^/]+\/environments)\/?$/, {
      timeout: 20_000,
    })
  })

  await test.step("Open project dashboard on Localization", async () => {
    await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" })
    await ensureAuthenticated(page)
    await ensureConsole(page, "localization")
    await openNamedProjectDashboard(page, projectName)
  })

  return { projectName, dashboardUrl: page.url() }
}

/** Reuse an existing project, or create one when Add Project is available. */
export async function reuseOrCreateSharedProject(
  page: Page,
): Promise<{ projectName: string; dashboardUrl: string; itemId: string }> {
  await ensureAuthenticated(page)

  const configuredProjectId = e2eProjectId()
  if (configuredProjectId) {
    console.log(`[e2e] Using E2E_PROJECT_ID=${configuredProjectId}`)
    return openProjectById(page, configuredProjectId)
  }

  await ensureConsole(page, "localization")

  const reuseName = process.env.E2E_REUSE_PROJECT_NAME?.trim()
  if (reuseName) {
    console.log(`[e2e] Reusing E2E_REUSE_PROJECT_NAME=${reuseName}`)
    await openNamedProjectDashboard(page, reuseName)
    const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
    return { projectName: reuseName, dashboardUrl: page.url(), itemId }
  }

  // Default: create a new project each run (e.g. PROD-TEST 1787…).
  const welcomeHeading = page.getByRole("heading", { name: "Welcome to SELISE Blocks" })
  const addProjectButton = page.getByText("Add Project", { exact: true }).first()
  const canCreate =
    (await welcomeHeading.isVisible({ timeout: 2_000 }).catch(() => false)) ||
    (await addProjectButton.isVisible({ timeout: 2_000 }).catch(() => false))

  if (canCreate) {
    console.log(`[e2e] Creating new project (prefix: ${getBaseProjectName()})`)
    const created = await createProject(page)
    const itemId = new URL(created.dashboardUrl).pathname.split("/")[2] ?? ""
    console.log(`[e2e] Created project "${created.projectName}" → ${created.dashboardUrl}`)
    return { ...created, itemId }
  }

  // Console full — reuse the newest orphan from this test prefix as a last resort.
  const testProjects = await listOrphanProjectNames(page)
  if (testProjects.length > 0) {
    const projectName = testProjects[testProjects.length - 1]!
    console.warn(
      `[e2e] Add Project unavailable — reusing orphan "${projectName}" (set E2E_REUSE_PROJECT_NAME to pin a project)`,
    )
    await openNamedProjectDashboard(page, projectName)
    const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
    return { projectName, dashboardUrl: page.url(), itemId }
  }

  throw new Error(
    "No project to reuse and Add Project is unavailable. " +
      "Set E2E_REUSE_PROJECT_NAME (e.g. test) or E2E_PROJECT_ID, or free a console slot.",
  )
}

/** Delete project on Blocks OS (only place with project Delete UI). */
export async function deleteCreatedProject(
  page: Page,
  projectName?: string,
  options?: { itemId?: string },
): Promise<boolean> {
  if (!projectName) return false
  void options

  return test.step("Delete project on Blocks OS", async () => {
    try {
      const deleted = await deleteProjectOnOs(page, projectName)
      if (deleted) {
        await ensureConsole(page, "os")
        await expect(page.getByText(projectName, { exact: true })).toHaveCount(0, {
          timeout: 10_000,
        })
      }
      return deleted
    } catch (error) {
      console.warn(`[e2e] Failed to delete project "${projectName}" on OS:`, error)
      return false
    }
  })
}
