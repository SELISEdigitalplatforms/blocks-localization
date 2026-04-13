import { AddEnvironmentModal } from "@/features/console/components/add-environment-modal";
import { EnvironmentOverviewCard } from "@/features/console/components/environment-overview-card";
import { ProjectCardLoading } from "@/features/console/components/project-card-loading";
import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import { useIdentifierPeople } from "@/features/console/hooks/use-identifier-people";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/ui/components/tooltip/tooltip";
import { PageMeta } from "@/seo/page-meta";
import { ArrowRightLeft, CircleHelp, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

function EnvironmentsLoading() {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-6 md:gap-6">
      <div className="mt-4">
        <div className="mb-8 flex flex-row items-center justify-between">
          <div className="h-8 w-40 animate-pulse rounded bg-muted" />
          <div className="flex gap-4">
            <div className="h-10 w-32 animate-pulse rounded bg-muted" />
            <div className="h-10 w-40 animate-pulse rounded bg-muted" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <ProjectCardLoading key={i} />
          ))}
        </div>
      </div>
    </main>
  );
}

export function ProjectOverviewEnvironmentsPage() {
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const { data: environmentList, isLoading, isFetching } = useConsoleProjects(groupId);
  const { data: peoplePeek } = useIdentifierPeople({ page: 0, pageSize: 1, filter: "" });
  const [addOpen, setAddOpen] = useState(false);

  if (isLoading || isFetching || !environmentList?.length || !environmentList[0]?.projects?.[0]) {
    return <EnvironmentsLoading />;
  }

  const group = environmentList[0];
  const isViewerOwner = peoplePeek?.isOwner ?? false;
  const canAddEnvironment = (group.projects?.length ?? 0) < 8 && isViewerOwner;

  const preSelectedEnvironments = environmentList.flatMap((g) =>
    g.projects.map((p) => p.environment),
  );

  const handleAddEnvModalClose = () => {
    setAddOpen(false);
  };

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-6 md:gap-6">
      <PageMeta title="Environments" />
      <div>
        <div className="mb-6 flex flex-row flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold md:text-xl">Environments</h1>
          <div className="flex flex-wrap gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              className="h-10 whitespace-nowrap border-border bg-background text-foreground hover:bg-muted/60 text-sm"
              asChild
            >
              <Link to="/data-migration">
                <ArrowRightLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Start Migration</span>
                <span className="sm:hidden">Migration</span>
              </Link>
            </Button>
            {canAddEnvironment ? (
              <Button
                variant="default"
                size="sm"
                className="h-10 whitespace-nowrap text-sm"
                type="button"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">New Environment</span>
                <span className="sm:hidden">New</span>
              </Button>
            ) : null}
          </div>
        </div>

        {group.isShared ? (
          <div className="mb-4 mt-6 border-b-2 border-border pb-2">
            <h5 className="text-sm font-medium text-muted-foreground">Shared with you</h5>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {group.projects?.map((project) => (
            <EnvironmentOverviewCard key={project.itemId} project={project} />
          ))}
        </div>

        {group.isShared && (group.nonSharedProject?.length ?? 0) > 0 ? (
          <>
            <div className="mb-4 mt-8 border-b-2 border-border pb-2">
              <h5 className="text-sm font-medium text-muted-foreground">Others</h5>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {group.nonSharedProject?.map((project) => (
                <div key={project.itemId} className="pointer-events-none grayscale">
                  <EnvironmentOverviewCard project={project} className="bg-muted" />
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-x-hidden overflow-y-auto rounded-lg border p-6 shadow-lg md:max-h-[85vh] md:w-[500px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg md:text-xl">Add Environment</DialogTitle>
            <DialogDescription className="flex min-w-0 flex-col gap-2 text-sm md:flex-row md:items-start md:gap-2">
              <span className="flex min-w-0 flex-row items-start gap-2">
                <span className="min-w-0 flex-1">Please add the environments you want to configure.</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {/*
                        Not a <button>: Radix Dialog focuses the first tabbable node on open, and Radix
                        Tooltip opens on focus as well as hover — a button here made the tooltip flash open.
                      */}
                      <span
                        className="mt-0.5 inline-flex shrink-0 cursor-help rounded-sm text-muted-foreground outline-none"
                        aria-label="More information"
                        role="img"
                      >
                        <CircleHelp className="h-4 w-4" aria-hidden />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs font-normal md:max-w-96 md:text-sm">
                      You must have the corresponding branch in your repository.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(90vh-160px)] overflow-x-hidden overflow-y-auto md:max-h-[calc(85vh-160px)]">
            <AddEnvironmentModal
              open={addOpen}
              tenantGroupId={groupId || undefined}
              projectName={group.projects?.[0]?.name}
              preSelectedEnvironments={preSelectedEnvironments}
              onClose={handleAddEnvModalClose}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
