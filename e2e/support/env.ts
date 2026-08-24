function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "")
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. Fill it in e2e/.env.e2e.`)
  }
  return value
}

/** Blocks Localization app under test (`E2E_BASE_URL`). */
export function e2eBaseUrl(): string {
  return stripTrailingSlash(requireEnv("E2E_BASE_URL"))
}

export function e2eProjectId(): string | undefined {
  const value = process.env.E2E_PROJECT_ID?.trim()
  return value || undefined
}

/**
 * Derive Blocks OS origin from the Localization base URL.
 *
 * | Localization (`E2E_BASE_URL`)                          | OS (derived)                               |
 * |--------------------------------------------------------|--------------------------------------------|
 * | https://dev-localization.blocksdevelopers.com[:port]   | https://dev-os.blocksdevelopers.com[:port] |
 * | https://localization.seliseblocks.com                  | https://os.seliseblocks.com                |
 *
 * Override anytime with `E2E_OS_BASE_URL`.
 */
export function deriveOsBaseUrlFromLocalization(localizationBaseUrl: string): string | undefined {
  let url: URL
  try {
    url = new URL(localizationBaseUrl)
  } catch {
    return undefined
  }

  if (/^dev-localization\./i.test(url.hostname)) {
    url.hostname = url.hostname.replace(/^dev-localization\./i, "dev-os.")
    return stripTrailingSlash(url.origin)
  }

  if (/^localization\./i.test(url.hostname)) {
    url.hostname = url.hostname.replace(/^localization\./i, "os.")
    return stripTrailingSlash(url.origin)
  }

  return undefined
}

/** Blocks OS — create-project wizard + project delete (Localization has no Delete UI). */
export function e2eOsBaseUrl(): string {
  const explicit = process.env.E2E_OS_BASE_URL?.trim()
  if (explicit) return stripTrailingSlash(explicit)

  const derived = deriveOsBaseUrlFromLocalization(e2eBaseUrl())
  if (derived) return derived

  throw new Error(
    "E2E_OS_BASE_URL is not set and could not be derived from E2E_BASE_URL. " +
      "Examples:\n" +
      "  Dev:  E2E_BASE_URL=https://dev-localization.blocksdevelopers.com  → OS https://dev-os.blocksdevelopers.com\n" +
      "  Prod: E2E_BASE_URL=https://localization.seliseblocks.com          → OS https://os.seliseblocks.com\n" +
      "Or set E2E_OS_BASE_URL explicitly in e2e/.env.e2e.",
  )
}

export function e2eCredentials(): { email: string; password: string } {
  return {
    email: requireEnv("E2E_USERNAME"),
    password: requireEnv("E2E_PASSWORD"),
  }
}

export function e2eTestEmailDomain(): string {
  return process.env.E2E_TEST_EMAIL_DOMAIN ?? "example.com"
}

export function uniqueTestEmail(localPart = "e2e"): string {
  return `${localPart}.${Date.now()}@${e2eTestEmailDomain()}`
}
