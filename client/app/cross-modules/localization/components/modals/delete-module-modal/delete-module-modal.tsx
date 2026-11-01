import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { useT } from "@seliseblocks/genesis-os/i18n";
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

type KeyAction = "move" | "delete";

// Replaces the marker in a translated sentence with the module name shown in bold.
const NAME_MARKER = "\u0001";
const withBoldName = (text: string, name: string) =>
  text.split(NAME_MARKER).flatMap((part, index) =>
    index === 0
      ? [part]
      : [
          <span key={`name-${index}`} className="font-semibold">
            {name}
          </span>,
          part,
        ],
  );

interface DeleteModuleModalProps {
  module: IModuleGets;
  modules: Pick<IModuleGets, "itemId" | "moduleName">[];
  onClose: (open: boolean) => void;
}

const DeleteModuleModal: React.FC<DeleteModuleModalProps> = ({ module, modules, onClose }) => {
  const { t } = useT("localization.modules");
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

  const hasKeys = (keyCount ?? 0) > 0;
  const keyCountLabel = t("DELETE_MODULE_MODAL.KEY_COUNT", { count: keyCount ?? 0 });
  const targetModules = modules.filter((m) => m.itemId !== module.itemId);
  const selectedTarget = targetModules.find((m) => m.itemId === targetModuleId);
  const canMove = targetModules.length > 0;
  const [chosenKeyAction, setChosenKeyAction] = useState<KeyAction>("move");
  const keyAction: KeyAction = canMove ? chosenKeyAction : "delete";

  const handleViewKeys = () => {
    onClose(false);
    navigate(scoped(`services/language?moduleIds=${encodeURIComponent(module.itemId)}`));
  };

  const getSuccessMessage = (
    target?: Pick<IModuleGets, "itemId" | "moduleName">,
    deleteKeys?: boolean,
  ) => {
    if (target) {
      return t("DELETE_MODULE_MODAL.DELETED_KEYS_MOVED", { name: target.moduleName });
    }
    if (deleteKeys) return t("DELETE_MODULE_MODAL.DELETED_WITH_KEYS");
    return t("DELETE_MODULE_MODAL.DELETED");
  };

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
          title: t("common:SUCCESS"),
          description: getSuccessMessage(target, deleteKeys),
        });
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: t("DELETE_MODULE_MODAL.DELETE_FAILED"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: getHttpErrorMessage(error),
      });
      void refetchKeyCount();
    }
  };

  const renderDescription = () => {
    if (isKeyCountLoading) {
      return (
        <>
          {withBoldName(
            t("DELETE_MODULE_MODAL.CHECKING_KEYS", { name: NAME_MARKER }),
            module.moduleName,
          )}
        </>
      );
    }

    if (hasKeys) {
      return (
        <>
          {withBoldName(
            t("DELETE_MODULE_MODAL.HAS_KEYS", { name: NAME_MARKER, count: keyCount ?? 0 }),
            module.moduleName,
          )}
        </>
      );
    }

    return (
      <>
        {withBoldName(
          t("DELETE_MODULE_MODAL.CONFIRM_DELETE", { name: NAME_MARKER }),
          module.moduleName,
        )}
      </>
    );
  };

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

  const renderKeysHeader = (label?: string) => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        {label && <p className="text-sm font-medium text-high-emphasis">{label}</p>}
        <Badge variant="warning" className="shrink-0 rounded-full font-normal">
          {keyCountLabel}
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
        {t("DELETE_MODULE_MODAL.VIEW_KEYS")}
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
          aria-label={t("DELETE_MODULE_MODAL.TARGET_MODULE")}
          aria-expanded={isTargetPickerOpen}
          className="h-[37px] w-full justify-between font-normal shadow-none"
          disabled={isPending}
        >
          <span className="truncate">
            {selectedTarget?.moduleName ?? t("DELETE_MODULE_MODAL.SELECT_TARGET")}
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
          <CommandInput placeholder={t("DELETE_MODULE_MODAL.SEARCH_MODULE")} />
          <CommandList>
            <CommandEmpty>{t("DELETE_MODULE_MODAL.NO_MODULE_FOUND")}</CommandEmpty>
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
      {renderKeysHeader(t("DELETE_MODULE_MODAL.KEY_ACTION_QUESTION"))}
      <RadioGroup
        value={keyAction}
        onValueChange={(value) => setChosenKeyAction(value as KeyAction)}
        aria-label={t("DELETE_MODULE_MODAL.KEY_ACTION_QUESTION")}
        className="gap-3"
        disabled={isPending}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="move" id="delete-module-move-keys" disabled={!canMove} />
            <Label htmlFor="delete-module-move-keys" className={cn(!canMove && "opacity-50")}>
              {t("DELETE_MODULE_MODAL.MOVE_ALL_KEYS")}
            </Label>
          </div>
          {!canMove && (
            <p className="flex items-center gap-1.5 pl-6 text-xs text-primary">
              <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t("DELETE_MODULE_MODAL.NO_OTHER_MODULE")}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="delete" id="delete-module-delete-keys" />
          <Label htmlFor="delete-module-delete-keys">
            {t("DELETE_MODULE_MODAL.DELETE_ALL_KEYS")}
          </Label>
        </div>
      </RadioGroup>

      {keyAction === "move" ? (
        <>
          {renderTargetPicker()}
          <div className="flex items-start gap-2 rounded-md bg-warning-100 px-3 py-2.5 text-sm text-high-emphasis">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-icon-warning" />
            <p>{t("DELETE_MODULE_MODAL.MOVE_WARNING")}</p>
          </div>
        </>
      ) : (
        <div className="flex items-start gap-2 rounded-md bg-warning-100 px-3 py-2.5 text-sm text-high-emphasis">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-icon-warning" />
          <p>{t("DELETE_MODULE_MODAL.DELETE_WARNING", { count: keyCount ?? 0 })}</p>
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
        {isPending
          ? t("DELETE_MODULE_MODAL.MOVING_DELETING")
          : t("DELETE_MODULE_MODAL.MOVE_AND_DELETE")}
      </Button>
    ) : (
      <Button
        type="button"
        variant="destructive"
        disabled={isPending}
        onClick={() => handleSubmit(undefined, true)}
      >
        {isPending
          ? t("DELETE_MODULE_MODAL.DELETING")
          : t("DELETE_MODULE_MODAL.DELETE_MODULE_AND_KEYS")}
      </Button>
    );

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("DELETE_MODULE_MODAL.TITLE")}</DialogTitle>
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
          {t("common:CANCEL")}
        </Button>
        {hasKeys ? (
          renderKeyActionButton()
        ) : (
          <Button
            variant="destructive"
            disabled={isPending || isKeyCountLoading}
            onClick={() => handleSubmit()}
          >
            {isPending ? t("DELETE_MODULE_MODAL.DELETING") : t("common:DELETE")}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteModuleModal;
