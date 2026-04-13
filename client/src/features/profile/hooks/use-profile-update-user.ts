import { IAM_CURRENT_USER_QUERY_KEY, PROFILE_QUERY_KEYS } from "@/features/profile/hooks/profile-query-keys";
import type { IGetUserByIdPayload, IUpdateUserPayload, IUpdateUserResponse } from "@/features/profile/model/profile-user.types";
import { profileUpdateUser } from "@/features/profile/services/profile-iam.service";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useProfileUpdateUser(options: { id: string; projectKey: string; own?: boolean }) {
  const queryClient = useQueryClient();
  const { own = false, id, projectKey } = options;
  const byIdPayload: IGetUserByIdPayload = { id, projectKey };

  return useMutation({
    mutationKey: ["profile", "users", "update", options],
    mutationFn: (payload: IUpdateUserPayload) => profileUpdateUser(payload),
    onSuccess: () => {
      if (own) void queryClient.invalidateQueries({ queryKey: IAM_CURRENT_USER_QUERY_KEY });
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.userById(byIdPayload) });
    },
  });
}

export type { IUpdateUserResponse };
