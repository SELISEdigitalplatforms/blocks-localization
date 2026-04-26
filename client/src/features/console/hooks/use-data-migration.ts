import {
  postInitiateMigration,
  postVerifyMigration,
  type MigrationRequestPayload,
  type VerifyMigrationPayload,
} from "@/features/console/services/identifier-project.service";
import { useMutation } from "@tanstack/react-query";

export function useInitiateMigration() {
  return useMutation({
    mutationKey: ["identifier", "migration", "initiate"],
    mutationFn: (payload: MigrationRequestPayload) => postInitiateMigration(payload),
  });
}

export function useVerifyMigration() {
  return useMutation({
    mutationKey: ["identifier", "migration", "verify"],
    mutationFn: (payload: VerifyMigrationPayload) => postVerifyMigration(payload),
  });
}
