const V1 = "/idp/v1";

export const AUTH_ENDPOINTS = {
  TOKEN: `${V1}/Authentication/Token`,
  GET_SOCIAL_LOGIN_ENDPOINT: `${V1}/Authentication/GetSocialLogInEndPoint`,
  GET_LOGIN_OPTIONS: `${V1}/Authentication/GetLoginOptions`,
} as const;

/** Matches `idp/mfa/constants/endpoint.constant.ts` (`RESEND_OTP` on IDP base). */
export const MFA_ENDPOINTS = {
  RESEND_OTP: `${V1}/Mfa/ResendOtp`,
} as const;

/** Matches `idp/iam/constants/endpoint.constant.ts` (`IAM_SUBPATH = "/Iam"`). */
export const IAM_ENDPOINTS = {
  GET_SIGNUP_SETTING: `${V1}/Iam/GetSignUpSetting`,
  /** Current session user (profile image, name, etc.) — same as `@blocks-idp/iam` `getUser()`. */
  GET_USER: `${V1}/Iam/GetUser`,
} as const;

const ID_V1 = "/identifier/v1";

export const IDENTIFIER_ENDPOINTS = {
  SIGNUP: `${ID_V1}/People/Signup`,
} as const;
