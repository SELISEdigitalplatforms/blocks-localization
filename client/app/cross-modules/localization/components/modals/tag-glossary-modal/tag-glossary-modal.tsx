import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-kits/dialog/dialog";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Label } from "@/components/ui-kits/label/label";
import { Input } from "@/components/ui-kits/input/input";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useGetGlossaries, useTagGlossary } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@/store/useProjectStore";
import { IModuleGets } from "@blocks-localization/models/language";

interface TagGlossaryModalProps {
  module: IModuleGets;
  onClose: (open: boolean) => void;
}

const TagGlossaryModal: React.FC<TagGlossaryModalProps> = ({ module, onClose }) => {
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const { data: glossariesResponse, isLoading } = useGetGlossaries(0, 100, searchText || undefined);
  const { isPending, mutateAsync } = useTagGlossary();

  useEffect(() => {
    if (glossariesResponse?.items) {
      const preSelected = glossariesResponse.items
        .filter((g) => g.moduleIds?.includes(module.itemId))
        .map((g) => g.itemId);
      setSelectedIds(preSelected);
    }
  }, [glossariesResponse, module.itemId]);

  const toggleGlossary = (itemId: string) => {
    setSelectedIds((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId],
    );
  };

  const availableGlossaryIds = (glossariesResponse?.items ?? []).map((g) => g.itemId);
  const hasUnavailableSelectedGlossaries = selectedIds.some((id) => !availableGlossaryIds.includes(id));
  const isSaveDisabled = isPending || hasUnavailableSelectedGlossaries;

  const handleSubmit = async () => {
    try {
      const res = await mutateAsync({
        moduleId: module.itemId,
        glossaryIds: selectedIds,
        projectKey: tenantId,
      });
      if (res?.isSuccess) {
        toast({ variant: "success", title: "Success", description: "Glossaries updated" });
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update glossaries",
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: JSON.stringify(error) });
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Tag glossaries</DialogTitle>
        <DialogDescription>
          Select glossaries to associate with{" "}
          <span className="font-semibold">{module.moduleName}</span>.
        </DialogDescription>
      </DialogHeader>

      <Input
        placeholder="Search glossaries..."
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        className="shadow-none"
      />

      <div className="mt-2 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="space-y-2">
            {(glossariesResponse?.items ?? []).map((glossary) => (
              <div key={glossary.itemId} className="flex items-center gap-3 py-1">
                <Checkbox
                  id={`glossary-${glossary.itemId}`}
                  checked={selectedIds.includes(glossary.itemId)}
                  onCheckedChange={() => toggleGlossary(glossary.itemId)}
                />
                <Label
                  htmlFor={`glossary-${glossary.itemId}`}
                  className="cursor-pointer font-normal"
                >
                  {glossary.name}
                </Label>
              </div>
            ))}
            {!isLoading && (glossariesResponse?.items ?? []).length === 0 && (
              <p className="py-4 text-center text-sm text-low-emphasis">No glossaries found</p>
            )}
          </div>
        )}
      </div>

      {hasUnavailableSelectedGlossaries && (
        <p className="mt-2 text-sm text-destructive">
          Some selected glossaries are no longer available. Please remove them to save.
        </p>
      )}

      <DialogFooter className="mt-4">
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => onClose(false)}
        >
          Cancel
        </Button>
        <Button disabled={isSaveDisabled} onClick={handleSubmit}>
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default TagGlossaryModal;
