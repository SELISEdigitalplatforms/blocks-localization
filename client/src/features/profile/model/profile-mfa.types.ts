export type IMFAConfiguration = {
  enableMfa: boolean;
  mfaTemplate: { templateName: string; templateId: string };
  projectKey: string | null;
  userMfaType: number[];
};

export type IGetConfigurationResponse = IMFAConfiguration;

export type IConfigureUserMFAPayload = {
  userId: string;
  mfaEnabled: boolean;
  userMfaType: number;
  projectKey: string;
};

export type IConfigureUserMFAResponse = {
  errors: unknown | null;
  isSuccess: boolean;
};

export type IGenerateUserMFA_OtpPayload = {
  userId: string;
  projectKey: string;
  mfaType: number;
  sendPhoneNumberAsEmailDomain?: string;
};

export type IGenerateUserMFA_OtpResponse = {
  errors: unknown | null;
  isSuccess: boolean;
  mfaId: string;
};

export type IVerifyMfaOtpPayload = {
  mfaId: string;
  verificationCode: string;
  authType: number;
  projectKey: string;
  isFromTokenCall?: boolean;
};

export type IVerifyMfaOtpResponse = {
  errors: unknown;
  isSuccess: boolean;
  isValid: boolean;
  userId: string;
};

export type IResendMfaOtpPayload = {
  mfaId: string;
  sendPhoneNumberAsEmailDomain?: string;
};

export type ISetupUserTotpResponse = {
  errors: unknown | null;
  isSuccess: boolean;
  qrImageUrl: string;
  qrCode: string;
};

export type IDisableMFAPayload = {
  userId: string;
  projectKey: string;
};

export type IDisableMFAResponse = {
  errors: unknown;
  isSuccess: boolean;
};
