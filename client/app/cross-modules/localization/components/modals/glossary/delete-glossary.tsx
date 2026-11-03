import React, { useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  useDeleteGlossaryWithCascade,
  useFetchLatestGlossary,
  useGetGlossaryUsage,
  useSaveGlossary,
} from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import {
  getGlossaryStatus,
  isUnsupportedGlossaryNote,
  toGlossarySavePayload,
} from "@blocks-localization/utils/glossary-display";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage, getHttpErrorMessage } from "@/lib/error";

/** From this many keys, Delete needs the term's exact name typed (Phase 8 A3). */
export const DELETE_CONFIRM_THRESHOLD = 50;

/** `validationErrors` property the server uses when the term changed since it was loaded. */
const VERSION_ERROR_PROPERTY = "Version";

const COMMON_ERROR = "common:ERROR";

const normalizeName = (value: string) => value.trim().normalize("NFC");

interface DeleteGlossaryProps {
  itemId: string;
  glossaryName: string;
  /** The stored term; enables "Deprecate instead" (its full payload is re-saved). */
  glossary?: IGlossary;
  onClose: () => void;
}

const DeleteGlossary: React.FC<DeleteGlossaryProps> = ({
  itemId,
  glossaryName,
  glossary,
  onClose,
}) => {
  const { t } = useT("localization.glossary");
  const {
    data: usage,
    isLoading: isCounting,
    isFetching: isRecounting,
    isError: isCountError,
    refetch: refetchUsageCount,
  } = useGetGlossaryUsage(itemId);
  const { isPending, mutateAsync } = useDeleteGlossaryWithCascade();
  const { isPending: isDeprecating, mutateAsync: saveGlossary } = useSaveGlossary();
  const fetchLatestGlossary = useFetchLatestGlossary();
  const runningRef = useRef(false);
  const [confirmText, setConfirmText] = useState("");
  // Set after a version conflict, so the next "Deprecate instead" saves on top of it.
  const [latestGlossary, setLatestGlossary] = useState<IGlossary | undefined>(undefined);
  const currentGlossary = latestGlossary ?? glossary;

  // What a delete affects: every key in a global glossary's scope, not only the tagged ones.
  const usageCount = usage?.affectedKeyCount ?? usage?.keyCount;
  // Modules of the tagged keys plus the modules the glossary is scoped to.
  const moduleCount = new Set([...(usage?.moduleIds ?? []), ...(currentGlossary?.moduleIds ?? [])])
    .size;
  const hasKnownCount = !isCountError && typeof usageCount === "number";
  const isBusy = isPending || isDeprecating;
  const needsTyping = hasKnownCount && usageCount >= DELETE_CONFIRM_THRESHOLD;
  const isTypedNameValid =
    !needsTyping || normalizeName(confirmText) === normalizeName(glossaryName ?? "");
  const canConfirm = hasKnownCount && !isCounting && !isRecounting && !isBusy && isTypedNameValid;
  const canDeprecate =
    !!currentGlossary &&
    hasKnownCount &&
    usageCount > 0 &&
    !isUnsupportedGlossaryNote(currentGlossary) &&
    getGlossaryStatus(currentGlossary) !== "deprecated";

  const deleteGlossary = async () => {
    if (runningRef.current || !hasKnownCount || !isTypedNameValid) {
      return;
    }
    runningRef.current = true;
    try {
      // The server removes the glossary from its keys before deleting it.
      const res = await mutateAsync({ glossaryId: itemId });

      if (res.status === "deleted") {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("DELETE_GLOSSARY.DELETED"),
        });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: t(COMMON_ERROR),
          description: formatErrorMessage(res.errors),
        });
        void refetchUsageCount();
      }
    } catch (error) {
      // Glossary/Delete answers a failure with 400/404, which the HTTP client throws: show its reason.
      toast({
        variant: "destructive",
        title: t(COMMON_ERROR),
        description: getHttpErrorMessage(error),
      });
      void refetchUsageCount();
    } finally {
      runningRef.current = false;
    }
  };

  // Keeps the term and every key's tags; only its status changes (H24).
  const deprecateInstead = async () => {
    if (!currentGlossary || runningRef.current) return;
    runningRef.current = true;
    try {
      const res = await saveGlossary({
        ...toGlossarySavePayload(currentGlossary),
        status: "deprecated",
      });
      if (res?.success) {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("DELETE_GLOSSARY.DEPRECATED"),
        });
        onClose();
      } else if (res?.validationErrors?.some((e) => e.propertyName === VERSION_ERROR_PROPERTY)) {
        setLatestGlossary(await fetchLatestGlossary(itemId));
        toast({
          variant: "destructive",
          title: t(COMMON_ERROR),
          description: t("DELETE_GLOSSARY.VERSION_CONFLICT"),
        });
      } else {
        showErrorToast({
          errors: res?.validationErrors?.[0]?.errorMessage || res?.errorMessage,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t(COMMON_ERROR),
        description: formatErrorMessage(error),
      });
    } finally {
      runningRef.current = false;
    }
  };

  const renderUsage = () => {
    if (isCounting) {
      return <p className="text-sm text-medium-emphasis">{t("DELETE_GLOSSARY.CHECKING_USAGE")}</p>;
    }
    if (isCountError) {
      return (
        <div className="flex items-center gap-2">
          <p className="text-sm text-error">{t("DELETE_GLOSSARY.CHECK_FAILED")}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetchUsageCount()}
            disabled={isRecounting}
          >
            {t("common:RETRY")}
          </Button>
        </div>
      );
    }
    if (isPending) {
      return <p className="text-sm text-medium-emphasis">{t("DELETE_GLOSSARY.DELETING")}</p>;
    }
    if (!hasKnownCount) {
      return null;
    }
    if (usageCount === 0) {
      return <p className="text-sm text-medium-emphasis">{t("DELETE_GLOSSARY.NOT_USED")}</p>;
    }
    const keys = t("DELETE_GLOSSARY.KEY_COUNT", { count: usageCount });
    let usedBy: string;
    if (usage?.isGlobal) {
      usedBy = t("DELETE_GLOSSARY.APPLIES_TO_ALL_KEYS", { keys });
    } else if (moduleCount > 0) {
      usedBy = t("DELETE_GLOSSARY.USED_BY_KEYS_IN_MODULES", {
        keys,
        modules: t("DELETE_GLOSSARY.MODULE_COUNT", { count: moduleCount }),
      });
    } else {
      usedBy = t("DELETE_GLOSSARY.USED_BY_KEYS", { keys });
    }
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-medium-emphasis">
        <Badge variant="warning">{usedBy}</Badge>
        <span>{t("DELETE_GLOSSARY.REMOVES_FROM_KEYS")}</span>
      </div>
    );
  };

  return (
    <DialogContent
      onEscapeKeyDown={(event) => isBusy && event.preventDefault()}
      onInteractOutside={(event) => isBusy && event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>{t("DELETE_GLOSSARY.TITLE")}</DialogTitle>
        <DialogDescription>
          {t("DELETE_GLOSSARY.CONFIRM", { name: glossaryName })}
        </DialogDescription>
      </DialogHeader>
      {renderUsage()}
      {needsTyping && (
        <div className="grid gap-2">
          <Label htmlFor="delete-glossary-confirm">
            {t("DELETE_GLOSSARY.TYPE_TO_CONFIRM", { name: glossaryName })}
          </Label>
          <Input
            id="delete-glossary-confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
            disabled={isBusy}
          />
        </div>
      )}
      <DialogFooter className="mt-4 gap-2">
        <DialogTrigger asChild>
          <Button variant="secondary" disabled={isBusy}>
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        {canDeprecate && (
          <Button variant="outline" onClick={() => void deprecateInstead()} disabled={isBusy}>
            {isDeprecating && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {t("DELETE_GLOSSARY.DEPRECATE_INSTEAD")}
          </Button>
        )}
        <Button variant="destructive" onClick={deleteGlossary} disabled={!canConfirm}>
          {isCounting ? t("DELETE_GLOSSARY.CHECKING_USAGE") : t("common:DELETE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteGlossary;
