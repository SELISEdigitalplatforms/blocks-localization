import { env } from "@/config/env";

/** Same host-based mapping as `idp/iam/modules/user-management/user-pat/generate-pat-modal.tsx`. */
export function getPatClientIdForAppUrl(): string {
  const url = env.appUrl || "";
  if (url === "https://dev-cloud.seliseblocks.com") return "11640778-423d-41e6-acba-1cf947cecb54";
  if (url === "https://stg-cloud.seliseblocks.com") return "4fe41cda-cb8d-458e-8a95-010549bd6d7e";
  if (url === "https://cloud.seliseblocks.com") return "dce12fb6-3ed7-4704-9426-81d7d957dfb8";
  return "11640778-423d-41e6-acba-1cf947cecb54";
}
