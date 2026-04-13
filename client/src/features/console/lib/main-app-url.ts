import { env } from "@/config/env";

/**
 * Base URL for the main Blocks (Next.js) app. Used for `/create-project`, `/project-overview`, etc.
 * Set `NEXT_PUBLIC_APP_URL` / `VITE_APP_URL` in repo-root `.env` when UILM runs on another origin/port.
 */
export function getMainAppUrl(): string {
  const fromEnv = env.appUrl?.replace(/\/$/, "") ?? "";
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function mainAppPath(path: string): string {
  const base = getMainAppUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
