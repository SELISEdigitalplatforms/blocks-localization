// TODO: Enable delete module feature — uncomment this component and its usage in module-table.tsx
// when the delete module backend (Phase A of plan-modulesTab) is ready.

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-kits/dialog/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui-kits/radio-group/radio-group";
import { Label } from "@/components/ui-kits/label/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeleteLanguageModule } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { IModuleGets } from "@blocks-localization/models/language";

interface DeleteModuleModalProps {
  module: IModuleGets;
  allModules: IModuleGets[];
  onClose: (open: boolean) => void;
}

const DeleteModuleModal: React.FC<DeleteModuleModalProps> = ({ module, allModules, onClose }) => {
  const [deleteMode, setDeleteMode] = useState<"cascade" | "move">("cascade");
  const [targetModuleId, setTargetModuleId] = useState<string>("");
  const [comboOpen, setComboOpen] = useState(false);
  const inputRef = useRef(null);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { isPending, mutateAsync } = useDeleteLanguageModule();

  const availableModules = allModules.filter((m) => m.itemId !== module.itemId);

  const canSubmit =
    !isPending && (deleteMode === "cascade" || (deleteMode === "move" && !!targetModuleId));

  const handleSubmit = async () => {
    try {
      const payload = {
        itemId: module.itemId,
        ...(deleteMode === "move" && { targetModuleId }),
      };
      const res = await mutateAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Module deleted",
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
        description: JSON.stringify(error),
      });
    }
  };

  const selectedTarget = availableModules.find((m) => m.itemId === targetModuleId);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete module</DialogTitle>
        <DialogDescription>
          Choose what to do with the keys in{" "}
          <span className="font-semibold">{module.moduleName}</span>.
        </DialogDescription>
      </DialogHeader>

      <RadioGroup
        value={deleteMode}
        onValueChange={(v) => {
          setDeleteMode(v as "cascade" | "move");
          setTargetModuleId("");
        }}
        className="mt-2 gap-4"
      >
        <div className="flex items-center gap-3">
          <RadioGroupItem value="cascade" id="cascade" />
          <Label htmlFor="cascade" className="cursor-pointer">
            Delete keys along with the module
          </Label>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <RadioGroupItem value="move" id="move" />
            <Label htmlFor="move" className="cursor-pointer">
              Move keys to another module
            </Label>
          </div>
          {deleteMode === "move" && (
            <div className="ml-7">
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="h-[37px] w-full justify-between text-low-emphasis shadow-none"
                  >
                    {selectedTarget?.moduleName ?? "Select target module..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0">
                  <Command>
                    <CommandInput placeholder="Search module..." ref={inputRef} />
                    <CommandList>
                      <CommandEmpty>No module found.</CommandEmpty>
                      <CommandGroup>
                        {availableModules.map((m) => (
                          <CommandItem
                            key={m.itemId}
                            value={m.moduleName}
                            onSelect={() => {
                              setTargetModuleId(m.itemId === targetModuleId ? "" : m.itemId);
                              setComboOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                targetModuleId === m.itemId ? "opacity-100" : "opacity-0",
                              )}
                            />
                            {m.moduleName}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      </RadioGroup>

      <DialogFooter className="mt-6">
        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => onClose(false)}
        >
          Cancel
        </Button>
        <Button variant="destructive" disabled={!canSubmit} onClick={handleSubmit}>
          {isPending ? "Deleting..." : "Delete"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteModuleModal;
