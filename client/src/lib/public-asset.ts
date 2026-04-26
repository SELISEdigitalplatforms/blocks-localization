/**
 * Build a URL for static files in `client/public/`.
 * Use this instead of hard-coded `/assets/...` so `base` in `vite.config` (and previews behind a subpath) resolve correctly.
 */
export function publicAsset(pathFromPublicRoot: string): string {
  const clean = pathFromPublicRoot.replace(/^\/+/, "");
  const base = import.meta.env.BASE_URL;
  return `${base}${clean}`;
}
