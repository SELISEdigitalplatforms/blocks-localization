import { IAM_ENDPOINTS } from "@/features/auth/services/endpoints";
import { idpGet } from "@/platform/api/idp-http";

/** Subset of IDP `User` used in the shell avatar. */
export type IamUserDto = {
  itemId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  profileImageUrl?: string;
};

export type IamGetUserResponse = {
  data: IamUserDto;
};

export function fetchIamCurrentUser() {
  return idpGet<IamGetUserResponse>(IAM_ENDPOINTS.GET_USER);
}
