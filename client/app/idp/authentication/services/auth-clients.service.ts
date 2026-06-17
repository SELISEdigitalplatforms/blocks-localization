/* eslint-disable @typescript-eslint/no-explicit-any */
import { serviceInstances } from "@/lib/http-client";
import { APIResponse } from "@/models/api-response";
import {
  IClientConfigResponse,
  IDeleteOidcClientPayload,
  IDeleteOidcClientResponse,
  IGetClientsPayload,
  ISaveClientCredentialPayload,
  ISaveClientCredentialResponse,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import { AUTH_CLIENT_ENDPOINTS } from "../constants/endpoint.constant";

export class AuthClientsService {
  private readonly httpClient = serviceInstances.idpService;

  getClientCredentials(payload: IGetClientsPayload): Promise<IClientConfigResponse[]> {
    return this.httpClient.get(
      `${AUTH_CLIENT_ENDPOINTS.GET_CLIENT_CREDENTIALS}?ProjectKey=${payload.projectKey}`,
    );
  }

  saveClientCredential(
    payload: ISaveClientCredentialPayload,
  ): Promise<APIResponse<ISaveClientCredentialResponse>> {
    return this.httpClient.post(AUTH_CLIENT_ENDPOINTS.SAVE_CLIENT_CREDENTIAL, payload);
  }

  deleteClientCredential(
    payload: IDeleteOidcClientPayload,
  ): Promise<APIResponse<IDeleteOidcClientResponse>> {
    return this.httpClient.post(AUTH_CLIENT_ENDPOINTS.DELETE_CLIENT_CREDENTIAL, payload);
  }
}

export const authClientService = {
  clients: new AuthClientsService(),
};
