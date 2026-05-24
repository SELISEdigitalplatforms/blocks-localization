/**
 * Cookie utility for cross-subdomain storage
 * Cookies are shared across subdomains (e.g., stg-eurolm.blocksdevelopers.com and stg-idp.blocksdevelopers.com)
 *
 * Security Notes:
 * - Uses SameSite=Lax for OIDC compatibility
 * - Uses Secure flag for HTTPS-only in production
 * - Data is not sensitive (language preferences only)
 * - No HttpOnly because Zustand needs JS access
 */

const MAX_COOKIE_SIZE = 3500; // Leave buffer for cookie overhead (4KB limit)

/**
 * Gets a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i];
    while (cookie.charAt(0) === " ") {
      cookie = cookie.substring(1);
    }
    if (cookie.indexOf(nameEQ) === 0) {
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
 * @param domain - Domain for the cookie (default: .blocksdevelopers.com for cross-subdomain)
 */
export function setCookie(
  name: string,
  value: string,
  days: number = 365,
  domain: string = ".blocksdevelopers.com"
): void {
  if (typeof document === "undefined") return;

  // Check size limit
  const encodedValue = encodeURIComponent(value);
  if (encodedValue.length > MAX_COOKIE_SIZE) {
    console.warn(`Cookie "${name}" value too large (${encodedValue.length} bytes). Max: ${MAX_COOKIE_SIZE}`);
    return;
  }

  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

  // Determine if Secure flag should be used (based on protocol)
  const isSecure = window.location.protocol === "https:";

  document.cookie = [
    `${name}=${encodedValue}`,
    `expires=${expires.toUTCString()}`,
    "path=/",
    `domain=${domain}`,
    "SameSite=Lax",
    isSecure ? "Secure" : "", // Only use Secure on HTTPS
  ]
    .filter(Boolean)
    .join(";");
}

/**
 * Removes a cookie by name
 * @param name - Cookie name
 * @param domain - Domain of the cookie (default: .blocksdevelopers.com)
 */
export function removeCookie(name: string, domain: string = ".blocksdevelopers.com"): void {
  if (typeof document === "undefined") return;
  // Set expiration to past date to remove
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${domain};SameSite=Lax`;
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
 * @param domain - Domain for the cookie
 */
export function setJsonCookie<T>(
  name: string,
  value: T,
  days: number = 365,
  domain: string = ".blocksdevelopers.com"
): void {
  try {
    const jsonString = JSON.stringify(value);
    setCookie(name, jsonString, days, domain);
  } catch (error) {
    console.error(`Failed to stringify cookie "${name}":`, error);
  }
}
