import { env } from "@/config/env";
import { fetchIdentifierProject } from "@/features/console/services/identifier-project.service";
import { useQuery } from "@tanstack/react-query";

export function useDashboardProjectDetail(projectId: string) {
  return useQuery({
    queryKey: ["identifier", "project", projectId],
    queryFn: () => fetchIdentifierProject(projectId),
    enabled: Boolean(env.apiBaseUrl && projectId),
    staleTime: 0,
  });
}
