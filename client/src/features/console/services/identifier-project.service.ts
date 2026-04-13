import { env } from "@/config/env";
import type { IProject, IProjectGroup } from "@/features/console/model/project";
import type { IdentifierAssetsResponse, IResource } from "@/features/console/model/resource";
import { idpGet, idpPostJson } from "@/platform/api/idp-http";

export type IdentifierResource = {
  name: string;
  link: string;
  resourceId: string;
};

export type CreateIdentifierProjectPayload = {
  name: string;
  isAcceptBlocksTerms: boolean;
  isUseBlocksExclusively: boolean;
  isProduction: boolean;
  resources: IdentifierResource[];
  applicationContexts: { environment: string; domain: string; cookieDomain: string }[];
  tenantGroupId?: string;
};

export type CreateIdentifierProjectResponse = {
  isSuccess: boolean;
  errors: Record<string, string | string[]>;
  tenantGroupId: string;
};

export function fetchIdentifierProjects(
  page: number,
  pageSize: number,
  tenantGroupId: string,
): Promise<IProjectGroup[]> {
  const q = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    tenantGroupId,
  });
  return idpGet<IProjectGroup[]>(`/identifier/v1/Project/Gets?${q.toString()}`);
}

export function createIdentifierProject(payload: CreateIdentifierProjectPayload) {
  return idpPostJson<CreateIdentifierProjectResponse>("/identifier/v1/Project/Create", payload);
}

export type IdentifierProjectDetailResponse = {
  data: IProject;
  errors: unknown | null;
};

export function fetchIdentifierProject(projectId: string) {
  const q = new URLSearchParams({ projectId });
  return idpGet<IdentifierProjectDetailResponse>(`/identifier/v1/Project/Get?${q.toString()}`);
}

export function getDefaultCookieDomain(): string {
  return env.baseDomain;
}

export function fetchIdentifierAssets(
  tenantGroupId: string,
  page: number,
  pageSize: number,
  search: string,
): Promise<IdentifierAssetsResponse> {
  let url = `/identifier/v1/Project/GetAsset?TenantGroupId=${encodeURIComponent(tenantGroupId)}&Page=${page}&PageSize=${pageSize}`;
  if (search.trim()) {
    const q = encodeURIComponent(search.trim());
    url += `&Filter.Name=${q}&Filter.Link=${q}`;
  }
  return idpGet<IdentifierAssetsResponse>(url);
}

export function addIdentifierAsset(payload: { tenantGroupId: string; resource: IResource }) {
  return idpPostJson<{ errors: unknown | null; isSuccess: boolean }>(
    "/identifier/v1/Project/AddAsset",
    payload,
  );
}

export type UpdateTenantGroupPayload = {
  tenantGroupId: string;
  name: string;
};

export type UpdateTenantGroupResponse = {
  errors: unknown | null;
  isSuccess: boolean;
};

export function updateTenantGroup(payload: UpdateTenantGroupPayload) {
  return idpPostJson<UpdateTenantGroupResponse>("/identifier/v1/Project/UpdateTenantGroup", payload);
}

export type MigrationServiceDetails = {
  shouldOverWriteExistingData: boolean;
  serviceName: number;
};

export type MigrationRequestPayload = {
  projectKey: string;
  targetedProjectKey: string;
  tenantGroupId: string;
  services: MigrationServiceDetails[];
};

export type MigrationInitiateResponse = {
  verificationId: string;
  isSuccess: boolean;
};

export type VerifyMigrationPayload = {
  verificationId: string;
  verificationCode: string;
};

export type MigrationVerificationResponse = {
  isValid: boolean;
  isSuccess: boolean;
  errors: unknown | null;
};

export function postInitiateMigration(payload: MigrationRequestPayload) {
  return idpPostJson<MigrationInitiateResponse>("/identifier/v1/Migration/Migrate", payload);
}

export function postVerifyMigration(payload: VerifyMigrationPayload) {
  return idpPostJson<MigrationVerificationResponse>("/identifier/v1/Migration/Verify", payload);
}
