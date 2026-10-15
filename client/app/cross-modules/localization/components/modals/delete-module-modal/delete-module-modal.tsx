import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { AlertTriangle, Check, ChevronsUpDown, Eye, Info } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-kits/dialog/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Label } from "@/components/ui-kits/label/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import {
  useDeleteLanguageModule,
  useGetModuleKeyCount,
} from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { getHttpErrorMessage } from "@/lib/error";
import { IModuleGets } from "@blocks-localization/models/language";

// What happens to the keys of a module that still has keys.
type KeyAction = "move" | "delete";

interface DeleteModuleModalProps {
  module: IModuleGets;
  modules: Pick<IModuleGets, "itemId" | "moduleName">[];
  onClose: (open: boolean) => void;
}

const DeleteModuleModal: React.FC<DeleteModuleModalProps> = ({ module, modules, onClose }) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const [targetModuleId, setTargetModuleId] = useState("");
  const [isTargetPickerOpen, setIsTargetPickerOpen] = useState(false);
  const { isPending, mutateAsync } = useDeleteLanguageModule();
  const {
    data: keyCount,
    isLoading: isKeyCountLoading,
    refetch: refetchKeyCount,
  } = useGetModuleKeyCount(module.itemId);

  // The server enforces the rule too; if the count could not be loaded, let it decide.
  const hasKeys = (keyCount ?? 0) > 0;
  const keyLabel = keyCount === 1 ? "key" : "keys";
  const targetModules = modules.filter((m) => m.itemId !== module.itemId);
  const selectedTarget = targetModules.find((m) => m.itemId === targetModuleId);
  // Moving is optional; with no other module to move to, deleting the keys is the only way forward.
  const canMove = targetModules.length > 0;
  const [chosenKeyAction, setChosenKeyAction] = useState<KeyAction>("move");
  const keyAction: KeyAction = canMove ? chosenKeyAction : "delete";

  // The translations table filtered to this module, where its keys can be deleted.
  const handleViewKeys = () => {
    onClose(false);
    navigate(scoped(`services/language?moduleIds=${encodeURIComponent(module.itemId)}`));
  };

  const getSuccessMessage = (
    target?: Pick<IModuleGets, "itemId" | "moduleName">,
    deleteKeys?: boolean,
  ) => {
    if (target) return `Module deleted. Its keys were moved to ${target.moduleName}.`;
    if (deleteKeys) return "Module and its keys deleted";
    return "Module deleted";
  };

  // Without a target or deleteKeys the module must already be empty; otherwise the server moves
  // or deletes its keys first.
  const handleSubmit = async (
    target?: Pick<IModuleGets, "itemId" | "moduleName">,
    deleteKeys?: boolean,
  ) => {
    try {
      const res = await mutateAsync({
        itemId: module.itemId,
        ...(target && { targetModuleId: target.itemId }),
        ...(deleteKeys && { deleteKeys: true }),
      });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: getSuccessMessage(target, deleteKeys),
        });
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete module",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: getHttpErrorMessage(error),
      });
      // Keys may have been added since the dialog opened; refresh so it can show the blocked state.
      void refetchKeyCount();
    }
  };

  const renderDescription = () => {
    if (isKeyCountLoading) {
      return (
        <>
          Checking keys in <span className="font-semibold">{module.moduleName}</span>...
        </>
      );
    }

    if (hasKeys) {
      return (
        <>
          <span className="font-semibold">{module.moduleName}</span> has {keyCount} {keyLabel}. Move
          them to another module or delete them together with the module.
        </>
      );
    }

    return (
      <>
        Are you sure you want to delete <span className="font-semibold">{module.moduleName}</span>?
        This action cannot be undone.
      </>
    );
  };

  // Mirrors the layout of the move-keys section so the dialog does not jump once the count arrives.
  const renderKeyCountLoading = () => (
    <div className="space-y-3" aria-busy="true" data-testid="module-key-count-loading">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <Skeleton className="h-[37px] w-full" />
    </div>
  );

  // Count badge next to the section label, with the shortcut to the module's keys on the right.
  const renderKeysHeader = (label?: string) => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        {label && <p className="text-sm font-medium text-high-emphasis">{label}</p>}
        <Badge variant="warning" className="shrink-0 rounded-full font-normal">
          {keyCount} {keyLabel}
        </Badge>
      </div>
      <Button
        type="button"
        variant="link"
        className="h-auto shrink-0 gap-1.5 p-0 text-primary"
        disabled={isPending}
        onClick={handleViewKeys}
      >
        <Eye className="h-4 w-4" />
        View keys
      </Button>
    </div>
  );

  const renderTargetPicker = () => (
    <Popover open={isTargetPickerOpen} onOpenChange={setIsTargetPickerOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Target module"
          aria-expanded={isTargetPickerOpen}
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
              {targetModules.map((m) => (
                <CommandItem
                  key={m.itemId}
                  value={m.moduleName}
                  onSelect={() => {
                    setTargetModuleId(m.itemId);
                    setIsTargetPickerOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      targetModuleId === m.itemId ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{m.moduleName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );

  const renderKeyActions = () => (
    <div className="space-y-3">
      {renderKeysHeader("What should happen to the keys?")}
      <RadioGroup
        value={keyAction}
        onValueChange={(value) => setChosenKeyAction(value as KeyAction)}
        aria-label="What should happen to the keys?"
        className="gap-3"
        disabled={isPending}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="move" id="delete-module-move-keys" disabled={!canMove} />
            <Label htmlFor="delete-module-move-keys" className={cn(!canMove && "opacity-50")}>
              Move all keys to another module
            </Label>
          </div>
          {!canMove && (
            <p className="pl-6 text-xs text-medium-emphasis">
              There is no other module to move the keys to.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="delete" id="delete-module-delete-keys" />
          <Label htmlFor="delete-module-delete-keys">Delete all keys with the module</Label>
        </div>
      </RadioGroup>

      {keyAction === "move" ? (
        <>
          {renderTargetPicker()}
          <div className="flex items-start gap-2 rounded-md bg-warning-100 px-3 py-2.5 text-sm text-high-emphasis">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-icon-warning" />
            <p>
              The module is deleted once its keys are moved, and this cannot be undone. Translations
              and glossaries tagged on the keys are kept; the target module&apos;s glossaries apply
              instead of this module&apos;s. Publish changes afterwards to update the language
              files.
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-high-emphasis">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p>
            {keyCount} {keyLabel} and all of their translations are permanently deleted with the
            module, and this cannot be undone. Publish changes afterwards to update the language
            files.
          </p>
        </div>
      )}
    </div>
  );

  const renderKeyActionButton = () =>
    keyAction === "move" ? (
      <Button
        type="button"
        variant="destructive"
        disabled={!selectedTarget || isPending}
        onClick={() => handleSubmit(selectedTarget)}
      >
        {isPending ? "Moving & deleting..." : "Move keys & delete module"}
      </Button>
    ) : (
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        onClick={() => handleSubmit(undefined, true)}
      >
        {isPending ? "Deleting..." : "Delete module & keys"}
      </Button>
    );

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete module</DialogTitle>
        <DialogDescription>{renderDescription()}</DialogDescription>
      </DialogHeader>

      {isKeyCountLoading ? renderKeyCountLoading() : hasKeys && renderKeyActions()}

      <DialogFooter className="mt-6">
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => onClose(false)}
        >
          Cancel
        </Button>
        {hasKeys ? (
          renderKeyActionButton()
        ) : (
          <Button
            variant="destructive"
            disabled={isPending || isKeyCountLoading}
            onClick={() => handleSubmit()}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteModuleModal;
