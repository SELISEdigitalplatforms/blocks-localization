import { API_BASES } from '@/constants/endpoint.constant'
import { http } from '@/lib/http-client'
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
import { MIGRATION_ENDPOINTS, PROJECT_ENDPOINTS } from '@/constants/projects'


export class ProjectService {
  getProjects(
    page = 0,
    pageSize = 100,
    tenantGroupId = '',
  ): Promise<IProjectGroup[]> {
    const url = `${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`
    return http.get(url, undefined, { absoluteUrl: true })
  }

  // Data Migration Methods
  initiateMigration(
    payload: IMigrationRequest,
  ): Promise<IMigrationInitiateResponse> {
    return http.post(MIGRATION_ENDPOINTS.MIGRATE, payload, undefined, {
      absoluteUrl: true,
    })
  }

  verifyMigration(
    payload: IVerifyMigrationRequest,
  ): Promise<IMigrationVerificationResponse> {
    return http.post(MIGRATION_ENDPOINTS.VERIFY, payload, undefined, {
      absoluteUrl: true,
    })
  }

  getMigrationStatus(tenantGroupId: string): Promise<IMigrationStatusResponse> {
    const url = `${MIGRATION_ENDPOINTS.GET_STATUS}?tenantGroupId=${tenantGroupId}`
    return http.get(url, undefined, { absoluteUrl: true })
  }

  getProject(payload: IGetProjectPayload): Promise<IGetProjectResponse> {
    const url = `${PROJECT_ENDPOINTS.GET}?projectId=${payload.projectId}`
    return http.get(url, undefined, { absoluteUrl: true })
  }
  getEnvRepositories(
    projectKey: string,
  ): Promise<APIResponse<IEnvRepository[]>> {
    const url = `${API_BASES.LOGIC}/build/repos-list?projectkey=${projectKey}`
    return http.get(url, undefined, { absoluteUrl: true })
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
    const url = `/cloudbuild/v1/build/repo-update`
    return http.post(url, payload)
  }

  createProject(payload: ICreateProjectPayload): Promise<{
    isSuccess: boolean
    errors: Record<string, string | string[]>
    tenantGroupId: string
  }> {
    return http.post(`/identifier/v1/Project/Create`, payload)
  }

  validateCNameProject(
    payload: IValidateCNameProjectPayload,
  ): Promise<IValidateCNameProjectResponse> {
    const url = `/identifier/v1/Domain/Configure`
    return http.post(url, payload)
  }

  updateProject(
    payload: IUpdateProjectPayload,
  ): Promise<IUpdateProjectResponse> {
    const url = `/identifier/v1/Project/UpdateProject`
    return http.post(url, payload)
  }

  updateTenantGroup(
    payload: IUpdateTenantGroupPayload,
  ): Promise<IUpdateTenantGroupResponse> {
    const url = `/identifier/v1/Project/UpdateTenantGroup`
    return http.post(url, payload)
  }

  getProjectLoginOption(): Promise<IGetProjectLoginOptionResponse> {
    const url = `/identifier/v1/Project/GetLoginOptions`
    return http.get(url)
  }
  disableProject(
    payload: IDisableProjectPayload,
  ): Promise<IDisableProjectResponse> {
    return http.post(PROJECT_ENDPOINTS.DISABLE, payload)
  }
}

export const projectService = new ProjectService()
