import type { IGetUserByIdPayload } from "@/features/profile/model/profile-user.types";
import { profileGetUserById } from "@/features/profile/services/profile-iam.service";
import { PROFILE_QUERY_KEYS } from "@/features/profile/hooks/profile-query-keys";
import { useQuery } from "@tanstack/react-query";

export function useProfileUserById(option: IGetUserByIdPayload) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.userById(option),
    queryFn: () => profileGetUserById(option),
    enabled: Boolean(option.id && option.projectKey),
  });
}
