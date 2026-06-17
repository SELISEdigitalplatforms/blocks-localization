import { serviceInstances } from "@/lib/http-client";
import {
  ICreateOrUpdateOrganizationPayload,
  ICreateOrUpdateOrganizationResponse,
  IGetOrganizationByIdParams,
  IGetOrganizationByIdResponse,
  IGetOrganizationsParams,
  IGetOrganizationsResponse,
} from "@blocks-idp/iam/models/organization";
import {
  IOrganizationConfigPayload,
  IOrganizationConfigResponse,
  IOrganizationConfigSaveResponse,
} from "@blocks-idp/iam/models/organization-config.model";
import { ORGANIZATION_ENDPOINTS } from "../constants/endpoint.constant";

export class OrganizationService {
  private readonly httpClient = serviceInstances.idpService;

  getOrganizations(params: IGetOrganizationsParams): Promise<IGetOrganizationsResponse> {
    let url = `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATIONS}?projectKey=${params.projectKey}&page=${params.page}&pageSize=${params.pageSize}`;
    params.searchText ? (url += `&SearchText=${params.searchText}`) : null;
    return this.httpClient.get(url, undefined, { absoluteUrl: true });
  }

  getOrganizationById(params: IGetOrganizationByIdParams): Promise<IGetOrganizationByIdResponse> {
    return this.httpClient.get(
      `${ORGANIZATION_ENDPOINTS.GET_ORGANIZATION}?ProjectKey=${params.projectKey}&ItemId=${params.itemId}`,
      undefined,
      { absoluteUrl: true },
    );
  }

  saveOrganization = (
    payload: ICreateOrUpdateOrganizationPayload,
  ): Promise<ICreateOrUpdateOrganizationResponse> => {
    return this.httpClient.post(ORGANIZATION_ENDPOINTS.SAVE_ORGANIZATION, payload, undefined, { absoluteUrl: true });
  };

  getOrganizationConfig(projectKey: string): Promise<IOrganizationConfigResponse | null> {
    return this.httpClient.get(`${ORGANIZATION_ENDPOINTS.GET_ORGANIZATION_CONFIG}?projectKey=${projectKey}`, undefined, { absoluteUrl: true });
  }

  saveOrganizationConfig = (
    payload: IOrganizationConfigPayload,
  ): Promise<IOrganizationConfigSaveResponse> => {
    return this.httpClient.post(ORGANIZATION_ENDPOINTS.SAVE_ORGANIZATION_CONFIG, payload, undefined, { absoluteUrl: true });
  };
}

export const organizationService = new OrganizationService();
