import React, { useRef, useState } from "react";
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
import {
  useDeleteGlossaryWithCascade,
  useGetGlossaryUsageCount,
} from "@blocks-localization/hooks/use-language-manager";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";

interface DeleteGlossaryProps {
  itemId: string;
  glossaryName: string;
  onClose: () => void;
}

const DeleteGlossary: React.FC<DeleteGlossaryProps> = ({ itemId, glossaryName, onClose }) => {
  const { t } = useT("localization.glossary");
  const {
    data: usageCount,
    isLoading: isCounting,
    isFetching: isRecounting,
    isError: isCountError,
    refetch: refetchUsageCount,
  } = useGetGlossaryUsageCount(itemId);
  const { isPending, mutateAsync } = useDeleteGlossaryWithCascade();
  const [progress, setProgress] = useState<{ removed: number; total: number } | null>(null);
  const runningRef = useRef(false);

  const hasKnownCount = !isCountError && typeof usageCount === "number";
  const isBusy = isPending;
  const canConfirm = hasKnownCount && !isCounting && !isRecounting && !isBusy;

  const deleteGlossary = async () => {
    if (runningRef.current || !hasKnownCount) {
      return;
    }
    runningRef.current = true;
    setProgress(null);
    try {
      const res = await mutateAsync({
        glossaryId: itemId,
        initialCount: usageCount,
        onProgress: (removed, total) => {
          if (total > 0) setProgress({ removed, total });
        },
      });

      if (res.status === "deleted") {
        toast({
          variant: "success",
          title: t("common:SUCCESS"),
          description: t("DELETE_GLOSSARY.DELETED"),
        });
        onClose();
      } else if (res.status === "keys-failed") {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description:
            res.reason === "iteration-limit"
              ? t("DELETE_GLOSSARY.KEYS_FAILED_LIMIT", {
                  removed: res.removedCount,
                  total: res.totalCount,
                })
              : t("DELETE_GLOSSARY.KEYS_FAILED", {
                  removed: res.removedCount,
                  total: res.totalCount,
                }),
        });
        void refetchUsageCount();
      } else {
        toast({
          variant: "destructive",
          title: t("common:ERROR"),
          description: formatErrorMessage(res.errors),
        });
        void refetchUsageCount();
      }
    } catch {
      toast({
        variant: "destructive",
        title: t("common:ERROR"),
        description: t("DELETE_GLOSSARY.DELETE_FAILED"),
      });
      void refetchUsageCount();
    } finally {
      runningRef.current = false;
      setProgress(null);
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
    if (progress) {
      return (
        <p className="text-sm text-medium-emphasis">
          {t("DELETE_GLOSSARY.REMOVING", { removed: progress.removed, total: progress.total })}
        </p>
      );
    }
    if (!hasKnownCount) {
      return null;
    }
    if (usageCount === 0) {
      return <p className="text-sm text-medium-emphasis">{t("DELETE_GLOSSARY.NOT_USED")}</p>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-medium-emphasis">
        <Badge variant="warning">{t("DELETE_GLOSSARY.USED_BY", { count: usageCount })}</Badge>
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
      <DialogFooter className="mt-4">
        <DialogTrigger asChild>
          <Button variant="secondary" disabled={isBusy}>
            {t("common:CANCEL")}
          </Button>
        </DialogTrigger>
        <Button variant="destructive" onClick={deleteGlossary} disabled={!canConfirm}>
          {isCounting ? t("DELETE_GLOSSARY.CHECKING_USAGE") : t("common:DELETE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteGlossary;
