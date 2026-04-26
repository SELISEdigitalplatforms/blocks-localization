import { env } from "@/config/env";
import { fetchIdentifierAssets } from "@/features/console/services/identifier-project.service";
import { useQuery } from "@tanstack/react-query";

export function useIdentifierAssets(
  tenantGroupId: string,
  page: number,
  pageSize: number,
  search: string,
) {
  return useQuery({
    queryKey: ["identifier", "assets", tenantGroupId, page, pageSize, search],
    queryFn: () => fetchIdentifierAssets(tenantGroupId, page, pageSize, search),
    enabled: Boolean(env.apiBaseUrl && tenantGroupId),
    staleTime: 0,
  });
}
