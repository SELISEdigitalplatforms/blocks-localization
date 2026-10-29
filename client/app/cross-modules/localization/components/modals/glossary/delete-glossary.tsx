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
  useGetGlossaryUsage,
  useSaveGlossary,
} from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import { getGlossaryStatus, toGlossarySavePayload } from "@blocks-localization/utils/glossary-display";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";

/** From this many keys, Delete needs the term's exact name typed (Phase 8 A3). */
export const DELETE_CONFIRM_THRESHOLD = 50;

interface DeleteGlossaryProps {
  itemId: string;
  glossaryName: string;
  /** The stored term; enables "Deprecate instead" (its full payload is re-saved). */
  glossary?: IGlossary;
  onClose: () => void;
}

const pluralizeKeys = (count: number) => `${count} key${count === 1 ? "" : "s"}`;
const pluralizeModules = (count: number) => `${count} module${count === 1 ? "" : "s"}`;

const DeleteGlossary: React.FC<DeleteGlossaryProps> = ({
  itemId,
  glossaryName,
  glossary,
  onClose,
}) => {
  const {
    data: usage,
    isLoading: isCounting,
    isFetching: isRecounting,
    isError: isCountError,
    refetch: refetchUsageCount,
  } = useGetGlossaryUsage(itemId);
  const { isPending, mutateAsync } = useDeleteGlossaryWithCascade();
  const { isPending: isDeprecating, mutateAsync: saveGlossary } = useSaveGlossary();
  const runningRef = useRef(false);
  const [confirmText, setConfirmText] = useState("");

  const usageCount = usage?.keyCount;
  const moduleCount = usage?.moduleIds?.length ?? 0;
  const hasKnownCount = !isCountError && typeof usageCount === "number";
  const isBusy = isPending || isDeprecating;
  const needsTyping = hasKnownCount && usageCount >= DELETE_CONFIRM_THRESHOLD;
  const isTypedNameValid = !needsTyping || confirmText.trim() === glossaryName;
  const canConfirm = hasKnownCount && !isCounting && !isRecounting && !isBusy && isTypedNameValid;
  const canDeprecate =
    !!glossary &&
    hasKnownCount &&
    usageCount > 0 &&
    getGlossaryStatus(glossary) !== "deprecated";

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
          title: "Success",
          description: "Glossary item deleted successfully.",
        });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatErrorMessage(res.errors),
        });
        void refetchUsageCount();
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete glossary item",
      });
      void refetchUsageCount();
    } finally {
      runningRef.current = false;
    }
  };

  // Keeps the term and every key's tags; only its status changes (H24).
  const deprecateInstead = async () => {
    if (!glossary || runningRef.current) return;
    runningRef.current = true;
    try {
      const res = await saveGlossary({ ...toGlossarySavePayload(glossary), status: "deprecated" });
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Term deprecated. It no longer reaches the AI or highlights.",
        });
        onClose();
      } else {
        showErrorToast({
          errors: res?.validationErrors?.[0]?.errorMessage || res?.errorMessage,
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: formatErrorMessage(error) });
    } finally {
      runningRef.current = false;
    }
  };

  const renderUsage = () => {
    if (isCounting) {
      return <p className="text-sm text-medium-emphasis">Checking usage…</p>;
    }
    if (isCountError) {
      return (
        <div className="flex items-center gap-2">
          <p className="text-sm text-error">Failed to check how many keys use this glossary.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void refetchUsageCount()}
            disabled={isRecounting}
          >
            Retry
          </Button>
        </div>
      );
    }
    if (isPending) {
      return <p className="text-sm text-medium-emphasis">Deleting…</p>;
    }
    if (!hasKnownCount) {
      return null;
    }
    if (usageCount === 0) {
      return <p className="text-sm text-medium-emphasis">Not used by any keys.</p>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm text-medium-emphasis">
        <Badge variant="warning">
          Used by {pluralizeKeys(usageCount)}
          {moduleCount > 0 && ` in ${pluralizeModules(moduleCount)}`}.
        </Badge>
        <span>Deleting removes it from those keys.</span>
      </div>
    );
  };

  return (
    <DialogContent
      onEscapeKeyDown={(event) => isBusy && event.preventDefault()}
      onInteractOutside={(event) => isBusy && event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>Delete Glossary Item</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete &quot;{glossaryName}&quot;? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      {renderUsage()}
      {needsTyping && (
        <div className="grid gap-2">
          <Label htmlFor="delete-glossary-confirm">Type &quot;{glossaryName}&quot; to confirm</Label>
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
            Cancel
          </Button>
        </DialogTrigger>
        {canDeprecate && (
          <Button variant="outline" onClick={() => void deprecateInstead()} disabled={isBusy}>
            {isDeprecating && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Deprecate instead
          </Button>
        )}
        <Button variant="destructive" onClick={deleteGlossary} disabled={!canConfirm}>
          {isCounting ? "Checking usage…" : "Delete"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteGlossary;
