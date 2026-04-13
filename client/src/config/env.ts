/**
 * Client env: `envDir` is the monolith root (see `vite.config.ts`).
 * Vite exposes only `BLOCKS_*` (see `envPrefix` in vite.config).
 */
function firstDefined(...values: (string | undefined)[]): string {
  for (const v of values) {
    if (v !== undefined && v !== "") return v;
  }
  return "";
}

/** Which key supplied `apiBaseUrl` (handy for confirming `.env` is picked up in dev). */
export function getApiBaseSource(): "BLOCKS_API_BASE_URL" | "none" {
  if (import.meta.env.BLOCKS_API_BASE_URL) return "BLOCKS_API_BASE_URL";
  return "none";
}

export const env = {
  appUrl: firstDefined(import.meta.env.BLOCKS_APP_URL),
  apiBaseUrl: firstDefined(import.meta.env.BLOCKS_API_BASE_URL),
  xBlocksKey: firstDefined(import.meta.env.BLOCKS_X_BLOCKS_KEY),
  constructUrl: firstDefined(import.meta.env.BLOCKS_CONSTRUCT_URL),
  projectDefaultApiBaseUrl: firstDefined(import.meta.env.BLOCKS_PROJECT_DEFAULT_API_BASE_URL),
  googleSiteKey: firstDefined(import.meta.env.BLOCKS_GOOGLE_SITE_KEY),
  blocksDefaultStorageHost: firstDefined(import.meta.env.BLOCKS_BLOCKS_DEFAULT_STORAGE_HOST),
  blockedMenu: firstDefined(import.meta.env.BLOCKS_BLOCKED_MENU, "[]"),
  aiWidgetCdnLink: firstDefined(import.meta.env.BLOCKS_AI_WIDGET_CDN_LINK),
  githubSsoClientId: firstDefined(import.meta.env.BLOCKS_GITHUB_SSO_CLIENT_ID),
  clarityProjectId: firstDefined(import.meta.env.BLOCKS_CLARITY_PROJECT_ID),
  appEnv: firstDefined(import.meta.env.BLOCKS_APP_ENV),
  widgetId: firstDefined(import.meta.env.BLOCKS_WIDGET_ID),
  widgetUrl: firstDefined(import.meta.env.BLOCKS_WIDGET_URL),
  scaPortalLink: firstDefined(import.meta.env.BLOCKS_SCA_PORTAL_LINK),
  blockedKey: firstDefined(import.meta.env.BLOCKS_BLOCKED_KEY, "[]"),
  blockedUserIds: firstDefined(import.meta.env.BLOCKS_BLOCKED_USER_IDS, "[]"),
  uilmProjectKey: firstDefined(import.meta.env.BLOCKS_UILM_PROJECT_KEY),
  baseDomain: firstDefined(import.meta.env.BLOCKS_PUBLIC_BASE_DOMAIN, "seliseblocks.com"),
} as const;

if (import.meta.env.DEV) {
  console.info("[client] env from repo-root .env (envDir + BLOCKS_ prefix)", {
    mode: import.meta.env.MODE,
    apiBaseUrl: env.apiBaseUrl || "(missing)",
    apiBaseSource: getApiBaseSource(),
  });
}
