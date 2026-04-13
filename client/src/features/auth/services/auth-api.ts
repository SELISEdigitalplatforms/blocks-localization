import { idpGet, idpPostFormUrlEncoded, idpPostJson } from "@/platform/api/idp-http";
import {
  AUTH_ENDPOINTS,
  IAM_ENDPOINTS,
  IDENTIFIER_ENDPOINTS,
  MFA_ENDPOINTS,
} from "./endpoints";
import type {
  LoginOption,
  PasswordSigninResult,
  SignUpSetting,
  SigninTokenSuccess,
  SignupByEmailResponse,
  SocialLoginEndpointPayload,
  SocialLoginEndpointResponse,
  SsoSigninResult,
} from "@/features/auth/model/types";
import { GRANT_TYPES } from "@/features/auth/model/types";

export function getLoginOptions(): Promise<LoginOption> {
  return idpGet<LoginOption>(AUTH_ENDPOINTS.GET_LOGIN_OPTIONS);
}

export function getSignUpSetting(projectKey: string): Promise<SignUpSetting> {
  const q = `?ProjectKey=${encodeURIComponent(projectKey)}`;
  return idpGet<SignUpSetting>(`${IAM_ENDPOINTS.GET_SIGNUP_SETTING}${q}`);
}

export function signinByEmail(username: string, password: string): Promise<PasswordSigninResult> {
  const body = new URLSearchParams();
  body.append("grant_type", GRANT_TYPES.password);
  body.append("username", username);
  body.append("password", password);
  return idpPostFormUrlEncoded<PasswordSigninResult>(AUTH_ENDPOINTS.TOKEN, body, {
    skipTokenRotation: true,
  });
}

export function signinBySso(code: string, state: string): Promise<SsoSigninResult> {
  const body = new URLSearchParams();
  body.append("grant_type", GRANT_TYPES.social);
  body.append("code", code);
  body.append("state", state);
  return idpPostFormUrlEncoded<SsoSigninResult>(AUTH_ENDPOINTS.TOKEN, body, {
    skipTokenRotation: true,
  });
}

export function getSocialLoginEndpoint(
  payload: SocialLoginEndpointPayload,
): Promise<SocialLoginEndpointResponse> {
  return idpPostJson<SocialLoginEndpointResponse>(AUTH_ENDPOINTS.GET_SOCIAL_LOGIN_ENDPOINT, payload);
}

export function signupByEmail(payload: {
  email: string;
  captchaCode: string;
}): Promise<SignupByEmailResponse> {
  return idpPostJson<SignupByEmailResponse>(IDENTIFIER_ENDPOINTS.SIGNUP, payload);
}

/** Matches `idp/authentication/services/auth.service.ts#verifyMfa`. */
export function verifyMfa(payload: {
  code: string;
  mfa_id: string;
  mfa_type: number;
}): Promise<SigninTokenSuccess> {
  const body = new URLSearchParams();
  body.append("grant_type", GRANT_TYPES.mfa_code);
  body.append("code", payload.code);
  body.append("mfa_id", payload.mfa_id);
  body.append("mfa_type", String(payload.mfa_type));
  return idpPostFormUrlEncoded<SigninTokenSuccess>(AUTH_ENDPOINTS.TOKEN, body);
}

/**
 * Matches `idp/mfa/services/mfa.service.ts#resendOtp` — JSON body is the `mfaId` string.
 */
export function resendMfaOtp(mfaId: string): Promise<unknown> {
  return idpPostJson<unknown>(MFA_ENDPOINTS.RESEND_OTP, mfaId);
}
