import { serviceInstances } from "@/lib/http-client";
import {
  IAuthConfigPayload,
  IGetAuthConfigResponse,
  ISaveAuthConfigPayload,
  ISaveAuthConfigResponse,
} from "@blocks-idp/authentication/models/auth-configuration.model";
import { AUTH_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthConfiguration {
  private readonly httpClient = serviceInstances.idpService;

  getConfig(payload: IAuthConfigPayload): Promise<IGetAuthConfigResponse> {
    const url = `${AUTH_CONFIG_ENDPOINTS.GET_CONFIG}?ProjectKey=${payload.projectKey}`;
    return this.httpClient.get(url);
  }

  saveAuthConfig(payload: ISaveAuthConfigPayload): Promise<ISaveAuthConfigResponse> {
    return this.httpClient.post(AUTH_CONFIG_ENDPOINTS.UPDATE_CONFIG, payload);
  }
}
