import { API_BASES } from './endpoint.constant'

const PROJECT_SUBPATH = 'Project'
export const PROJECT_ENDPOINTS = {
  GETS: `${API_BASES.LOGIC}/${PROJECT_SUBPATH}/Gets`,
  GET: `${API_BASES.LOGIC}/${PROJECT_SUBPATH}/Get`,
  DISABLE: `${API_BASES.LOGIC}/${PROJECT_SUBPATH}/Disable`,
}

const MIGRATION_SUBPATH = '/Migration'

export const MIGRATION_ENDPOINTS = {
  MIGRATE: `${API_BASES.LOGIC}${MIGRATION_SUBPATH}/Migrate`,
  VERIFY: `${API_BASES.LOGIC}${MIGRATION_SUBPATH}/Verify`,
  GET_STATUS: `${API_BASES.LOGIC}${MIGRATION_SUBPATH}/GetMigrationStatus`,
} as const

// Gateway-routed endpoints. These use the `/{service}/v1` gateway prefix rather than the
// `API_BASES` (`/api`) scheme, and are called as relative URLs (no `absoluteUrl`). The base
// prefix is centralized here so a routing change is made in one place instead of being
// hardcoded at each call site.
const IDENTIFIER_GATEWAY_BASE = '/identifier/v1'
const CLOUD_BUILD_GATEWAY_BASE = '/cloudbuild/v1'

export const IDENTITY_PROJECT_ENDPOINTS = {
  CREATE: `${IDENTIFIER_GATEWAY_BASE}/Project/Create`,
  UPDATE_PROJECT: `${IDENTIFIER_GATEWAY_BASE}/Project/UpdateProject`,
  UPDATE_TENANT_GROUP: `${IDENTIFIER_GATEWAY_BASE}/Project/UpdateTenantGroup`,
  GET_LOGIN_OPTIONS: `${IDENTIFIER_GATEWAY_BASE}/Project/GetLoginOptions`,
  CONFIGURE_DOMAIN: `${IDENTIFIER_GATEWAY_BASE}/Domain/Configure`,
} as const

export const CLOUD_BUILD_GATEWAY_ENDPOINTS = {
  REPO_UPDATE: `${CLOUD_BUILD_GATEWAY_BASE}/build/repo-update`,
} as const