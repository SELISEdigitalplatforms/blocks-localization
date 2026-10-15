import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Info } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getHttpErrorMessage } from "@/lib/error";
import { useMoveLanguageKeys } from "@blocks-localization/hooks/use-language-manager";
import type { IBlocksLanguageKey, IModuleGets } from "@blocks-localization/models/language";

interface MoveKeysDialogProps {
  keys: Pick<IBlocksLanguageKey, "itemId" | "moduleId">[];
  modules: Pick<IModuleGets, "itemId" | "moduleName">[];
  onCancel: () => void;
  onMoved: () => void;
}

const MOVE_FAILED_MESSAGE = "The selected keys could not be moved. Please try again.";

export function MoveKeysDialog({
  keys,
  modules,
  onCancel,
  onMoved,
}: Readonly<MoveKeysDialogProps>) {
  const [targetModuleId, setTargetModuleId] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const { isPending, mutateAsync } = useMoveLanguageKeys();

  const sourceModuleIds = useMemo(() => [...new Set(keys.map((key) => key.moduleId))], [keys]);
  const sourceModuleName =
    sourceModuleIds.length === 1
      ? modules.find((module) => module.itemId === sourceModuleIds[0])?.moduleName
      : undefined;

  // When every key comes from one module, moving them there would be a no-op, so hide it.
  const targetModules = useMemo(
    () =>
      sourceModuleIds.length === 1
        ? modules.filter((module) => module.itemId !== sourceModuleIds[0])
        : modules,
    [modules, sourceModuleIds],
  );
  const selectedTarget = targetModules.find((module) => module.itemId === targetModuleId);
  const keyLabel = keys.length === 1 ? "key" : "keys";

  const handleMove = async () => {
    if (!selectedTarget) return;

    try {
      const response = await mutateAsync({
        itemIds: keys.map((key) => key.itemId),
        targetModuleId: selectedTarget.itemId,
      });

      if (!response?.success) {
        toast({
          variant: "destructive",
          title: "Move failed",
          description: response?.errorMessage || MOVE_FAILED_MESSAGE,
        });
        return;
      }

      toast({
        variant: "success",
        title: "Keys moved",
        description: `${keys.length} ${keyLabel} moved to ${selectedTarget.moduleName}.`,
      });
      onMoved();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Move failed",
        description: getHttpErrorMessage(error),
      });
    }
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>
          Move {keys.length} {keyLabel} to another module
        </DialogTitle>
        <DialogDescription>
          {sourceModuleName ? (
            <>
              Currently in <span className="font-semibold">{sourceModuleName}</span>. Choose the
              module to move {keys.length === 1 ? "it" : "them"} to.
            </>
          ) : (
            <>Choose the module to move the selected {keyLabel} to.</>
          )}
        </DialogDescription>
      </DialogHeader>

      {targetModules.length === 0 ? (
        <p className="text-sm text-medium-emphasis">
          There is no other module to move these {keyLabel} to. Create a module first.
        </p>
      ) : (
        <div className="space-y-4">
          <Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                aria-label="Target module"
                aria-expanded={isPickerOpen}
                className="h-[37px] w-full justify-between font-normal shadow-none"
                disabled={isPending}
              >
                <span className="truncate">
                  {selectedTarget?.moduleName ?? "Select target module..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-(--radix-popover-trigger-width) p-0"
              portalled={false}
            >
              <Command>
                <CommandInput placeholder="Search module..." />
                <CommandList>
                  <CommandEmpty>No module found.</CommandEmpty>
                  <CommandGroup>
                    {targetModules.map((module) => (
                      <CommandItem
                        key={module.itemId}
                        value={module.moduleName}
                        onSelect={() => {
                          setTargetModuleId(module.itemId);
                          setIsPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            targetModuleId === module.itemId ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <span className="truncate">{module.moduleName}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="flex items-start gap-2 rounded-md bg-warning-100 px-3 py-2.5 text-sm text-high-emphasis">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-icon-warning" />
            <p>
              Translations and glossaries tagged on the {keyLabel} are kept. Glossaries tagged on
              the current module stop applying, and the target module&apos;s glossaries apply
              instead. Publish changes afterwards to update the language files.
            </p>
          </div>
        </div>
      )}

      <DialogFooter className="mt-2">
        <Button type="button" variant="secondary" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" disabled={!selectedTarget || isPending} onClick={handleMove}>
          {isPending ? "Moving..." : "Move"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
