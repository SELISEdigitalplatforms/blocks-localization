import { IAM_CURRENT_USER_QUERY_KEY, PROFILE_QUERY_KEYS } from "@/features/profile/hooks/profile-query-keys";
import type { IGetUserByIdPayload } from "@/features/profile/model/profile-user.types";
import type {
  IConfigureUserMFAPayload,
  IGenerateUserMFA_OtpPayload,
  IResendMfaOtpPayload,
  IVerifyMfaOtpPayload,
  IDisableMFAPayload,
} from "@/features/profile/model/profile-mfa.types";
import {
  profileConfigureUserMfa,
  profileDisableMfa,
  profileGenerateUserMfaOtp,
  profileGetMfaConfiguration,
  profileResendMfaOtp,
  profileSetupTotp,
  profileVerifyMfaOtp,
} from "@/features/profile/services/profile-mfa.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useProfileMfaConfig(option: { projectKey: string }) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.mfaConfig(option.projectKey),
    queryFn: () => profileGetMfaConfiguration(option.projectKey),
    enabled: Boolean(option.projectKey),
  });
}

export function useProfileConfigureUserMfa(option: { id: string; projectKey: string }) {
  const queryClient = useQueryClient();
  const byId: IGetUserByIdPayload = { id: option.id, projectKey: option.projectKey };
  return useMutation({
    mutationKey: ["profile", "mfa", "configure", option],
    mutationFn: (payload: IConfigureUserMFAPayload) => profileConfigureUserMfa(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.userById(byId) });
    },
  });
}

export function useProfileGenerateUserMfaOtp() {
  return useMutation({
    mutationKey: ["profile", "mfa", "generate-otp"],
    mutationFn: (payload: IGenerateUserMFA_OtpPayload) => profileGenerateUserMfaOtp(payload),
  });
}

export function useProfileVerifyMfaOtp(option: IGetUserByIdPayload & { own?: boolean }) {
  const queryClient = useQueryClient();
  const { own = false, ...rest } = option;
  return useMutation({
    mutationKey: ["profile", "mfa", "verify-otp", option],
    mutationFn: (payload: IVerifyMfaOtpPayload) => profileVerifyMfaOtp(payload),
    onSuccess: () => {
      if (own) void queryClient.invalidateQueries({ queryKey: IAM_CURRENT_USER_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.userById(rest) });
    },
  });
}

export function useProfileResendMfaOtp() {
  return useMutation({
    mutationKey: ["profile", "mfa", "resend-otp"],
    mutationFn: (payload: IResendMfaOtpPayload) => profileResendMfaOtp(payload),
  });
}

export function useProfileDisableMfa(option: { id: string; projectKey: string }) {
  const queryClient = useQueryClient();
  const byId: IGetUserByIdPayload = { id: option.id, projectKey: option.projectKey };
  return useMutation({
    mutationKey: ["profile", "mfa", "disable", option],
    mutationFn: (payload: IDisableMFAPayload) => profileDisableMfa(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.userById(byId) });
      void queryClient.invalidateQueries({ queryKey: IAM_CURRENT_USER_QUERY_KEY });
    },
  });
}

export function useProfileTotpSetup(option: { id: string; projectKey: string; enabled: boolean }) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.totpSetup(option.id, option.projectKey),
    queryFn: () => profileSetupTotp(option.id, option.projectKey),
    enabled: Boolean(option.enabled && option.id && option.projectKey),
  });
}
