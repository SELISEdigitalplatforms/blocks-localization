import {
  postIdentifierPeopleInvite,
  postIdentifierRemoveEnvironmentAccess,
  postIdentifierResendInvitation,
  postIdentifierTransferOwnership,
} from "@/features/console/services/identifier-people.service";
import { postIamResendActivation } from "@/features/console/services/iam-account.service";
import { updateTenantGroup } from "@/features/console/services/identifier-project.service";
import { env } from "@/config/env";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useInvitePeopleMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postIdentifierPeopleInvite,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["identifier", "people"] });
    },
  });
}

export function useRemoveEnvironmentAccessMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postIdentifierRemoveEnvironmentAccess,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["identifier", "people"] });
    },
  });
}

export function useResendInvitationMutation() {
  return useMutation({
    mutationFn: postIdentifierResendInvitation,
  });
}

export function useTransferOwnershipMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postIdentifierTransferOwnership,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["identifier", "people"] });
      void qc.invalidateQueries({ queryKey: ["identifier", "projects"] });
    },
  });
}

export function useResendActivationMutation() {
  return useMutation({
    mutationFn: postIamResendActivation,
  });
}

export function useUpdateTenantGroupMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: updateTenantGroup,
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["identifier", "projects", variables.tenantGroupId] });
    },
  });
}

/** `projectKey` for ResendActivation matches Next (`NEXT_PUBLIC_X_BLOCKS_KEY`). */
export function getBlocksProjectKeyForIam(): string {
  return env.xBlocksKey || "";
}
