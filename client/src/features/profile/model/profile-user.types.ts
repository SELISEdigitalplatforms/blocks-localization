export type DeviceInformation = {
  Browser: string;
  OS: string;
  Device: string;
  Brand: string;
  Model: string;
};

export type User = {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  language: string;
  salutation: string;
  firstName: string;
  lastName: string;
  email: string;
  userName: string;
  phoneNumber: string;
  active: boolean;
  isVarified: boolean;
  profileImageUrl: string;
  mfaEnabled: boolean;
  lastLoggedInTime: string;
  logInCount: number;
  userMfaType: number;
  isMfaVerified: boolean;
  userCreationType: number;
};

export type IGetUserByIdPayload = { id: string; projectKey: string };

export type IGetUserByIdResponse = {
  data: User;
  errors: unknown;
};

export type IUpdateUserPayload = {
  itemId: string;
  projectKey: string;
  salutation?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  tags?: string[];
  profileImageUrl?: string;
  profileImageId?: string;
  userMfaType?: number;
  mfaEnabled?: boolean;
};

export type IUpdateUserResponse = {
  errors: unknown;
  isSuccess: boolean;
  itemId: string | null;
};

export type IGetSessionPayload = {
  page: number;
  pageSize: number;
  filter: { UserId: string };
  projectKey: string;
};

export type IDeviceSession = {
  RefreshToken: string;
  TenantId: string;
  IssuedUtc: string;
  ExpiresUtc: string;
  UserId: string;
  IpAddresses: string;
  DeviceInformation: DeviceInformation;
  CreateDate: string;
  UpdateDate: string;
  IsActive: boolean;
  _id: string;
};

export type IDeviceSessionResponse = {
  totalCount: number;
  data: IDeviceSession[];
  errors: unknown;
};

export type IGetHistoriesPayload = IGetSessionPayload;

export type IHistories = {
  _id: string;
  CreatedDate: string;
  LastUpdatedDate: string;
  CreatedBy: string;
  LastUpdatedBy: string;
  OrganizationIds: string[];
  Tags: string[];
  Event: string;
  ActionBy: string;
  IpAddresses: string;
  DeviceInformation: DeviceInformation;
};

export type IHistoriesResponse = {
  totalCount: number;
  data: IHistories[];
  errors: unknown;
};

export type IPATResponse = {
  note: string;
  itemId: string;
  createdDate: string;
  expiryDate: string;
  createdBy: string;
  language: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
  code: string;
  userId: string;
  clientId: string;
};

export type IGeneratePATPayload = {
  note?: string;
  codeTtlInMinute: number;
  clientId: string;
};
