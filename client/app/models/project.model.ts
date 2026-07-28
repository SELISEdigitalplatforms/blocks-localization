export enum GRANT_TYPES {
  password = "password",
  social = "social",
  clientCredential = "client_credential",
  authorizationCode = "authorization_code",
}

export enum SSO_PROVIDERS {
  google = "google",
  microsoft = "microsoft",
  github = "github",
  linkedin = "linkedin",
  x = "x",
  apple = "apple",
  facebook = "facebook",
  ownsso = "ownsso",
}

export interface IDomain {
  domain: string;
  cookieDomain: string;
  isDomainVerified: boolean;
}

export interface IProject {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
  name: string;
  applications: IDomain[];
  customDomain: string | null;
  cookieDomain: "blocksdevelopers.com";
  isProduction: true;
  tenantId: string;
  isCookieEnable: boolean;
  isDomainVerified: boolean;
  isDisabled: boolean;
  environment: string;
  tenantGroupId: string;
  tenantSlug: string;
}

export interface IResource {
  name: string;
  link: string;
  resourceId: string;
}
export interface IProjectGroup {
  tenantGroupId: string;
  projects: IProject[];
  nonSharedProject: IProject[];
  isShared: boolean;
}
export interface ICreateProjectPayload {
  name: string;
  isAcceptBlocksTerms: boolean;
  isUseBlocksExclusively: boolean;
  isProduction: boolean;
  resources: IResource[];
  applicationContexts: {
    environment: string;
    domain: string;
    cookieDomain: string;
  }[];
  tenantGroupId?: string;
}
export interface IGetProjectPayload {
  projectId: string;
}
export interface IGetProjectResponse {
  data: IProject;
  errors: unknown | null;
}

export interface IEnvRepository {
  itemId: string;
  repoName: string;
  repoUrl: string;
  defaultDeploymentUrl: string;
  customDeploymentUrl: string;
  lastDeploymentDate: string;
}

export interface IGetProjectAuthConfig {
  accountLockDurationInMinutes: number;
  certificateValidForNumberOfDays: number;
  getNumberOfWrongAttemptsToLockTheAccount: number;
  publicCertificatePath: string;
  certificateIssueDate: string;
  refreshTokenValidForNumberMinutes: number;
  allowedGrantTypes: string[];
}

export interface IValidateCNameProjectPayload {
  projectKey: string;
  cookieDomain: string;
}
export interface IValidateCNameProjectResponse {
  errors: unknown | null;
  isSuccess: boolean;
  isStatusChanged: boolean;
}

export interface IUpdateProjectPayload {
  name: string;
  projectKey: string;
  applicationDomain: string;
  isCookieEnable?: boolean;
  cookieDomain?: string;
  useCustomDomain?: boolean;
  customDomain?: string;
}
export interface IUpdateProjectResponse {
  errors: unknown | null;
  isSuccess: boolean;
}
export interface IDisableProjectPayload {
  projectKey: string;
}
export interface IDisableProjectResponse {
  errors: unknown | null;
  isSuccess: boolean;
}

export interface IUpdateTenantGroupPayload {
  tenantGroupId: string;
  name: string;
}
export interface IUpdateTenantGroupResponse {
  errors: unknown | null;
  isSuccess: boolean;
}

type SSO_INFO = {
  provider: SSO_PROVIDERS;
  audience: string;
};

export type LoginOption = {
  allowedGrantTypes: GRANT_TYPES[];
  ssoInfo: SSO_INFO[];
};

export interface IMigrationServiceDetails {
  shouldOverWriteExistingData: boolean;
  serviceName: number;
}
export interface IMigrationRequest {
  projectKey: string;
  targetedProjectKey: string;
  tenantGroupId: string;
  services: IMigrationServiceDetails[];
}

export interface IMigrationInitiateResponse {
  verificationId: string;
  isSuccess: boolean;
}

export interface IVerifyMigrationRequest {
  verificationId: string;
  verificationCode: string;
}

export interface IMigrationVerificationResponse {
  isValid: boolean;
  isSuccess: boolean;
  errors: unknown | null;
}

export type IMigrationStatusResponse = Array<{
  targetedProjectKey: string;
}>;
export type IGetProjectLoginOptionResponse = LoginOption;
