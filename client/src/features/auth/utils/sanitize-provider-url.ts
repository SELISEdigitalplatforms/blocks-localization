/**
 * Strips unresolved C# format-string placeholders from provider redirect URLs.
 * Ported from `idp/authentication/utils/sanitize-provider-url.util.ts`.
 */
export function sanitizeProviderUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    const allEntries: [string, string][] = [];
    urlObj.searchParams.forEach((value, key) => allEntries.push([key, value]));

    const resolved = new Map<string, string>();
    for (let i = allEntries.length - 1; i >= 0; i--) {
      const [key, value] = allEntries[i];
      if (!/^\{[^}]+\}$/.test(value) && !resolved.has(key)) {
        resolved.set(key, value);
      }
    }

    const newParams = new URLSearchParams();
    const added = new Set<string>();
    allEntries.forEach(([key]) => {
      if (!added.has(key) && resolved.has(key)) {
        newParams.append(key, resolved.get(key)!);
        added.add(key);
      }
    });

    urlObj.search = newParams.toString();
    return urlObj.toString();
  } catch {
    return url;
  }
}
