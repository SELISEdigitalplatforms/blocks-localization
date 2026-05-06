const ENV_PREFIX_PATTERN = /^(dev-|stg-)/;

/**
 * Handles local dev proxy format: http://dev-eurolm.blocksdevelopers.com:5000
 * Extracts env prefix and strips port to produce the real deployed HTTPS URL.
 *
 * Dev:    http://dev-eurolm.blocksdevelopers.com:5000   → https://dev-idp.blocksdevelopers.com
 * Staging: http://stg-eurolm.blocksdevelopers.com:5000  → https://stg-idp.blocksdevelopers.com
 * Prod:   https://eurolm.blocksdevelopers.com           → https://idp.blocksdevelopers.com
 */
function deriveBaseUrl(apiBaseUrl: string, subdomain: string): string {
  // Match: protocol://host(:port), where host may contain dots
  const match = apiBaseUrl.match(/^https?:\/\/([^/:]+)(:\d+)?/);
  if (!match) {
    return `https://${subdomain}.blocksdevelopers.com`;
  }

  const host = match[1]; // e.g. "dev-eurolm.blocksdevelopers.com" or "eurolm.blocksdevelopers.com"

  // Extract env prefix from host (dev- or stg-)
  const prefix = host.match(ENV_PREFIX_PATTERN)?.[1] ?? "";
  const derived = prefix ? `${prefix}${subdomain}` : subdomain;

  return `https://${derived}.blocksdevelopers.com`;
}

export function deriveIdpBaseUrl(apiBaseUrl: string): string {
  return deriveBaseUrl(apiBaseUrl, "idp");
}

export function deriveUdsBaseUrl(apiBaseUrl: string): string {
  return deriveBaseUrl(apiBaseUrl, "uds");
}

export function deriveUtilityBaseUrl(apiBaseUrl: string): string {
  return deriveBaseUrl(apiBaseUrl, "utility");
}
