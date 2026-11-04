import type { Browser, BrowserContext, Page } from "@playwright/test"
import { buildProjectRouteUrl } from "./localization-helpers"
import { readLocalizationProject } from "./localization-project"
import { loginThroughOidc } from "./login-helper"

/**
 * Extra test accounts (SPEC15 §10), each a member of the shared project:
 * - restricted: glossary gets/save/delete, no `key::gets`;
 * - readonly: glossary gets/delete and `key::gets`, no `glossary::save`.
 */
export type E2eIdentity = "restricted" | "readonly"

const ENV_PREFIX: Record<E2eIdentity, string> = {
  restricted: "E2E_RESTRICTED",
  readonly: "E2E_READONLY",
}

export function identityCredentials(identity: E2eIdentity) {
  const prefix = ENV_PREFIX[identity]
  const email = process.env[`${prefix}_USERNAME`]?.trim()
  const password = process.env[`${prefix}_PASSWORD`]
  return email && password ? { email, password } : null
}

export function missingIdentityReason(identity: E2eIdentity) {
  const prefix = ENV_PREFIX[identity]
  return `Set ${prefix}_USERNAME and ${prefix}_PASSWORD in e2e/.env.e2e.`
}

/** Logs the identity in through a fresh context and opens a route of the shared project. */
export async function openProjectRouteAs(
  browser: Browser,
  identity: E2eIdentity,
  route: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const credentials = identityCredentials(identity)
  if (!credentials) throw new Error(missingIdentityReason(identity))
  const project = readLocalizationProject()
  if (!project?.itemId) {
    throw new Error("Missing fixtures/localization-project.json — run localization-setup first.")
  }
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  await loginThroughOidc(page, { credentials })
  await page.goto(buildProjectRouteUrl(project.itemId, route), { waitUntil: "domcontentloaded" })
  return { context, page }
}
