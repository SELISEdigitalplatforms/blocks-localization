import { serviceInstances } from "@/lib/http-client";
import {
  IAccountActivationPayload,
  IAccountActivationResponse,
  IAccountRecoverPayload,
  IAccountRecoverResponse,
  IAccountResendActivationPayload,
  IAccountResendActivationResponse,
  IAccountResetPasswordPayload,
  IAccountResetPasswordResponse,
  IActivationCodeExpirationResponse,
  IActivationCodeValidationPayload,
} from "@blocks-idp/iam/models/user";
import { ACCOUNT_ENDPOINTS } from "../constants/endpoint.constant";

export class UserAccountService {
  private readonly httpClient = serviceInstances.idpService;

  accountActivation(payload: IAccountActivationPayload): Promise<IAccountActivationResponse> {
    return this.httpClient.post(ACCOUNT_ENDPOINTS.ACTIVATE, payload, undefined, { absoluteUrl: true });
  }

  accountResendActivation(
    payload: IAccountResendActivationPayload,
  ): Promise<IAccountResendActivationResponse> {
    return this.httpClient.post(ACCOUNT_ENDPOINTS.RESEND_ACTIVATION, payload, undefined, { absoluteUrl: true });
  }

  accountRecover(payload: IAccountRecoverPayload): Promise<IAccountRecoverResponse> {
    return this.httpClient.post(ACCOUNT_ENDPOINTS.RECOVER, payload, undefined, { absoluteUrl: true });
  }

  accountResetPassword(
    payload: IAccountResetPasswordPayload,
  ): Promise<IAccountResetPasswordResponse> {
    return this.httpClient.post(ACCOUNT_ENDPOINTS.RESET_PASSWORD, payload, undefined, { absoluteUrl: true });
  }

  checkActivationCodeExpiration(
    payload: IActivationCodeValidationPayload,
  ): Promise<IActivationCodeExpirationResponse> {
    return this.httpClient.post(ACCOUNT_ENDPOINTS.VALIDATE_ACTIVATION_CODE, payload, undefined, { absoluteUrl: true });
  }
}
