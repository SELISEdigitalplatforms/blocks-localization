import React from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui-kits/dialog/dialog";
import {
  useDeleteLanguageModule,
  useGetModuleKeyCount,
} from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { getHttpErrorMessage } from "@/lib/error";
import { IModuleGets } from "@blocks-localization/models/language";

interface DeleteModuleModalProps {
  module: IModuleGets;
  onClose: (open: boolean) => void;
}

const DeleteModuleModal: React.FC<DeleteModuleModalProps> = ({ module, onClose }) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { isPending, mutateAsync } = useDeleteLanguageModule();
  const {
    data: keyCount,
    isLoading: isKeyCountLoading,
    refetch: refetchKeyCount,
  } = useGetModuleKeyCount(module.itemId);

  // The server enforces the rule too; if the count could not be loaded, let it decide.
  const hasKeys = (keyCount ?? 0) > 0;

  // The translations table filtered to this module, where its keys can be moved or deleted.
  const handleViewKeys = () => {
    onClose(false);
    navigate(scoped(`services/language?moduleIds=${encodeURIComponent(module.itemId)}`));
  };

  const handleSubmit = async () => {
    try {
      const res = await mutateAsync({ itemId: module.itemId });
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
          <span className="font-semibold">{module.moduleName}</span> has {keyCount}{" "}
          {keyCount === 1 ? "key" : "keys"}. Please delete or move all keys to another module before
          deleting it.
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

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete module</DialogTitle>
        <DialogDescription>{renderDescription()}</DialogDescription>
      </DialogHeader>

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
          <Button type="button" onClick={handleViewKeys}>
            View keys
          </Button>
        ) : (
          <Button
            variant="destructive"
            disabled={isPending || isKeyCountLoading}
            onClick={handleSubmit}
          >
            {isPending ? "Deleting..." : "Delete"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteModuleModal;
