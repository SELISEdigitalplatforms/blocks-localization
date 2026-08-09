/**
 * Cookie utility for cross-subdomain storage
 * Cookies are shared across subdomains (e.g., stg-localization.blocksdevelopers.com and stg-iam.blocksdevelopers.com)
 *
 * Security Notes:
 * - Uses SameSite=Lax for OIDC compatibility
 * - Uses Secure flag for HTTPS-only in production
 * - Data is not sensitive (language preferences only)
 * - No HttpOnly because Zustand needs JS access
 */

import { getRuntimeEnv } from "@/lib/runtime-env";

const MAX_COOKIE_SIZE = 3500; // Leave buffer for cookie overhead (4KB limit)

const normalizeDomain = (domain: string): string =>
  domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0]
    .split(":")[0]
    .replace(/^\./, "")
    .toLowerCase();

/**
 * Uses the deployment's configured base domain when it applies to the current
 * host. Otherwise the Domain attribute is omitted so the browser creates a
 * host-only cookie instead of silently rejecting the write.
 */
const resolveCookieDomain = (domain?: string): string | undefined => {
  const normalizedDomain = normalizeDomain(domain ?? getRuntimeEnv("BLOCKS_BASE_DOMAIN"));
  if (!normalizedDomain) return undefined;

  // An explicitly supplied domain remains supported for callers and tests.
  if (domain !== undefined || globalThis.window === undefined) {
    return normalizedDomain;
  }

  const hostname = globalThis.window.location.hostname.toLowerCase();
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`)
    ? normalizedDomain
    : undefined;
};

/**
 * Gets a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (globalThis.document === undefined) return null;

  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(";");
  for (let cookie of cookies) {
    while (cookie.startsWith(" ")) {
      cookie = cookie.substring(1);
    }
    if (cookie.startsWith(nameEQ)) {
      return decodeURIComponent(cookie.substring(nameEQ.length));
    }
  }
  return null;
}

/**
 * Sets a cookie with the specified name, value, and options
 * @param name - Cookie name
 * @param value - Cookie value
 * @param days - Number of days until expiration (default: 365)
 * @param domain - Optional domain override. When omitted, uses BLOCKS_BASE_DOMAIN.
 */
export function setCookie(name: string, value: string, days: number = 365, domain?: string): void {
  if (globalThis.document === undefined) return;

  // Check size limit
  const encodedValue = encodeURIComponent(value);
  if (encodedValue.length > MAX_COOKIE_SIZE) {
    console.error(
      `Cookie "${name}" value too large (${encodedValue.length} bytes). Max: ${MAX_COOKIE_SIZE}`,
    );
    return;
  }

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  // Determine if Secure flag should be used (based on protocol)
  const isSecure = globalThis.window.location.protocol === "https:";
  const cookieDomain = resolveCookieDomain(domain);

  document.cookie = [
    `${name}=${encodedValue}`,
    `expires=${expires.toUTCString()}`,
    "path=/",
    cookieDomain ? `domain=${cookieDomain}` : "",
    "SameSite=Lax",
    isSecure ? "Secure" : "", // Only use Secure on HTTPS
  ]
    .filter(Boolean)
    .join(";");
}

/**
 * Removes a cookie by name
 * @param name - Cookie name
 * @param domain - Optional domain override. Defaults to BLOCKS_BASE_DOMAIN.
 */
export function removeCookie(name: string, domain?: string): void {
  if (globalThis.document === undefined) return;
  const cookieDomain = resolveCookieDomain(domain);
  // Set expiration to past date to remove
  document.cookie = [
    `${name}=`,
    "expires=Thu, 01 Jan 1970 00:00:00 UTC",
    "path=/",
    cookieDomain ? `domain=${cookieDomain}` : "",
    "SameSite=Lax",
  ]
    .filter(Boolean)
    .join(";");
}

/**
 * Parses a JSON cookie value with validation
 * @param name - Cookie name
 * @returns Parsed JSON object or null
 */
export function getJsonCookie<T>(name: string): T | null {
  const value = getCookie(name);
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

/**
 * Sets a JSON cookie value with validation
 * @param name - Cookie name
 * @param value - Object to store
 * @param days - Number of days until expiration
 * @param domain - Optional domain override. When omitted, uses BLOCKS_BASE_DOMAIN.
 */
export function setJsonCookie<T>(
  name: string,
  value: T,
  days: number = 365,
  domain?: string,
): void {
  try {
    const jsonString = JSON.stringify(value);
    setCookie(name, jsonString, days, domain);
  } catch (error) {
    console.error(`Failed to stringify cookie "${name}":`, error);
  }
}
