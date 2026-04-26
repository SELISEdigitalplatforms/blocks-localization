import { ProjectOverviewInvitePeople } from "@/features/console/components/project-overview/project-overview-invite-people";
import { ProjectOverviewPeopleTable } from "@/features/console/components/project-overview/project-overview-people-table";
import { environmentOptions } from "@/features/console/constants/environment-options";
import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import { useIdentifierPeople } from "@/features/console/hooks/use-identifier-people";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Card, CardContent, CardHeader } from "@/platform/ui/components/card/card";
import { Input } from "@/platform/ui/components/input/input";
import { Pagination } from "@/platform/ui/components/pagination/pagination";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import { PageMeta } from "@/seo/page-meta";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function PeopleManagementLoading() {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-6 md:gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-28" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-10 w-full max-w-md" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

export function ProjectOverviewPeoplePage() {
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(100);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data: projectsData, isLoading: projectsLoading } = useConsoleProjects(groupId);
  const { data, isLoading, isFetching } = useIdentifierPeople({
    page,
    pageSize,
    filter: debouncedSearch,
  });

  const envPickerOptions = useMemo(() => {
    const group = projectsData?.[0];
    if (!group?.projects?.length) return [];
    return group.projects.map((p) => {
      const mapping = environmentOptions.find((o) => o.value === p.environment);
      return { tenantId: p.tenantId, label: mapping?.label || p.environment || "Default" };
    });
  }, [projectsData]);

  const prefetchLoading = projectsLoading || !groupId;
  const tableLoading = isLoading || isFetching || prefetchLoading;

  if (prefetchLoading && !data) {
    return <PeopleManagementLoading />;
  }

  const peoples = data?.peoples ?? [];
  const totalCount = data?.totalCount ?? 0;
  const isViewerOwner = data?.isOwner ?? false;
  const existingEmails = peoples.map((p) => p.peopleDetails.email.toLowerCase());

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-6 md:gap-6">
      <PageMeta title="People" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold md:text-xl">People</h1>
        <ProjectOverviewInvitePeople
          existingEmails={existingEmails}
          isViewerOwner={isViewerOwner}
          environmentOptions={envPickerOptions}
        />
      </div>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              placeholder="Search.."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search people"
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-0">
          <ProjectOverviewPeopleTable
            people={peoples}
            isLoading={tableLoading}
            isViewerOwner={isViewerOwner}
          />
          {!tableLoading && peoples.length > 0 ? (
            <div className="flex justify-end border-t border-border pt-4">
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={totalCount}
                pageSizeOptions={[10, 20, 50, 100]}
                onChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(0);
                }}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
