import React, { useState } from "react";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  useGetAllModuleGlossaries,
  useTagGlossary,
} from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { IGlossary, IModuleGets } from "@blocks-localization/models/language";
import GlossaryPicker from "@blocks-localization/components/glossary/glossary-picker";

interface TagGlossaryModalProps {
  module: IModuleGets;
  onClose: (open: boolean) => void;
}

const getTagGlossaryErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (Array.isArray(error) && error.length > 0) return error.join(", ");
  if (error && typeof error === "object" && Object.keys(error).length > 0) {
    return formatErrorMessage(error);
  }
  return fallback;
};

const TagGlossaryModal: React.FC<TagGlossaryModalProps> = ({ module, onClose }) => {
  const { t } = useT("localization.glossary");
  // `Module/TagGlossary` untags every module glossary missing from the request, so the
  // selection starts from all of them and Save waits for the full seed (A8, C15).
  const {
    data: moduleGlossaries,
    isError: isSeedError,
    refetch: refetchSeed,
    isFetching: isSeedFetching,
    isFetchedAfterMount,
  } = useGetAllModuleGlossaries(module.itemId);
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [seed, setSeed] = useState<IGlossary[] | undefined>(undefined);
  // Seeded once, from a fetch made for this dialog: cached data from an earlier open may be
  // outdated, and a background refetch must not overwrite the user's changes.
  const isSeedReady = !!moduleGlossaries && isFetchedAfterMount && !isSeedFetching && !isSeedError;
  if (seed === undefined && isSeedReady) {
    setSeed(moduleGlossaries);
    setSelectedIds(moduleGlossaries.map((glossary) => glossary.itemId));
  }
  const isSeeded = selectedIds !== null;
  const { isPending, mutateAsync } = useTagGlossary();

  const handleSubmit = async () => {
    if (!isSeeded) return;
    try {
      const res = await mutateAsync({
        moduleId: module.itemId,
        glossaryIds: selectedIds,
      });
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("TAG_GLOSSARY_MODAL.UPDATED"),
        });
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: t("TAG_GLOSSARY_MODAL.UPDATE_FAILED"),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: getTagGlossaryErrorMessage(error, t("TAG_GLOSSARY_MODAL.UPDATE_FAILED_RETRY")),
      });
    }
  };

  const renderSeedState = () => {
    if (isSeeded) {
      return (
        <GlossaryPicker
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          allowCreate
          disabled={isPending}
          knownGlossaries={seed}
        />
      );
    }
    if (isSeedError && !isSeedFetching) {
      return (
        <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-error">
          {t("TAG_GLOSSARY_MODAL.LOAD_FAILED")}
          <Button type="button" variant="outline" size="sm" onClick={() => void refetchSeed()}>
            {t("common:RETRY")}
          </Button>
        </div>
      );
    }
    return (
      <div className="grid gap-3">
        <output className="block text-sm text-medium-emphasis">
          {t("TAG_GLOSSARY_MODAL.LOADING")}
        </output>
        <div className="flex gap-1.5" aria-hidden="true">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
        <Skeleton className="h-10 w-full" aria-hidden="true" />
      </div>
    );
  };

  const [descBefore, descAfter] = t("TAG_GLOSSARY_MODAL.DESCRIPTION", { name: "\u0000" }).split(
    "\u0000",
  );

  return (
    <DialogContent className="w-[calc(100vw-2rem)] rounded-lg sm:max-w-[520px]">
      <DialogHeader className="space-y-1.5">
        <DialogTitle className="text-left text-xl">{t("TAG_GLOSSARY_MODAL.TITLE")}</DialogTitle>
        <DialogDescription className="text-left text-sm text-medium-emphasis">
          {descBefore}
          <span className="font-medium text-high-emphasis">{module.moduleName}</span>
          {descAfter}
        </DialogDescription>
      </DialogHeader>

      <div className="min-w-0">{renderSeedState()}</div>

      <DialogFooter className="gap-2 sm:gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => onClose(false)}
          size="default"
          className="flex-1 sm:flex-1"
        >
          {t("common:CANCEL")}
        </Button>
        <Button
          disabled={isPending || !isSeeded}
          onClick={handleSubmit}
          size="default"
          className="flex-1 sm:flex-1"
        >
          {isPending ? t("TAG_GLOSSARY_MODAL.SAVING") : t("common:SAVE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default TagGlossaryModal;
