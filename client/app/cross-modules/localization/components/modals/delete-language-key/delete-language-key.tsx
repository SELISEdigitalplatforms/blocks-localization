import React from "react";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useDeleteLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface DeleteLanguageKeyProps {
  itemId: string;
  onClose: () => void;
}

const DeleteLanguageKey: React.FC<DeleteLanguageKeyProps> = ({
  itemId,
  onClose,
}) => {
  const navigate = useNavigate();
  const { isPending, mutateAsync } = useDeleteLanguageKey();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const deleteKey = async () => {
    if (!tenantId || !itemId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Missing project or key identifier. Please try again.",
      });
      return;
    }
    try {
      const res = await mutateAsync({ itemId: itemId, ProjectKey: tenantId });

      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Key deleted",
        });
        navigate("/app/services/language", { replace: true });
        onClose();
      } else {
        const rawErrors = res?.errors;
        let errorMessage = "Failed to delete key. Please try again.";
        if (rawErrors && typeof rawErrors === "object") {
          if (Array.isArray(rawErrors) && rawErrors.length > 0) {
            errorMessage = (rawErrors as string[]).join(", ");
          } else if (
            !Array.isArray(rawErrors) &&
            Object.keys(rawErrors).length > 0
          ) {
            const firstError = Object.values(rawErrors)[0];
            errorMessage =
              typeof firstError === "string"
                ? firstError
                : JSON.stringify(rawErrors);
          }
        }
        toast({
          variant: "destructive",
          title: "Error",
          description: errorMessage,
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    }
  };

  return (
    <DialogContent className="rounded-md sm:max-w-[450px]">
      <DialogHeader>
        <DialogTitle className="text-left">Delete Key</DialogTitle>
        <DialogDescription className="mt-4 text-left">
          <div>Are you sure you’d like to delete this key?</div>
          <span className="opacity-0">{itemId}</span>
        </DialogDescription>
      </DialogHeader>

      <DialogFooter className="flex flex-row gap-2">
        <DialogTrigger>
          <Button variant="outline" size="default" disabled={false}>
            Cancel
          </Button>
        </DialogTrigger>
        <Button
          size="default"
          className="bg-error"
          onClick={deleteKey}
          disabled={isPending}
        >
          Delete Key
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
export default DeleteLanguageKey;
