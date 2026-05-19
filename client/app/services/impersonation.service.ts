
import { IMPERSONATE_ENDPOINTS } from '@/idp/authentication/constants'
import { http } from '@/lib/http-client'

export interface ImpersonationRequest {
  targetTenantId: string
  orgId?: string
  organizationId?: string
}

export interface ImpersonationState {
  rootTenantId: string
  targetTenantId: string
  orgId: string
  startedAtUtc: string
}

class ImpersonationService {
  startImpersonation(
    request: ImpersonationRequest,
  ): Promise<ImpersonationState> {
    return http.post(
      `${IMPERSONATE_ENDPOINTS.IMPERSONATE}`,
      request,
      undefined,
      { absoluteUrl: true },
    )
  }

  stopImpersonation(): Promise<void> {
    return http.post(
      `${IMPERSONATE_ENDPOINTS.STOP_IMPERSONATION}`,
      null,
      undefined,
      { absoluteUrl: true },
    )
  }
}

export const impersonationService = new ImpersonationService()
