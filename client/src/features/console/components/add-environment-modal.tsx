import { env } from "@/config/env";
import { environmentOptions } from "@/features/console/constants/environment-options";
import {
  createIdentifierProject,
  getDefaultCookieDomain,
} from "@/features/console/services/identifier-project.service";
import { shortGuidGenerator } from "@/features/create-project/state/create-project-form-store";
import { HttpError } from "@/platform/api/idp-http";
import { Button } from "@/platform/ui/components/button/button";
import { Checkbox } from "@/platform/ui/components/checkbox/checkbox";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

type EnvironmentOption = (typeof environmentOptions)[number];

export type AddEnvironmentModalProps = {
  /** When false, selection is cleared on next open (parent dialog visibility). */
  open?: boolean;
  onClose?: (selectedEnvironments: string[]) => void | Promise<void>;
  preSelectedEnvironments?: string[];
  tenantGroupId?: string;
  projectName?: string;
};

/**
 * Parity: `identifier/components/project-group-overview/add-environment/add-environment-modal.tsx`.
 * Adds new environment slots to an existing tenant group via `Project/Create` with `tenantGroupId`.
 */
export function AddEnvironmentModal({
  open = true,
  onClose,
  preSelectedEnvironments = [],
  tenantGroupId,
  projectName,
}: AddEnvironmentModalProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  const { isPending, mutateAsync } = useMutation({
    mutationFn: createIdentifierProject,
  });

  const availableOptions = (environmentOptions as readonly EnvironmentOption[]).filter(
    (option) => !preSelectedEnvironments.includes(option.value),
  );

  const rows: EnvironmentOption[][] = [];
  for (let i = 0; i < availableOptions.length; i += 2) {
    rows.push(availableOptions.slice(i, i + 2));
  }

  const onSaveClick = async () => {
    if (selected.length === 0 || !onClose || !tenantGroupId) return;

    const sortedSelected = [...selected].sort((a, b) => {
      const aIndex = environmentOptions.find((opt) => opt.value === a)?.index ?? 0;
      const bIndex = environmentOptions.find((opt) => opt.value === b)?.index ?? 0;
      return aIndex - bIndex;
    });

    const shortGuid = shortGuidGenerator(5);
    const cookieDomain = getDefaultCookieDomain();
    const baseHost = env.baseDomain;

    const applicationContexts = sortedSelected.map((envKey: string) => ({
      environment: envKey,
      domain: `https://${envKey === "main" ? "" : `${envKey}-`}${shortGuid}.${baseHost}`,
      cookieDomain,
    }));

    try {
      const response = await mutateAsync({
        name: projectName || "Project",
        isAcceptBlocksTerms: true,
        isUseBlocksExclusively: true,
        isProduction: false,
        resources: [],
        tenantGroupId,
        applicationContexts,
      });

      if (response?.isSuccess) {
        if (tenantGroupId) {
          void queryClient.invalidateQueries({ queryKey: ["identifier", "projects", tenantGroupId] });
        }
        showSuccessToast({ description: "Environment(s) added." });
        await onClose(sortedSelected);
        setSelected([]);
      } else {
        showErrorToast({ errors: response.errors });
      }
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: error instanceof Error ? error.message : "Failed to add environment" });
    }
  };

  return (
    <div>
      <div className="grid">
        {rows.map((row, rowIdx) => (
          <div className="grid grid-cols-2 gap-4" key={rowIdx}>
            {row.map((option) => {
              const isChecked = selected.includes(option.value);
              return (
                <div key={option.value} className="flex flex-col rounded p-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      className="h-5 w-5"
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        setSelected((prev) => {
                          if (checked) {
                            return [...prev, option.value];
                          }
                          return prev.filter((v) => v !== option.value);
                        });
                      }}
                    />
                    <span className="text-sm">{option.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={() => onClose?.([])}>
          Cancel
        </Button>
        <Button type="button" disabled={isPending || selected.length === 0} onClick={() => void onSaveClick()}>
          Add
        </Button>
      </div>
    </div>
  );
}
