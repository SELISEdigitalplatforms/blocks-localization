import { PROFILE_QUERY_KEYS } from "@/features/profile/hooks/profile-query-keys";
import type {
  IGeneratePATPayload,
  IGetHistoriesPayload,
  IGetSessionPayload,
  IPATResponse,
} from "@/features/profile/model/profile-user.types";
import {
  profileGeneratePat,
  profileGetHistories,
  profileGetPats,
  profileGetSessions,
} from "@/features/profile/services/profile-iam.service";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export function useProfileGetSessions(option: IGetSessionPayload) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.sessions({
      page: option.page,
      pageSize: option.pageSize,
      userId: option.filter.UserId,
      projectKey: option.projectKey,
    }),
    queryFn: () => profileGetSessions(option),
    enabled: Boolean(option.projectKey && option.filter.UserId),
  });
}

export function useProfileGetHistories(option: IGetHistoriesPayload) {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.histories({
      page: option.page,
      pageSize: option.pageSize,
      userId: option.filter.UserId,
      projectKey: option.projectKey,
    }),
    queryFn: () => profileGetHistories(option),
    enabled: Boolean(option.projectKey && option.filter.UserId),
  });
}

export function useProfileGetPats() {
  return useQuery({
    queryKey: PROFILE_QUERY_KEYS.pats(),
    queryFn: () => profileGetPats(),
    select: (data): IPATResponse[] => {
      if (!data || !Array.isArray(data)) return [];
      return [...data].sort((a, b) => {
        const dateA = new Date(a.createdDate || 0).getTime();
        const dateB = new Date(b.createdDate || 0).getTime();
        return dateB - dateA;
      });
    },
  });
}

export function useProfileGeneratePats() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["profile", "personalAccessTokens", "generate"],
    mutationFn: (payload: IGeneratePATPayload) => profileGeneratePat(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEYS.pats() });
      showSuccessToast({ description: "Token generated successfully!" });
    },
    onError: () => {
      showErrorToast({ errors: "Failed to generate token" });
    },
  });
}
