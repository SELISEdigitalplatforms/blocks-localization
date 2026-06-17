import { serviceInstances } from "@/lib/http-client";
import {
  IEnableCaptchaConfigsStatusPayload,
  IEnableCaptchaConfigsStatusResponse,
  IGetCaptchaConfigsPayload,
  IGetCaptchaConfigsResponse,
  ISaveCaptchaConfigsPayload,
  ISaveCaptchaConfigsResponse,
} from "@blocks-idp/captcha/models/captcha";
import { CAPTCHA_ENDPOINTS } from "../constants/endpoint.constant";

export class CaptchaService {
  private readonly httpClient = serviceInstances.idpService;

  getCaptchaConfigs(payload: IGetCaptchaConfigsPayload): Promise<IGetCaptchaConfigsResponse> {
    return this.httpClient.get(`${CAPTCHA_ENDPOINTS.GETS}?ProjectKey=${payload.projectKey}`);
  }

  saveCaptcha = (payload: ISaveCaptchaConfigsPayload): Promise<ISaveCaptchaConfigsResponse> => {
    return this.httpClient.post(CAPTCHA_ENDPOINTS.SAVE, payload);
  };

  updateCaptchaConfigStatus = (
    payload: IEnableCaptchaConfigsStatusPayload,
  ): Promise<IEnableCaptchaConfigsStatusResponse> => {
    return this.httpClient.post(CAPTCHA_ENDPOINTS.UPDATE_STATUS, payload);
  };
}

export const captchaService = new CaptchaService();
