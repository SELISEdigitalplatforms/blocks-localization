/**
 * When switching project/environment on deep dashboard routes, reset to a stable
 * parent path first so screens keyed by the old project do not flash stale state.
 * Parity with Next `redirectPaths` in `environment-list` / `project-list`, using UILM paths.
 */
export const consoleSwitcherRedirectPaths: Record<string, string> = {
  "/services/language/*": "/services/language",
  "/services/language/*/*": "/services/language",
  "/services/language/*/*/*": "/services/language",
};

export function wildcardToRegex(pattern: string): string {
  const escaped = pattern.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
  return "^" + escaped.replace(/\*/g, "[^/]+") + "$";
}

export function buildRedirectRegexMap(paths: Record<string, string>): Record<string, string> {
  return Object.entries(paths).reduce<Record<string, string>>((acc, [pattern, target]) => {
    acc[wildcardToRegex(pattern)] = target;
    return acc;
  }, {});
}
