import { env } from "@/config/env";
import { fetchIdentifierProjects } from "@/features/console/services/identifier-project.service";
import { useQuery } from "@tanstack/react-query";

export function useConsoleProjects(tenantGroupId = "") {
  return useQuery({
    queryKey: ["identifier", "projects", tenantGroupId],
    queryFn: () => fetchIdentifierProjects(0, 100, tenantGroupId),
    enabled: Boolean(env.apiBaseUrl),
    staleTime: 0,
  });
}
