import { env } from "@/config/env";

/** sessionStorage key — OAuth `access_token` for cross-origin local API (see `local-api-bearer` design). */
const SESSION_KEY = "blocks_local_api_oauth_access_token";

function normalizeBase(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** True when `idpRequest` is targeting the configured local API origin (`BLOCKS_API_BASE_URL_LOCAL`). */
export function isRequestToLocalApiBase(baseOverride?: string): boolean {
  const local = normalizeBase(env.apiBaseUrlLocal);
  if (!local) return false;
  const requested = normalizeBase(baseOverride ?? "");
  return requested.length > 0 && requested === local;
}

export function persistLocalApiBearerFromOAuthBody(body: unknown): void {
  if (!body || typeof body !== "object") return;
  const token = (body as { access_token?: unknown }).access_token;
  if (typeof token !== "string" || token.length === 0) return;
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    /* storage may be unavailable */
  }
}

export function clearLocalApiBearerSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Bearer for requests to `BLOCKS_API_BASE_URL_LOCAL`: optional env override, else OAuth token saved at login.
 */
export function getLocalApiBearerToken(): string | null {
  const fromEnv = env.localApiBearer.trim();
  if (fromEnv.length > 0) return fromEnv;
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
