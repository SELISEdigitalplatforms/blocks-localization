import { environmentOptions } from "@/features/console/constants/environment-options";
import type { PeopleGroupedByEnvironments } from "@/features/console/model/people";
import type { IProjectGroup } from "@/features/console/model/project";
import {
  useInvitePeopleMutation,
  useRemoveEnvironmentAccessMutation,
} from "@/features/console/hooks/use-project-overview-mutations";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Button } from "@/platform/ui/components/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import type { User } from "@/features/profile/model/profile-user.types";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

type PendingAction = { type: "add" | "remove"; envValue: string } | null;

export function ProjectOverviewPeopleEnvironments({
  user,
  peopleData,
  environmentList,
  isViewerOwner = false,
}: {
  user?: User;
  peopleData?: PeopleGroupedByEnvironments[] | undefined;
  environmentList?: IProjectGroup[] | undefined;
  isViewerOwner?: boolean;
}) {
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const userEnvironmentData = peopleData?.[0];
  const sharedEnvironments = useMemo(
    () => userEnvironmentData?.sharedEnviroments || [],
    [userEnvironmentData?.sharedEnviroments],
  );
  const isProfileUserOwner = sharedEnvironments.some((env) => env.isCreator);

  const withAccessEnvironments = useMemo(
    () => sharedEnvironments.map((env) => env.enviroment),
    [sharedEnvironments],
  );

  const allAvailableEnvironments = useMemo(() => {
    const projects = environmentList?.[0]?.projects?.map((project) => project.environment) || [];
    const nonShared =
      environmentList?.[0]?.nonSharedProject?.map((project) => project.environment) || [];
    return Array.from(new Set([...projects, ...nonShared]));
  }, [environmentList]);

  const currentAvailableEnvironments = useMemo(() => {
    if (isProfileUserOwner) return allAvailableEnvironments;
    return withAccessEnvironments;
  }, [isProfileUserOwner, allAvailableEnvironments, withAccessEnvironments]);

  const withoutAccessEnvironments = useMemo(() => {
    return allAvailableEnvironments.filter((env) => !currentAvailableEnvironments.includes(env));
  }, [allAvailableEnvironments, currentAvailableEnvironments]);

  const { mutateAsync: removeEnvAsync, isPending: isRemoving } = useRemoveEnvironmentAccessMutation();
  const { mutateAsync: inviteAsync, isPending: isInviting } = useInvitePeopleMutation();
  const isProcessing = isRemoving || isInviting;

  const getEnvironmentLabel = (value: string) => {
    return environmentOptions.find((opt) => opt.value === value)?.label || value;
  };

  const getProjectIdForEnvironment = useCallback(
    (envValue: string) => {
      const projectFromEnvList = environmentList?.[0]?.projects?.find((p) => p.environment === envValue);
      if (projectFromEnvList?.tenantId) return projectFromEnvList.tenantId;

      const projectFromShared = sharedEnvironments.find((e) => e.enviroment === envValue);
      return projectFromShared?.tenantId || "";
    },
    [environmentList, sharedEnvironments],
  );

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRemoveClick = useCallback((envValue: string) => {
    setPendingAction({ type: "remove", envValue });
    setConfirmOpen(true);
  }, []);

  const handleAddClick = useCallback((envValue: string) => {
    setPendingAction({ type: "add", envValue });
    setConfirmOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setConfirmOpen(false);
    setPendingAction(null);
  }, []);

  const onConfirmOpenChange = useCallback(
    (open: boolean) => {
      if (!open) handleCloseDialog();
    },
    [handleCloseDialog],
  );

  const handleConfirm = useCallback(async () => {
    if (!pendingAction || !user?.email) return;

    const { type, envValue } = pendingAction;
    const projectId = getProjectIdForEnvironment(envValue);
    const effectiveGroupId = groupId || environmentList?.[0]?.tenantGroupId || "";

    try {
      if (type === "add") {
        if (!projectId) {
          showErrorToast({ errors: "Missing project for environment" });
          return;
        }
        const res = await inviteAsync({
          invitations: { [user.email]: [projectId] },
          groupId: effectiveGroupId,
        });
        if (!res.isSuccess) {
          throw new Error(`Failed to grant access to ${getEnvironmentLabel(envValue)}`);
        }
        showSuccessToast({ description: `Access granted to ${getEnvironmentLabel(envValue)}` });
      } else {
        if (!projectId) {
          showErrorToast({ errors: "Missing project for environment" });
          return;
        }
        const res = await removeEnvAsync({
          email: user.email,
          projectKeys: [projectId],
          groupId: effectiveGroupId,
        });
        if (!res.isSuccess) {
          throw new Error(`Failed to remove access from ${getEnvironmentLabel(envValue)}`);
        }
        showSuccessToast({ description: `Access removed from ${getEnvironmentLabel(envValue)}` });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update access";
      showErrorToast({ errors: message });
    } finally {
      handleCloseDialog();
    }
  }, [
    pendingAction,
    user,
    groupId,
    environmentList,
    inviteAsync,
    removeEnvAsync,
    handleCloseDialog,
    getProjectIdForEnvironment,
  ]);

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">User data not available</div>
        </CardContent>
      </Card>
    );
  }

  const pendingEnvLabel = pendingAction ? getEnvironmentLabel(pendingAction.envValue) : "";

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Environment Access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <div className="text-sm font-semibold text-foreground">With access to</div>
            <div className="flex flex-wrap gap-3">
              {currentAvailableEnvironments.length > 0 ? (
                currentAvailableEnvironments.map((envValue) => (
                  <div
                    key={envValue}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 shadow-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium">{getEnvironmentLabel(envValue)}</span>
                    {isViewerOwner && !isProfileUserOwner ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveClick(envValue)}
                        disabled={isProcessing}
                        className="ml-2 cursor-pointer p-1 text-destructive transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Remove access"
                        aria-label={`Remove access from ${getEnvironmentLabel(envValue)}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm italic text-muted-foreground">No environments with access yet</div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="text-sm font-semibold text-foreground">Without access to</div>
            <div className="flex flex-wrap gap-3">
              {withoutAccessEnvironments.length > 0 ? (
                withoutAccessEnvironments.map((envValue) => (
                  <div
                    key={envValue}
                    className="flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 shadow-sm transition-colors hover:bg-muted/50"
                  >
                    <span className="text-sm font-medium">{getEnvironmentLabel(envValue)}</span>
                    {isViewerOwner && !isProfileUserOwner ? (
                      <button
                        type="button"
                        onClick={() => handleAddClick(envValue)}
                        disabled={isProcessing}
                        className="ml-2 cursor-pointer p-1 text-primary transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Grant access"
                        aria-label={`Grant access to ${getEnvironmentLabel(envValue)}`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="py-2 text-sm italic text-muted-foreground">Has access to all environments</div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction?.type === "add" ? "Grant Access" : "Remove Access"}</DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "add"
                ? `Are you sure you want to grant ${user.email} access to ${pendingEnvLabel}?`
                : `Are you sure you want to remove ${user.email}'s access from ${pendingEnvLabel}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isProcessing}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleConfirm()} disabled={isProcessing}>
              {pendingAction?.type === "add" ? "Grant" : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
