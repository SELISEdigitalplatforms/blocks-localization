const ENV_PREFIX_PATTERN = /^(dev-|stg-)/;
const BLOCKS_DOMAIN = "blocksdevelopers.com";

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
    return `https://${subdomain}.${BLOCKS_DOMAIN}`;
  }

  const origin = window.location.origin;
  const match = origin.match(/^https?:\/\/([^/]+)/);
  if (!match) {
    return `https://${subdomain}.${BLOCKS_DOMAIN}`;
  }

  const host = match[1];

  // When running on localhost, skip environment prefix derivation and use the base subdomain directly.
  // e.g. http://localhost:3000 → https://idp.blocksdevelopers.com (prod)
  if (!host.includes("localhost")) {
    const prefix = host.match(ENV_PREFIX_PATTERN)?.[1] ?? "";
    const derived = prefix ? `${prefix}${subdomain}` : subdomain;
    return `https://${derived}.${BLOCKS_DOMAIN}`;
  }

  return `https://${subdomain}.${BLOCKS_DOMAIN}`;
}

/**
 * Derives the canonical blocks app origin from the current browser origin.
 * This uses the same environment-prefix logic to construct the correct
 * blocks origin (e.g. https://dev-eurolm.blocksdevelopers.com), ignoring
 * any proxy ports or non-standard schemes.
 *
 * Dev:    http://dev-eurolm.blocksdevelopers.com:4000 → https://dev-eurolm.blocksdevelopers.com
 * Staging: any stg host variant                    → https://stg-eurolm.blocksdevelopers.com
 * Prod:   any prod host variant                    → https://eurolm.blocksdevelopers.com
 * Local:  http://localhost:3000                   → https://eurolm.blocksdevelopers.com (prod)
 */
export function deriveBlocksOrigin(): string {
  if (typeof window === "undefined") {
    return `https://eurolm.${BLOCKS_DOMAIN}`;
  }

  const origin = window.location.origin;
  const match = origin.match(/^https?:\/\/([^/]+)/);
  if (!match) {
    return `https://eurolm.${BLOCKS_DOMAIN}`;
  }

  const host = match[1];

  if (!host.includes("localhost")) {
    const prefix = host.match(ENV_PREFIX_PATTERN)?.[1] ?? "";
    // "eurolm" is the base blocks app subdomain
    const derived = prefix ? `${prefix}eurolm` : "eurolm";
    return `https://${derived}.${BLOCKS_DOMAIN}`;
  }

  // On localhost, point to the prod blocks app
  return `https://eurolm.${BLOCKS_DOMAIN}`;
}

export function deriveIdpBaseUrl(): string {
  return deriveBaseUrl("idp");
}

export function deriveUdsBaseUrl(): string {
  return deriveBaseUrl("uds");
}

export function deriveUtilityBaseUrl(): string {
  return deriveBaseUrl("utility");
}

export function deriveAgentBaseUrl(): string {
  return deriveBaseUrl("agent");
}

export function deriveLogicBaseUrl(): string {
  return deriveBaseUrl("logic");
}

export function deriveObservabilityBaseUrl(): string {
  return deriveBaseUrl("observability");
}

export function deriveOsBaseUrl(): string {
  return deriveBaseUrl("os");
}

export function deriveDeploymentBaseUrl(): string {
  return deriveBaseUrl("deployment");
}
