const V1 = "/idp/v1";
const MFA_V1 = "/mfa/v1";
const CC_V1 = "/cloudconfiguration/v1";

/** Aligned with `idp/iam/constants/endpoint.constant.ts` + `idp/mfa/constants/endpoint.constant.ts`. */
export const PROFILE_IAM_ENDPOINTS = {
  GET_USER: `${V1}/Iam/GetUser`,
  UPDATE: `${V1}/Iam/Update`,
  GET_SESSIONS: `${V1}/Iam/GetSessions`,
  GET_HISTORIES: `${V1}/Iam/GetHistories`,
} as const;

export const PROFILE_AUTH_ENDPOINTS = {
  GET_USER_CODES: `${V1}/Authentication/GetUserCodes`,
  GENERATE_USER_CODE: `${V1}/Authentication/GenerateUserCode`,
} as const;

export const PROFILE_MFA_CONFIG_ENDPOINTS = {
  GET: `${CC_V1}/MFA/Get`,
} as const;

export const PROFILE_MFA_ENDPOINTS = {
  GENERATE_OTP: `${V1}/Mfa/GenerateOTP`,
  CONFIGURE_USER_MFA: `${MFA_V1}/Management/ConfigureUserMfa`,
  SETUP_TOTP: `${V1}/Mfa/SetUpTotp`,
  VERIFY_OTP: `${V1}/Mfa/VerifyOTP`,
  RESEND_OTP: `${V1}/Mfa/ResendOtp`,
  DISABLE_MFA: `${V1}/Mfa/DisableUserMfa`,
} as const;
