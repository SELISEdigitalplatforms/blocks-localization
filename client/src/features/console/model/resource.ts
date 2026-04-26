export interface IResource {
  name: string;
  link: string;
  resourceId: string;
}

export type IdentifierAssetsResponse = {
  assets: {
    resources: IResource[];
    tenantGroupId: string;
    itemId: string;
    createdDate: string;
    lastUpdatedDate: string;
    createdBy: string;
    language: string | null;
    lastUpdatedBy: string;
    organizationIds: string[];
    tags: string[];
  };
  totalCount: number;
  errors: unknown | null;
  isSuccess: boolean;
};
