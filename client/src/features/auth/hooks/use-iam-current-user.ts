import { useAuthStore } from "@/features/auth/model/auth-store";
import { fetchIamCurrentUser } from "@/features/auth/services/iam-user-api";
import { env } from "@/config/env";
import { useQuery } from "@tanstack/react-query";

export function useIamCurrentUser() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: ["idp", "iam", "current-user"],
    queryFn: fetchIamCurrentUser,
    enabled: Boolean(isAuthenticated && env.apiBaseUrl),
    staleTime: 60_000,
  });
}
