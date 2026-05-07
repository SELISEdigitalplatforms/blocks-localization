const ENV_PREFIX_PATTERN = /^(dev-|stg-)/;

/**
 * Derives IDP/UDS/Utility base URLs from the current browser origin.
 * This is the primary approach — the browser URL always reflects the
 * correct environment (dev/stg/prod) regardless of server injection issues.
 *
 * Dev:    https://dev-eurolm.blocksdevelopers.com  → https://dev-idp.blocksdevelopers.com
 * Staging: https://stg-eurolm.blocksdevelopers.com → https://stg-idp.blocksdevelopers.com
 * Prod:   https://eurolm.blocksdevelopers.com       → https://idp.blocksdevelopers.com
 */
function deriveBaseUrl(subdomain: string): string {
  if (typeof window === "undefined") {
    return `https://${subdomain}.blocksdevelopers.com`;
  }

  const origin = window.location.origin; // e.g. "https://dev-eurolm.blocksdevelopers.com"
  const match = origin.match(/^https?:\/\/([^/]+)/);
  if (!match) {
    return `https://${subdomain}.blocksdevelopers.com`;
  }

  const host = match[1]; // e.g. "dev-eurolm.blocksdevelopers.com"
  const prefix = host.match(ENV_PREFIX_PATTERN)?.[1] ?? "";
  const derived = prefix ? `${prefix}${subdomain}` : subdomain;

  return `https://${derived}.blocksdevelopers.com`;
}

export function deriveIdpBaseUrl(): string {
  return deriveBaseUrl("idp");
}

export function deriveUdsBaseUrl(): string {
  return deriveBaseUrl("uds");
}

export function deriveLogicBaseUrl(): string {
  return deriveBaseUrl("logic");
}
