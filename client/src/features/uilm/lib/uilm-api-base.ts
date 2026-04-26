import { env } from "@/config/env";
import type { IdpRequestOptions } from "@/platform/api/idp-http";

/**
 * Base URL for UILM API calls. When `BLOCKS_API_BASE_URL_LOCAL` is set in `client/.env`,
 * UILM uses **only** that origin (not `BLOCKS_API_BASE_URL`).
 * Cookies from the remote IdP are not sent to another origin; `idp-http` adds `Authorization: Bearer`
 * for that local origin when a token was saved at login (`local-api-bearer.ts`).
 */
export function getUilmApiBaseUrl(): string {
  const local = env.apiBaseUrlLocal.trim().replace(/\/$/, "");
  if (local.length > 0) return local;
  return env.apiBaseUrl.replace(/\/$/, "");
}

/** Pass into `idpGet` / `idpPostJson` / `idpDelete` from UILM services so requests hit the UILM base above. */
export function uilmIdpOptions(): IdpRequestOptions {
  const local = env.apiBaseUrlLocal.trim().replace(/\/$/, "");
  if (!local) return {};
  return { baseUrl: local };
}
