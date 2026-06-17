import { serviceInstances } from "@/lib/http-client";
import {
  CreateRolePayload,
  GetRolesPayload,
  GetRolesResponse,
  IGetRolePayload,
  IGetRoleResponse,
  IRole,
  SetRoles,
  UpdateRolePayload,
} from "@blocks-idp/iam/models/role";
import { ROLE_ENDPOINTS } from "../constants/endpoint.constant";

export class RoleService {
  private readonly httpClient = serviceInstances.idpService;

  getRoles(payload: GetRolesPayload): Promise<GetRolesResponse> {
    return this.httpClient.post(ROLE_ENDPOINTS.GET_ROLES, payload, undefined, { absoluteUrl: true });
  }

  getRoleById(payload: IGetRolePayload): Promise<IGetRoleResponse> {
    return this.httpClient.get(`${ROLE_ENDPOINTS.GET_ROLE}?projectKey=${payload.projectKey}&id=${payload.id}`, undefined, { absoluteUrl: true });
  }

  addRole(payload: CreateRolePayload): Promise<IRole> {
    return this.httpClient.post(ROLE_ENDPOINTS.CREATE_ROLE, payload, undefined, { absoluteUrl: true });
  }

  updateRole(payload: UpdateRolePayload) {
    return this.httpClient.post<{
      errors: unknown;
      isSuccess: boolean;
      itemId: string;
    }>(ROLE_ENDPOINTS.UPDATE_ROLE, payload, undefined, { absoluteUrl: true });
  }

  setRoles(addSetRolesPayload: SetRoles): Promise<SetRoles> {
    return this.httpClient.post<SetRoles>(ROLE_ENDPOINTS.SET_ROLES, { ...addSetRolesPayload }, undefined, { absoluteUrl: true });
  }
}

export const roleService = new RoleService();
