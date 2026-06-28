import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-kits/popover/popover";
import { Badge } from "@/components/ui-kits/badge/badge";
import {
  useGetModuleGlossaries,
  useSearchGlossaries,
  useTagGlossary,
} from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { IGlossary, IModuleGets } from "@blocks-localization/models/language";
import { Check, ChevronsUpDown, X } from "lucide-react";

interface TagGlossaryModalProps {
  module: IModuleGets;
  onClose: (open: boolean) => void;
}

const TagGlossaryModal: React.FC<TagGlossaryModalProps> = ({
  module,
  onClose,
}) => {
  const [searchText, setSearchText] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedGlossaries, setSelectedGlossaries] = useState<IGlossary[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const { data: moduleGlossariesResponse } = useGetModuleGlossaries(
    module.itemId,
  );
  const { data: searchResults } = useSearchGlossaries(searchText, popoverOpen);
  const { isPending, mutateAsync } = useTagGlossary();

  useEffect(() => {
    const moduleGlossaries = moduleGlossariesResponse?.items ?? [];
    setSelectedIds(moduleGlossaries.map((glossary) => glossary.itemId));
    setSelectedGlossaries(moduleGlossaries);
  }, [moduleGlossariesResponse, module.itemId]);

  const handleSelect = useCallback(
    (glossary: IGlossary) => {
      const alreadySelected = selectedIds.includes(glossary.itemId);
      if (alreadySelected) {
        setSelectedIds((prev) => prev.filter((id) => id !== glossary.itemId));
        setSelectedGlossaries((prev) =>
          prev.filter((g) => g.itemId !== glossary.itemId),
        );
      } else {
        setSelectedIds((prev) => [...prev, glossary.itemId]);
        setSelectedGlossaries((prev) => [...prev, glossary]);
      }
    },
    [selectedIds],
  );

  const handleRemove = useCallback((glossaryId: string) => {
    setSelectedIds((prev) => prev.filter((id) => id !== glossaryId));
    setSelectedGlossaries((prev) =>
      prev.filter((g) => g.itemId !== glossaryId),
    );
  }, []);

  const handleSubmit = async () => {
    try {
      const res = await mutateAsync({
        moduleId: module.itemId,
        glossaryIds: selectedIds,
        projectKey: tenantId,
      });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Glossaries updated",
        });
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update glossaries",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  const availableGlossaries = searchResults?.items ?? [];

  return (
    <DialogContent className="rounded-lg sm:max-w-[520px]">
      <DialogHeader className="space-y-3">
        <DialogTitle className="text-left text-xl">Tag Glossary</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {selectedGlossaries.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedGlossaries.map((glossary) => (
              <Badge
                key={glossary.itemId}
                variant="secondary"
                className="gap-1 pr-1"
              >
                {glossary.name}
                <button
                  type="button"
                  onClick={() => handleRemove(glossary.itemId)}
                  disabled={isPending}
                  className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={popoverOpen}
              className="w-full justify-between font-normal"
              disabled={isPending}
            >
              Search glossary...
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-[470px] p-0"
            align="start"
            portalled={false}
          >
            <Command shouldFilter={false}>
              <CommandInput
                placeholder="Search glossary..."
                value={searchText}
                onValueChange={setSearchText}
              />
              <CommandList>
                <CommandEmpty>No glossary found.</CommandEmpty>
                <CommandGroup>
                  {availableGlossaries.map((glossary) => (
                    <CommandItem
                      key={glossary.itemId}
                      value={glossary.itemId}
                      onSelect={() => handleSelect(glossary)}
                    >
                      <div className="flex flex-1 items-center gap-2">
                        <span>{glossary.name}</span>
                        {glossary.type && (
                          <span className="text-xs text-muted-foreground">
                            ({glossary.type})
                          </span>
                        )}
                      </div>
                      {selectedIds.includes(glossary.itemId) && (
                        <Check className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => onClose(false)}
          size="default"
          className="flex-1 sm:flex-1"
        >
          Cancel
        </Button>
        <Button
          disabled={isPending}
          onClick={handleSubmit}
          size="default"
          className="flex-1 sm:flex-1"
        >
          {isPending ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default TagGlossaryModal;
