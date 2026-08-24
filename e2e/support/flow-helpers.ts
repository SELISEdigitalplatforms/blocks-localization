import { expect, type Page } from "@playwright/test"
import { enterProjectFromConsole } from "./create-and-delete-project"
import { e2eBaseUrl } from "./env"
import { loginThroughOidc } from "./login-helper"
import { FLOW_SESSION_PATH, readFlowProject } from "./flow-project"

/** Sidebar labels from client/app/constants/navigation-menus.ts */
const ROUTE_NAV_LINK: Record<string, string> = {
  "services/language": "Translations",
  "services/modules": "Modules",
  "services/glossary": "Glossary",
  "services/configure": "Configuration",
  "services/extension-guides": "Extension Guides",
}

/** Headings shown when each route has loaded (from client page components). */
const ROUTE_HEADING: Record<string, string> = {
  dashboard: "Project Details",
  "services/language": "Configure keys",
  "services/modules": "Language Modules",
  "services/glossary": "Glossary Management",
  "services/configure": "Configure Languages",
  "services/extension-guides": "Extension Guides",
}

/** e.g. /app/{itemId}/services/language */
export function buildProjectRouteUrl(itemId: string, route: string) {
  const normalizedRoute = route.replace(/^\//, "")
  return `${e2eBaseUrl()}/app/${itemId}/${normalizedRoute}`
}

function isLoginPage(page: Page) {
  return /\/login(?:\/|$|\?)/.test(new URL(page.url()).pathname)
}

function isConsolePage(page: Page) {
  return /\/app\/console\/?$/.test(new URL(page.url()).pathname)
}

function isOnProjectRoute(page: Page, itemId: string, route: string) {
  return new URL(page.url()).pathname.includes(`/app/${itemId}/${route.replace(/^\//, "")}`)
}

function readyLocator(page: Page, route: string) {
  if (route === "dashboard") {
    return page
      .getByRole("heading", { name: "Project Details" })
      .or(page.getByText(/X-Blocks-Key/))
      .first()
  }
  const heading = ROUTE_HEADING[route]
  return heading ? page.getByRole("heading", { name: heading }) : null
}

async function saveSession(page: Page) {
  await page.context().storageState({ path: FLOW_SESSION_PATH })
}

/**
 * Open a project-scoped page (overview, translations, modules, etc.).
 *
 * Prod often rejects cold deep links like /app/{itemId}/services/language and
 * sends the browser to /login or /app/console. Recover by logging in again,
 * opening the shared setup project from the console, then navigating to the route.
 */
export async function openProjectRoute(page: Page, route = "dashboard") {
  const fixture = readFlowProject()
  if (!fixture?.itemId) {
    throw new Error("Missing fixtures/project-name.json — run localization-setup first.")
  }

  const normalizedRoute = route.replace(/^\//, "")
  const targetUrl = buildProjectRouteUrl(fixture.itemId, normalizedRoute)
  const ready = readyLocator(page, normalizedRoute)
  const navLink = ROUTE_NAV_LINK[normalizedRoute]

  const gotoTarget = async () => {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" })
  }

  /** Logged out or stuck on console — login and open the project created in setup. */
  const loginAndEnterSharedProject = async () => {
    await loginThroughOidc(page)
    await saveSession(page)
    await enterProjectFromConsole(page, fixture.projectName)
  }

  await gotoTarget()

  if (isLoginPage(page)) {
    await loginAndEnterSharedProject()
    await gotoTarget()
  } else if (isConsolePage(page)) {
    await enterProjectFromConsole(page, fixture.projectName)
    await gotoTarget()
  }

  if (ready && (await ready.isVisible({ timeout: 8_000 }).catch(() => false))) {
    return { projectName: fixture.projectName }
  }

  // Still not on the page — session likely expired mid-suite; login + project + sidebar.
  if (!isLoginPage(page) && !isConsolePage(page)) {
    await loginAndEnterSharedProject()
  } else if (isLoginPage(page)) {
    await loginAndEnterSharedProject()
  } else if (isConsolePage(page)) {
    await enterProjectFromConsole(page, fixture.projectName)
  }

  if (navLink && normalizedRoute !== "dashboard") {
    await page.getByRole("link", { name: navLink }).click()
  } else {
    await gotoTarget()
  }

  if (ready) {
    await expect(ready).toBeVisible({ timeout: 30_000 })
  }

  return { projectName: fixture.projectName }
}

export async function openProjectDashboard(page: Page) {
  return openProjectRoute(page, "dashboard")
}
