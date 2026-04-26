import { idpPostJson } from "@/platform/api/idp-http";

export type IamResendActivationPayload = {
  userId: string;
  projectKey: string;
};

export type IamResendActivationResponse = {
  errors: unknown | null;
  isSuccess: boolean;
};

export function postIamResendActivation(payload: IamResendActivationPayload) {
  return idpPostJson<IamResendActivationResponse>("/idp/v1/Iam/ResendActivation", payload);
}
