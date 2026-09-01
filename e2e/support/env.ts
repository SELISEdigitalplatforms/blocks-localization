export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. Fill it in e2e/.env.e2e.`);
  }
  return value;
}

export function e2eBaseUrl(): string {
  return requireEnv("E2E_BASE_URL");
}

export function e2eProjectId(): string | undefined {
  const value = process.env.E2E_PROJECT_ID?.trim();
  return value || undefined;
}

/**
 * Shared project to reuse for the flow specs, instead of creating a fresh
 * one each run.
 *
 * A freshly-created project's Development environment isn't reliably
 * enterable for several minutes after creation on this tenant (confirmed:
 * the same project failed to open for 3+ minutes across 5 retries right
 * after creation, then opened in under a minute once it had sat for a
 * while) -- a genuine backend provisioning delay, not a test bug. Until
 * that's resolved, default to reusing "Testing" rather than a
 * create-then-immediately-use cycle that can't reliably fit in a sane test
 * timeout. E2E_REUSE_PROJECT_NAME still overrides this if set.
 */
export function e2eReuseProjectName(): string {
  return process.env.E2E_REUSE_PROJECT_NAME?.trim() || "Testing";
}

/** Blocks OS — project delete only (Logic has no project Delete UI). */
export function e2eOsBaseUrl(): string {
  const explicit = process.env.E2E_OS_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  const logic = e2eBaseUrl();
  if (/dev-localization/i.test(logic)) {
    return logic.replace(/dev-localization/i, "dev-os");
  }

  throw new Error(
    "E2E_OS_BASE_URL is not set and could not be derived from E2E_BASE_URL. " +
      "Set E2E_OS_BASE_URL in e2e/.env.e2e (e.g. https://dev-os.blocksdevelopers.com).",
  );
}

export function e2eCredentials(): { email: string; password: string } {
  return {
    email: requireEnv("E2E_USERNAME"),
    password: requireEnv("E2E_PASSWORD"),
  };
}

export function e2eTestEmailDomain(): string {
  return process.env.E2E_TEST_EMAIL_DOMAIN ?? "example.com";
}

export function uniqueTestEmail(localPart = "e2e"): string {
  return `${localPart}.${Date.now()}@${e2eTestEmailDomain()}`;
}
