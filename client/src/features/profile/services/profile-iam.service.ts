import { PROFILE_AUTH_ENDPOINTS, PROFILE_IAM_ENDPOINTS } from "@/features/profile/constants/endpoints";
import { parseMongoDBString } from "@/features/profile/lib/parse-mongodb-string";
import type {
  IDeviceSessionResponse,
  IGeneratePATPayload,
  IGetHistoriesPayload,
  IGetSessionPayload,
  IGetUserByIdPayload,
  IGetUserByIdResponse,
  IHistoriesResponse,
  IPATResponse,
  IUpdateUserPayload,
  IUpdateUserResponse,
} from "@/features/profile/model/profile-user.types";
import { idpGet, idpPostJson } from "@/platform/api/idp-http";

export async function profileGetUserById(payload: IGetUserByIdPayload): Promise<IGetUserByIdResponse> {
  const q = new URLSearchParams({ id: payload.id, ProjectKey: payload.projectKey });
  return idpGet<IGetUserByIdResponse>(`${PROFILE_IAM_ENDPOINTS.GET_USER}?${q.toString()}`);
}

export async function profileUpdateUser(payload: IUpdateUserPayload): Promise<IUpdateUserResponse> {
  return idpPostJson<IUpdateUserResponse>(PROFILE_IAM_ENDPOINTS.UPDATE, payload);
}

export async function profileGetSessions(payload: IGetSessionPayload): Promise<IDeviceSessionResponse> {
  const res = await idpGet<{ data: string[]; errors: unknown; totalCount: number }>(
    `${PROFILE_IAM_ENDPOINTS.GET_SESSIONS}?page=${payload.page}&pageSize=${payload.pageSize}&projectkey=${payload.projectKey}&filter.userId=${payload.filter.UserId}`,
  );
  return {
    data: res.data.map((item) => JSON.parse(parseMongoDBString(item)) as IDeviceSessionResponse["data"][number]),
    totalCount: res.totalCount,
    errors: res.errors,
  };
}

export async function profileGetHistories(payload: IGetHistoriesPayload): Promise<IHistoriesResponse> {
  const res = await idpGet<{ data: string[]; errors: unknown; totalCount: number }>(
    `${PROFILE_IAM_ENDPOINTS.GET_HISTORIES}?page=${payload.page}&pageSize=${payload.pageSize}&projectkey=${payload.projectKey}&filter.userId=${payload.filter.UserId}`,
  );
  return {
    data: res.data.map((item) => JSON.parse(parseMongoDBString(item)) as IHistoriesResponse["data"][number]),
    totalCount: res.totalCount,
    errors: res.errors,
  };
}

export async function profileGetPats(): Promise<IPATResponse[]> {
  return idpGet<IPATResponse[]>(PROFILE_AUTH_ENDPOINTS.GET_USER_CODES);
}

export async function profileGeneratePat(payload: IGeneratePATPayload): Promise<IPATResponse> {
  return idpPostJson<IPATResponse>(PROFILE_AUTH_ENDPOINTS.GENERATE_USER_CODE, payload);
}
