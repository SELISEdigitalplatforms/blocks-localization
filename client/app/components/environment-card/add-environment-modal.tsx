import { useState } from "react";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Button } from "@/components/ui-kits/button/button";
import { environmentOptions } from "@/constants/environment-options";

interface AddEnvironmentModalProps {
  onClose?: (selectedEnvironments?: string[]) => void | Promise<void>;
  preSelectedEnvironments?: string[];
  tenantGroupId?: string;
  projectName?: string;
  onSave?: (selectedEnvironments: string[]) => void | Promise<void>;
  isLoading?: boolean;
}

export const AddEnvironmentModal = ({
  onClose,
  preSelectedEnvironments = [],
  tenantGroupId,
  projectName,
  onSave,
  isLoading = false,
}: AddEnvironmentModalProps) => {
  const [selected, setSelected] = useState<string[]>([]);

  const availableOptions = environmentOptions.filter(
    (option) => !preSelectedEnvironments.includes(option.value),
  );

  const rows = [];
  for (let i = 0; i < availableOptions.length; i += 2) {
    rows.push(availableOptions.slice(i, i + 2));
  }

  const onSaveClick = async () => {
    if (selected.length === 0) return;

    if (onSave) {
      // Use external onSave handler (for localization module)
      await onSave(selected);
    } else if (selected.length > 0 && onClose && tenantGroupId) {
      // Legacy internal handling (kept for backward compatibility)
      const sortedSelected = [...selected].sort((a, b) => {
        const aIndex = environmentOptions.find((opt) => opt.value === a)?.index ?? 0;
        const bIndex = environmentOptions.find((opt) => opt.value === b)?.index ?? 0;
        return aIndex - bIndex;
      });
      const domain = import.meta.env.VITE_BASE_DOMAIN || "seliseblocks.com";
      const shortGuid = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) =>
        "abcdefghijklmnopqrstuvwxyz"[b % 26],
      ).join("");
      const applicationContexts = sortedSelected.map((env: string) => ({
        environment: env,
        domain: `https://${env === "main" ? "" : env}-${shortGuid}.${domain}`,
        cookieDomain: domain,
      }));

      onClose(sortedSelected);
    }
  };

  const handleCancel = () => {
    onClose?.(selected);
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
                          } else {
                            return prev.filter((v) => v !== option.value);
                          }
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
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={handleCancel}
        >
          Cancel
        </Button>
        <Button
          type="button"
          disabled={isLoading || selected.length === 0}
          onClick={() => void onSaveClick()}
        >
          Add
        </Button>
      </div>
    </div>
  );
};
