import { API_BASES } from "@/constants/endpoint.constant";

// ─── People endpoints ─────────────────────────────────────────────────────────

const PEOPLE_SUBPATH = "/People";

export const PEOPLE_ENDPOINTS = {
  CONFIRM_INVITATION: `${API_BASES.IDENTIFIER}${PEOPLE_SUBPATH}/ConfirmInvitation`,
  GETS: `${API_BASES.IDENTIFIER}${PEOPLE_SUBPATH}/Gets`,
  INVITE: `${API_BASES.IDENTIFIER}${PEOPLE_SUBPATH}/Invite`,
  RESEND_INVITATION: `${API_BASES.IDENTIFIER}${PEOPLE_SUBPATH}/ResendInvitation`,
  REMOVE_ACCESS: `${API_BASES.LOGIC}${PEOPLE_SUBPATH}/RemoveAccess`,
  SIGNUP: `${API_BASES.LOGIC}${PEOPLE_SUBPATH}/Signup`,
  TRANSFER_OWNERSHIP: `${API_BASES.LOGIC}${PEOPLE_SUBPATH}/TransferOwnerShip`,
} as const;

// ─── Project endpoints ────────────────────────────────────────────────────────

const PROJECT_SUBPATH = "/Project";

export const PROJECT_ENDPOINTS = {
  GETS: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/Gets`,
  GET: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/Get`,
  CREATE: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/Create`,
  UPDATE: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/UpdateProject`,
  UPDATE_TENANT_GROUP: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/UpdateTenantGroup`,
  DISABLE: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/Disable`,

  GET_ASSET: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/GetAsset`,
  ADD_ASSET: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/AddAsset`,
  GET_LOGIN_OPTIONS: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/GetLoginOptions`,
  UPDATE_TOKEN_VALIDATION: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/UpdateTokenValidationParameters`,
  GET_TOKEN_VALIDATION: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/GetTokenValidationParameters`,
  ADD_JWT_CLAIM: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/AddJwtClaim`,
  GET_JWT_CLAIMS: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/GetThirdPartyJWTClaims`,
  SAVE_JWT_CLAIMS: `${API_BASES.LOGIC}${PROJECT_SUBPATH}/SaveThirdPartyJWTClaims`,
} as const;

// ─── Domain endpoints ─────────────────────────────────────────────────────────

const DOMAIN_SUBPATH = "/Domain";

export const DOMAIN_ENDPOINTS = {
  CONFIGURE: `${API_BASES.LOGIC}${DOMAIN_SUBPATH}/Configure`,
} as const;

// ─── Migration endpoints ──────────────────────────────────────────────────────

const MIGRATION_SUBPATH = "/Migration";

export const MIGRATION_ENDPOINTS = {
  MIGRATE: `${API_BASES.LOGIC}${MIGRATION_SUBPATH}/Migrate`,
  VERIFY: `${API_BASES.LOGIC}${MIGRATION_SUBPATH}/Verify`,
  GET_STATUS: `${API_BASES.LOGIC}${MIGRATION_SUBPATH}/GetMigrationStatus`,
} as const;

// ─── Subscription endpoints ───────────────────────────────────────────────────

const SUBSCRIPTION_SUBPATH = "/Subscription";

export const SUBSCRIPTION_ENDPOINTS = {
  GETS: `${API_BASES.LOGIC}${SUBSCRIPTION_SUBPATH}/Gets`,
} as const;

// ─── Service Registry endpoints ───────────────────────────────────────────────

const SERVICE_SUBPATH = "/Service";

export const SERVICE_REGISTRY_ENDPOINTS = {
  REGISTER: `${API_BASES.LOGIC}${SERVICE_SUBPATH}/Register`,
  GET_ALL: `${API_BASES.LOGIC}${SERVICE_SUBPATH}/GetAll`,
} as const;

// ─── Cloud Build endpoints ────────────────────────────────────────────────────

const BUILD_SUBPATH = "/build";

export const CLOUD_BUILD_ENDPOINTS = {
  REPOS_LIST: `${API_BASES.LOGIC}${BUILD_SUBPATH}/repos-list`,
  REPO_UPDATE: `${API_BASES.LOGIC}${BUILD_SUBPATH}/repo-update`,
} as const;
