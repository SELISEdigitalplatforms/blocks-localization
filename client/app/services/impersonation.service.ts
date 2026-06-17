import { IMPERSONATE_ENDPOINTS } from "@/idp/authentication/constants";
import { serviceInstances } from "@/lib/http-client";

export interface ImpersonationRequest {
  targeted_tenant_id: string;
  orgId?: string;
  organizationId?: string;
}

export interface ImpersonationState {
  rootTenantId: string;
  targeted_tenant_id: string;
  orgId: string;
  startedAtUtc: string;
}

export interface ImpersonationStatusResponse {
  impersonated: boolean;
  originalTenantId: string;
  impersonatedTenantId: string | null;
}

class ImpersonationService {
  private readonly httpClient = serviceInstances.idpService;

  startImpersonation(
    request: ImpersonationRequest,
  ): Promise<ImpersonationState> {
    return this.httpClient.post(
      `${IMPERSONATE_ENDPOINTS.IMPERSONATE}`,
      request,
      undefined,
      { absoluteUrl: true },
    );
  }

  stopImpersonation(): Promise<void> {
    return this.httpClient.post(
      `${IMPERSONATE_ENDPOINTS.STOP_IMPERSONATION}`,
      {},
      undefined,
      { absoluteUrl: true },
    );
  }

  impersonationStatus(): Promise<ImpersonationStatusResponse> {
    return this.httpClient.post(
      `${IMPERSONATE_ENDPOINTS.IMPERSONATION_STATUS}`,
      null,
      undefined,
      { absoluteUrl: true },
    );
  }
}

export const impersonationService = new ImpersonationService();
