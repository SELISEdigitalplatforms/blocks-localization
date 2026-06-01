import { useProjectStore } from "@/store/useProjectStore";
import { useGetProjects, useGetMigrationStatus, useAddProjectEnvironment } from "@/cross-modules/localization/hooks/use-project";
import { EnvironmentCard } from "@/components/environment-card/environment-card";
import { AddEnvironmentModal } from "@/components/environment-card/add-environment-modal";
import { Plus, CircleHelp } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useState, useCallback } from "react";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { ProjectCardLoading } from "@/components/project-card/loading";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { useNotificationListener } from "@blocks-utilities/notification";

const ProjectGroupLoading = () => (
  <main className="flex flex-1 flex-col gap-4 p-4 sm:mx-10 md:gap-6">
    <div className="mt-4">
      <div className="mb-8 flex flex-row items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <div className="flex gap-4">
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array(8)
          .fill(1)
          .map((_, index) => (
            <ProjectCardLoading key={index} />
          ))}
      </div>
    </div>
  </main>
);

export const EnvironmentsPage = () => {
  const groupId = useProjectStore().selectedTenantGroup;
  const { data: environmentList, isLoading, isFetching } = useGetProjects(groupId ?? "");
  const [addEnvModalOpen, setAddEnvModalOpen] = useState(false);
  const { addEnvironment, isPending: isAddingEnvironment } = useAddProjectEnvironment();

  const { data: migrationStatus, refetch: refetchMigrationStatus } = useGetMigrationStatus(
    groupId as string,
  );

  const handleMigrationNotification = useCallback(
    (_: unknown) => {
      void refetchMigrationStatus();
    },
    [refetchMigrationStatus],
  );

  useNotificationListener("EnvironmentDataMigration", handleMigrationNotification);

  const handleAddEnvModalClose = useCallback(
    (selectedEnvironments?: string[]) => {
      setAddEnvModalOpen(false);
    },
    [],
  );

  const handleAddEnvironment = useCallback(
    async (selectedEnvironments: string[]) => {
      if (groupId) {
        await addEnvironment({
          selectedEnvironments,
          tenantGroupId: groupId,
          projectName: environmentList && environmentList[0]?.projects[0]?.name,
          onClose: () => {
            setAddEnvModalOpen(false);
          },
        });
      }
    },
    [groupId, environmentList, addEnvironment],
  );

  if (isLoading || isFetching || !environmentList || !environmentList[0]?.projects[0]) {
    return <ProjectGroupLoading />;
  }

  const canAddEnvironment = environmentList && environmentList[0]?.projects?.length < 8;

  return (
    <main className="flex flex-1 flex-col gap-4 p-6 md:gap-6">
      <div>
        {/* Header with title and Add Environment button */}
        <div className="mb-6 flex flex-row items-center justify-between">
          <h4 className="text-lg font-semibold md:text-xl">Environments</h4>
          {canAddEnvironment && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setAddEnvModalOpen(true)}
              className="h-10 whitespace-nowrap text-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Add Environment</span>
            </Button>
          )}
        </div>

        {/* Environment cards grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {environmentList[0]?.projects?.map((project) => (
            <EnvironmentCard
              key={`shared-${project.itemId}`}
              project={project}
              isMigrationOngoing={
                Array.isArray(migrationStatus) &&
                migrationStatus.some(
                  (data) => data.targetedProjectKey === project.tenantId,
                )
              }
            />
          ))}
        </div>

        {/* Others section for shared projects */}
        {environmentList[0]?.isShared && environmentList[0]?.nonSharedProject?.length > 0 && (
          <>
            <div className="mb-4 mt-8 border-b-2 border-border pb-2">
              <h5 className="text-sm font-medium text-muted-foreground">Others</h5>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {environmentList[0]?.nonSharedProject?.map((project) => (
                <div key={`others-${project.itemId}`} className="pointer-events-none opacity-60 grayscale">
                  <EnvironmentCard
                    key={`others-${project.itemId}`}
                    project={project}
                    isMigrationOngoing={
                      Array.isArray(migrationStatus) &&
                      migrationStatus.some(
                        (data) => data.targetedProjectKey === project.tenantId,
                      )
                    }
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Environment Dialog */}
      <Dialog open={addEnvModalOpen} onOpenChange={setAddEnvModalOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg border p-6 shadow-lg md:max-h-[85vh] md:w-[500px]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg md:text-xl">Add Environment</DialogTitle>
            <DialogDescription className="flex flex-col gap-2 text-sm md:flex-row md:items-start md:gap-2">
              <span className="flex flex-row items-start gap-2">
                <span>Please add the environments you want to configure.</span>
                <Tooltip>
                  <TooltipTrigger type="button" asChild>
                    <CircleHelp className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs font-normal md:max-w-96 md:text-sm">
                    You must have the corresponding branch in your repository.
                  </TooltipContent>
                </Tooltip>
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(90vh-160px)] overflow-y-auto md:max-h-[calc(85vh-160px)]">
            <AddEnvironmentModal
              tenantGroupId={groupId ?? undefined}
              projectName={environmentList && environmentList[0]?.projects[0]?.name}
              preSelectedEnvironments={environmentList
                .map((env) => env.projects.map((p) => p.environment))
                .flat()}
              onClose={handleAddEnvModalClose}
              onSave={handleAddEnvironment}
              isLoading={isAddingEnvironment}
            />
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
};
