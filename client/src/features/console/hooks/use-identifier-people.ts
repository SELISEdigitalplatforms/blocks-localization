import { env } from "@/config/env";
import { postIdentifierPeopleGets } from "@/features/console/services/identifier-people.service";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { useQuery } from "@tanstack/react-query";

export function useIdentifierPeople(option: {
  page: number;
  pageSize: number;
  filter: string;
  /** When `false`, skip fetch (e.g. people detail before user email is known). */
  enabled?: boolean;
}) {
  const projectGroupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const queryEnabled = option.enabled !== false;

  return useQuery({
    queryKey: ["identifier", "people", projectGroupId, option.page, option.pageSize, option.filter],
    queryFn: () =>
      postIdentifierPeopleGets({
        page: option.page,
        pageSize: option.pageSize,
        filter: option.filter,
        projectGroupId,
      }),
    select: (response) => ({
      peoples: response.peoples,
      totalCount: response.totalCount,
      isOwner: response.isOwner,
    }),
    enabled: Boolean(env.apiBaseUrl && projectGroupId && queryEnabled),
    refetchOnMount: "always",
  });
}
