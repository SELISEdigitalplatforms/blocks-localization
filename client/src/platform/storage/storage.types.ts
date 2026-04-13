export interface IGetPreSignedUrlForUploadPayload {
  itemId?: string;
  name: string;
  configurationName: string;
  projectKey: string;
  metaData: string;
  parentDirectoryId: string;
  tags: string;
  accessModifier: string;
  agentId?: string;
  additionalProperties?: Record<string, unknown>;
  moduleName: number;
}

export interface IGetPreSignedUrlForUploadResponse {
  errors: null | unknown;
  isSuccess: boolean;
  fileId: string;
  uploadUrl: string;
}

export interface IGetFileByFileIDPayload {
  itemId: string;
  projectKey: string;
  configurationName?: string;
}

export interface IGetFileByFileIDResponse {
  url: string;
  accessModifier: number;
  itemId: string;
  tags: string[];
  metaData: Record<string, unknown>;
  name: string;
  parentDirectoryID: string;
  systemName: string;
  type: number;
  typeString: string;
  createDate: string;
  createdBy: string;
  language: string;
  tenantId: string;
}
