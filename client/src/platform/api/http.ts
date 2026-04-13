import { env } from "@/config/env";

export async function httpGet<T>(path: string): Promise<T> {
  const base = env.apiBaseUrl.replace(/\/$/, "");
  const url = path.startsWith("http") ? path : `${base}${path}`;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}
