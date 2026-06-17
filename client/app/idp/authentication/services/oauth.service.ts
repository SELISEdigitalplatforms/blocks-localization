import { serviceInstances } from "@/lib/http-client";
import {
  IGetSocialLoginEndpointPayload,
  IGetSocialLoginEndpointResponse,
  ISigninBySSOPayload,
  ISigninBySSOResponse,
} from "@blocks-idp/authentication/models/oauth.model";
import { GRANT_TYPES } from "../constants/authentication.constant";
import { AUTH_ENDPOINTS, IDP_ENDPOINTS } from "../constants/endpoint.constant";

export class OAuthService {
  private readonly httpClient = serviceInstances.idpService;

  getSocialLoginEndpoint(
    payload: IGetSocialLoginEndpointPayload,
  ): Promise<IGetSocialLoginEndpointResponse> {
    return this.httpClient.post(AUTH_ENDPOINTS.GET_SOCIAL_LOGIN_ENDPOINT, payload);
  }

  signinBySSO(payload: ISigninBySSOPayload): Promise<ISigninBySSOResponse> {
    const body = new URLSearchParams();
    body.append("grant_type", GRANT_TYPES.social);
    body.append("code", payload.code);
    body.append("state", payload.state);

    return this.httpClient.post(
      IDP_ENDPOINTS.AUTHENTICATION.TOKEN,
      body,
      {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      {
        skipTokenRotation: true,
      },
    );
  }
}

export const oauthService = new OAuthService();
