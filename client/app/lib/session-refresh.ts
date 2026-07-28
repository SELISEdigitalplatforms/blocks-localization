import { getRuntimeEnv } from "@/lib/runtime-env";

let refreshPromise: Promise<void> | null = null;

export const ensureLocalizationSession = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  if (!refreshPromise) {
    refreshPromise = refreshLocalizationSession().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
};

const refreshLocalizationSession = async (): Promise<void> => {
  const iamBaseUrl = getRuntimeEnv("BLOCKS_IAM_BASE_URL") || window.process?.env?.userBaseUrl || "";
  const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  const clientId = getRuntimeEnv("BLOCKS_OIDC_CLIENT_ID");

  if (!iamBaseUrl || !blocksKey || !clientId) {
    throw new Error("Missing authentication configuration");
  }

  const body = new URLSearchParams();
  body.append("grant_type", "refresh_token");
  body.append("refresh_token", '""');
  body.append("client_id", clientId);

  const response = await fetch(`${iamBaseUrl}/api/oidc/token?tenant_id=${blocksKey}`, {
    method: "POST",
    body,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Blocks-Key": blocksKey,
    },
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to refresh localization session");
  }
};
