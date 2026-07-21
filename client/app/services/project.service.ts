import { API_BASES } from '@/constants/endpoint.constant'
import { serviceInstances } from '@/lib/http-client'
import {
  IGetProjectPayload,
  IGetProjectResponse,
  IProjectGroup,
  ICreateProjectPayload,
  IGetProjectLoginOptionResponse,
  IValidateCNameProjectPayload,
  IValidateCNameProjectResponse,
  IUpdateProjectPayload,
  IUpdateProjectResponse,
  IUpdateTenantGroupPayload,
  IUpdateTenantGroupResponse,
  IDisableProjectPayload,
  IDisableProjectResponse,
  IEnvRepository,
  IMigrationRequest,
  IMigrationInitiateResponse,
  IVerifyMigrationRequest,
  IMigrationVerificationResponse,
  IMigrationStatusResponse,
} from '@/models/project.model'
import { APIResponse } from '@/models/api-response'
import {
  MIGRATION_ENDPOINTS,
  PROJECT_ENDPOINTS,
  IDENTITY_PROJECT_ENDPOINTS,
  CLOUD_BUILD_GATEWAY_ENDPOINTS,
} from '@/constants/projects'


export class ProjectService {
  private readonly httpClient = serviceInstances.logicService;

  getProjects(
    page = 0,
    pageSize = 100,
    tenantGroupId = '',
  ): Promise<IProjectGroup[]> {
    const url = `${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`
    return this.httpClient.get(url, undefined, { absoluteUrl: true })
  }

  // Data Migration Methods
  initiateMigration(
    payload: IMigrationRequest,
  ): Promise<IMigrationInitiateResponse> {
    return this.httpClient.post(MIGRATION_ENDPOINTS.MIGRATE, payload, undefined, {
      absoluteUrl: true,
    })
  }

  verifyMigration(
    payload: IVerifyMigrationRequest,
  ): Promise<IMigrationVerificationResponse> {
    return this.httpClient.post(MIGRATION_ENDPOINTS.VERIFY, payload, undefined, {
      absoluteUrl: true,
    })
  }

  getMigrationStatus(tenantGroupId: string): Promise<IMigrationStatusResponse> {
    const url = `${MIGRATION_ENDPOINTS.GET_STATUS}?tenantGroupId=${tenantGroupId}`
    return this.httpClient.get(url, undefined, { absoluteUrl: true })
  }

  getProject(payload: IGetProjectPayload): Promise<IGetProjectResponse> {
    const url = `${PROJECT_ENDPOINTS.GET}?projectId=${payload.projectId}`
    return this.httpClient.get(url, undefined, { absoluteUrl: true })
  }
  getEnvRepositories(
    projectKey: string,
  ): Promise<APIResponse<IEnvRepository[]>> {
    const url = `${API_BASES.LOGIC}/build/repos-list?projectkey=${projectKey}`
    return this.httpClient.get(url, undefined, { absoluteUrl: true })
  }

  repoUpdate(payload: {
    projectKey: string
    projectEnv: string
    repoWithDomains: {
      repoId: string
      repoUrl: string
      customDeploymentDomain: string
    }[]
  }): Promise<{
    errors: unknown | null
    isSuccess: boolean
  }> {
    const url = CLOUD_BUILD_GATEWAY_ENDPOINTS.REPO_UPDATE
    return this.httpClient.post(url, payload)
  }

  createProject(payload: ICreateProjectPayload): Promise<{
    isSuccess: boolean
    errors: Record<string, string | string[]>
    tenantGroupId: string
  }> {
    return this.httpClient.post(IDENTITY_PROJECT_ENDPOINTS.CREATE, payload)
  }

  validateCNameProject(
    payload: IValidateCNameProjectPayload,
  ): Promise<IValidateCNameProjectResponse> {
    const url = IDENTITY_PROJECT_ENDPOINTS.CONFIGURE_DOMAIN
    return this.httpClient.post(url, payload)
  }

  updateProject(
    payload: IUpdateProjectPayload,
  ): Promise<IUpdateProjectResponse> {
    const url = IDENTITY_PROJECT_ENDPOINTS.UPDATE_PROJECT
    return this.httpClient.post(url, payload)
  }

  updateTenantGroup(
    payload: IUpdateTenantGroupPayload,
  ): Promise<IUpdateTenantGroupResponse> {
    const url = IDENTITY_PROJECT_ENDPOINTS.UPDATE_TENANT_GROUP
    return this.httpClient.post(url, payload)
  }

  getProjectLoginOption(): Promise<IGetProjectLoginOptionResponse> {
    const url = IDENTITY_PROJECT_ENDPOINTS.GET_LOGIN_OPTIONS
    return this.httpClient.get(url)
  }
  disableProject(
    payload: IDisableProjectPayload,
  ): Promise<IDisableProjectResponse> {
    return this.httpClient.post(PROJECT_ENDPOINTS.DISABLE, payload)
  }
}

export const projectService = new ProjectService()
