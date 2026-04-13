import type { IGetUserByIdPayload } from "@/features/profile/model/profile-user.types";

export const PROFILE_QUERY_KEYS = {
  userById: (p: IGetUserByIdPayload) => ["profile", "user-by-id", p.id, p.projectKey] as const,
  sessions: (p: { page: number; pageSize: number; userId: string; projectKey: string }) =>
    ["profile", "sessions", p] as const,
  histories: (p: { page: number; pageSize: number; userId: string; projectKey: string }) =>
    ["profile", "histories", p] as const,
  pats: () => ["profile", "personalAccessTokens"] as const,
  mfaConfig: (projectKey: string) => ["profile", "mfa-config", projectKey] as const,
  totpSetup: (id: string, projectKey: string) => ["profile", "mfa-totp-setup", id, projectKey] as const,
} as const;

export const IAM_CURRENT_USER_QUERY_KEY = ["idp", "iam", "current-user"] as const;
