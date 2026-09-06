import { serviceInstances } from "@/lib/http-client";
import { getRuntimeEnv } from "@/lib/runtime-env";

export interface IamClientCredential {
  name: string;
  clientSecret: string;
  accessTokenValidForNumberMinutes?: number;
  roles: string[];
  permissions?: string[];
  isActive: boolean;
  itemId: string;
  createdDate?: string;
  lastUpdatedDate?: string;
}

export const fetchIamClientCredentials = async (): Promise<IamClientCredential[]> => {
  return serviceInstances.iamService.get<IamClientCredential[]>("/api/auth/client-credentials");
};

export const fetchBlocksOsRedirectUrl = async (forwardedTo: string): Promise<string> => {
  const blocksKey = getRuntimeEnv("BLOCKS_X_BLOCKS_KEY");
  const clientId = getRuntimeEnv("BLOCKS_OS_CLIENT_ID");
  const redirectUri = getRuntimeEnv("BLOCKS_OS_CALLBACK_URL");

  if (!blocksKey || !clientId || !redirectUri) {
    throw new Error("Blocks OS redirect configuration is incomplete");
  }

  const params = new URLSearchParams({
    "x-blocks-key": blocksKey,
    clientId,
    redirectUri,
    forwardedTo,
  });
  const response = await serviceInstances.iamService.get<{ redirect_uri?: string }>(
    `/api/idp/initiate?${params.toString()}`,
  );

  if (!response.redirect_uri) {
    throw new Error("IAM did not return a Blocks OS redirect URL");
  }

  return response.redirect_uri;
};

const normalizeRole = (role: string) => role.toLowerCase().replaceAll("-", "_");

export const hasWpCredentialRole = (credential: IamClientCredential | undefined): boolean => {
  return Boolean(credential?.roles.some((role) => normalizeRole(role) === "wp_user"));
};

export const findWordPressClientCredentials = (
  credentials: IamClientCredential[] | undefined,
): IamClientCredential[] =>
  (credentials ?? [])
    .filter(
      (credential) =>
        credential.name.toLowerCase().includes("wordpress") || hasWpCredentialRole(credential),
    )
    .sort((first, second) => Number(second.isActive) - Number(first.isActive));
