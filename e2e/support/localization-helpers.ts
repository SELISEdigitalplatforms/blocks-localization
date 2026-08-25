import fs from "fs"
import path from "path"
import { expect, type Page } from "@playwright/test"
import { openNamedProjectDashboard } from "./create-and-delete-project"
import { e2eBaseUrl } from "./env"
import { ensureAuthenticated, isLoginSurface } from "./login-helper"
import {
  LOCALIZATION_SESSION_PATH,
  readLocalizationProject,
} from "./localization-project"
import { openSharedProjectDashboard } from "./suite-helpers"

/**
 * Localization in-app routes (Overview is dashboard; everything else is under /services/).
 *
 * Examples:
 * - Overview → /app/{id}/dashboard
 * - Translations → /app/{id}/services/language
 * - Modules → /app/{id}/services/modules
 */
export type LocalizationRoute =
  | "dashboard"
  | "services/language"
  | "services/modules"
  | "services/glossary"
  | "services/configure"
  | "services/extension-guides"

const ROUTE_NAV_LINK: Record<Exclude<LocalizationRoute, "dashboard">, string> = {
  "services/language": "Translations",
  "services/modules": "Modules",
  "services/glossary": "Glossary",
  "services/configure": "Configuration",
  "services/extension-guides": "Extension Guides",
}

const ROUTE_HEADING: Record<LocalizationRoute, string | null> = {
  dashboard: "Project Details",
  "services/language": "Configure keys",
  "services/modules": "Language Modules",
  "services/glossary": "Glossary Management",
  "services/configure": "Configure Languages",
  "services/extension-guides": "Extension Guides",
}

export function buildProjectRouteUrl(itemId: string, route: string) {
  const normalizedRoute = route.replace(/^\//, "")
  return `${e2eBaseUrl()}/app/${itemId}/${normalizedRoute}`
}

function readyLocator(page: Page, route: LocalizationRoute) {
  if (route === "dashboard") {
    return page
      .getByRole("heading", { name: "Project Details" })
      .or(page.getByText(/X-Blocks-Key/))
      .first()
  }
  const heading = ROUTE_HEADING[route]
  return heading ? page.getByRole("heading", { name: heading }) : null
}

async function persistSuiteSession(page: Page) {
  fs.mkdirSync(path.dirname(LOCALIZATION_SESSION_PATH), { recursive: true })
  await page.context().storageState({ path: LOCALIZATION_SESSION_PATH })
}

async function reseedThenGoto(page: Page, targetUrl: string, projectName: string, dashboardUrl?: string) {
  await openNamedProjectDashboard(page, projectName, { dashboardUrl })
  await persistSuiteSession(page)
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" })
}

/**
 * Open a localization project route via direct URL.
 *
 * Happy path: `goto(/app/{itemId}/dashboard)` or `goto(/app/{itemId}/services/...)`.
 * Recovery: login / console bounce → one env-chip reseed → goto again.
 */
export async function openProjectRoute(page: Page, route: LocalizationRoute | string = "dashboard") {
  const fixture = readLocalizationProject()
  if (!fixture?.itemId) {
    throw new Error(
      "Missing fixtures/localization-project.json — run localization-setup first (suite.setup.spec.ts).",
    )
  }

  const normalizedRoute = route.replace(/^\//, "") as LocalizationRoute
  const targetUrl = buildProjectRouteUrl(fixture.itemId, normalizedRoute)
  const ready = readyLocator(page, normalizedRoute)
  const fixtureDashboardUrl = fixture.dashboardUrl || buildProjectRouteUrl(fixture.itemId, "dashboard")

  const gotoTarget = async () => {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" })
  }

  await gotoTarget()

  if (await isLoginSurface(page)) {
    await ensureAuthenticated(page)
    await reseedThenGoto(page, targetUrl, fixture.projectName, fixtureDashboardUrl)
  } else if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
    await reseedThenGoto(page, targetUrl, fixture.projectName, fixtureDashboardUrl)
  }

  if (ready && (await ready.isVisible({ timeout: 12_000 }).catch(() => false))) {
    await persistSuiteSession(page)
    return { projectName: fixture.projectName }
  }

  // Soft-bounce or stale context — reseed once, then prefer sidebar for service routes.
  if (await isLoginSurface(page)) {
    await ensureAuthenticated(page)
  }
  await openNamedProjectDashboard(page, fixture.projectName, {
    dashboardUrl: fixtureDashboardUrl,
  })
  await persistSuiteSession(page)

  const navLink =
    normalizedRoute !== "dashboard"
      ? ROUTE_NAV_LINK[normalizedRoute as Exclude<LocalizationRoute, "dashboard">]
      : undefined

  if (navLink) {
    await page.getByRole("link", { name: navLink }).click()
  } else {
    await gotoTarget()
  }

  if (ready) {
    await expect(ready).toBeVisible({ timeout: 30_000 })
  }

  return { projectName: fixture.projectName }
}

export async function openLocalizationConsole(page: Page) {
  await ensureAuthenticated(page)
  await expect(
    page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
  ).toBeVisible({ timeout: 30_000 })
}

export async function openLocalizationDashboard(page: Page) {
  await openSharedProjectDashboard(page)
}

export async function openProjectDashboard(page: Page) {
  return openProjectRoute(page, "dashboard")
}

export async function openTranslations(page: Page) {
  return openProjectRoute(page, "services/language")
}

export async function openModules(page: Page) {
  return openProjectRoute(page, "services/modules")
}

export async function openGlossary(page: Page) {
  return openProjectRoute(page, "services/glossary")
}

export async function openConfiguration(page: Page) {
  return openProjectRoute(page, "services/configure")
}

export async function openExtensionGuides(page: Page) {
  return openProjectRoute(page, "services/extension-guides")
}
