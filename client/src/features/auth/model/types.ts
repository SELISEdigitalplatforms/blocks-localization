export enum GRANT_TYPES {
  password = "password",
  social = "social",
  mfa_code = "mfa_code",
  clientCredential = "client_credential",
  authorizationCode = "authorization_code",
}

export enum SSO_PROVIDERS {
  google = "google",
  microsoft = "microsoft",
  github = "github",
  linkedin = "linkedin",
  x = "x",
  apple = "apple",
  facebook = "facebook",
  ownsso = "ownsso",
}

type SsoInfo = {
  provider: SSO_PROVIDERS;
  audience: string;
};

export type LoginOption = {
  allowedGrantTypes: GRANT_TYPES[];
  ssoInfo: SsoInfo[];
};

export type SignUpSetting = {
  itemId: string;
  isEmailPasswordSignUpEnabled: boolean;
  isSSoSignUpEnabled: boolean;
};

export type SignupByEmailResponse = {
  itemId: string | null;
  errors: unknown | null;
  isSuccess: boolean;
};

export type SigninTokenSuccess = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
};

export type SigninMfaResponse = {
  enable_mfa: true;
  mfaId: string;
  mfaType: number;
  message?: string;
};

export type PasswordSigninResult = SigninTokenSuccess | SigninMfaResponse;

export type SsoSigninResult = (SigninTokenSuccess | SigninMfaResponse) & {
  sso_user_redirect_url?: string;
};

export function isMfaRequired(
  r: PasswordSigninResult | SsoSigninResult,
): r is SigninMfaResponse {
  return (
    "enable_mfa" in r &&
    r.enable_mfa === true &&
    "mfaId" in r &&
    r.mfaId != null &&
    "mfaType" in r &&
    r.mfaType != null
  );
}

export type SocialLoginEndpointPayload = {
  provider: SSO_PROVIDERS;
  audience: string;
  nextUrl?: string;
  sendAsResponse: boolean;
};

export type SocialLoginEndpointResponse = {
  error?: unknown;
  isAResponse?: boolean;
  providerUrl: string;
};
