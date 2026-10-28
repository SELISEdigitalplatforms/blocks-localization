import React, { useRef } from "react";
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
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";

interface DeleteGlossaryProps {
  itemId: string;
  glossaryName: string;
  onClose: () => void;
}

const pluralizeKeys = (count: number) => `${count} key${count === 1 ? "" : "s"}`;

const DeleteGlossary: React.FC<DeleteGlossaryProps> = ({ itemId, glossaryName, onClose }) => {
  const {
    data: usageCount,
    isLoading: isCounting,
    isFetching: isRecounting,
    isError: isCountError,
    refetch: refetchUsageCount,
  } = useGetGlossaryUsageCount(itemId);
  const { isPending, mutateAsync } = useDeleteGlossaryWithCascade();
  const runningRef = useRef(false);

  const hasKnownCount = !isCountError && typeof usageCount === "number";
  const isBusy = isPending;
  const canConfirm = hasKnownCount && !isCounting && !isRecounting && !isBusy;

  const deleteGlossary = async () => {
    if (runningRef.current || !hasKnownCount) {
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
        <Badge variant="warning">Used by {pluralizeKeys(usageCount)}</Badge>
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
      <DialogFooter className="mt-4">
        <DialogTrigger asChild>
          <Button variant="secondary" disabled={isBusy}>
            Cancel
          </Button>
        </DialogTrigger>
        <Button variant="destructive" onClick={deleteGlossary} disabled={!canConfirm}>
          {isCounting ? "Checking usage…" : "Delete"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteGlossary;
