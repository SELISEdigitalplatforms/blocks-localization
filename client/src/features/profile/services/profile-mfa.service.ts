import { PROFILE_MFA_CONFIG_ENDPOINTS, PROFILE_MFA_ENDPOINTS } from "@/features/profile/constants/endpoints";
import type {
  IConfigureUserMFAPayload,
  IConfigureUserMFAResponse,
  IDisableMFAPayload,
  IDisableMFAResponse,
  IGenerateUserMFA_OtpPayload,
  IGenerateUserMFA_OtpResponse,
  IGetConfigurationResponse,
  IResendMfaOtpPayload,
  ISetupUserTotpResponse,
  IVerifyMfaOtpPayload,
  IVerifyMfaOtpResponse,
} from "@/features/profile/model/profile-mfa.types";
import { idpGet, idpPostJson } from "@/platform/api/idp-http";

export async function profileGetMfaConfiguration(projectKey: string): Promise<IGetConfigurationResponse> {
  return idpGet<IGetConfigurationResponse>(
    `${PROFILE_MFA_CONFIG_ENDPOINTS.GET}?ProjectKey=${encodeURIComponent(projectKey)}`,
  );
}

export async function profileConfigureUserMfa(
  payload: IConfigureUserMFAPayload,
): Promise<IConfigureUserMFAResponse> {
  return idpPostJson<IConfigureUserMFAResponse>(PROFILE_MFA_ENDPOINTS.CONFIGURE_USER_MFA, payload);
}

export async function profileGenerateUserMfaOtp(
  payload: IGenerateUserMFA_OtpPayload,
): Promise<IGenerateUserMFA_OtpResponse> {
  return idpPostJson<IGenerateUserMFA_OtpResponse>(PROFILE_MFA_ENDPOINTS.GENERATE_OTP, payload);
}

export async function profileVerifyMfaOtp(payload: IVerifyMfaOtpPayload): Promise<IVerifyMfaOtpResponse> {
  return idpPostJson<IVerifyMfaOtpResponse>(PROFILE_MFA_ENDPOINTS.VERIFY_OTP, payload);
}

/** Parity with `mfaService.resendOtp` — POST body is the MFA id string. */
export async function profileResendMfaOtp(payload: IResendMfaOtpPayload): Promise<IVerifyMfaOtpResponse> {
  return idpPostJson<IVerifyMfaOtpResponse>(PROFILE_MFA_ENDPOINTS.RESEND_OTP, payload.mfaId);
}

export async function profileDisableMfa(payload: IDisableMFAPayload): Promise<IDisableMFAResponse> {
  return idpPostJson<IDisableMFAResponse>(PROFILE_MFA_ENDPOINTS.DISABLE_MFA, payload);
}

export async function profileSetupTotp(id: string, projectKey: string): Promise<ISetupUserTotpResponse> {
  const q = new URLSearchParams({ UserId: id, ProjectKey: projectKey });
  return idpGet<ISetupUserTotpResponse>(`${PROFILE_MFA_ENDPOINTS.SETUP_TOTP}?${q.toString()}`);
}
