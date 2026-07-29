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
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useDeleteGlossary } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";

interface DeleteGlossaryProps {
  itemId: string;
  glossaryName: string;
  onClose: () => void;
}

const DeleteGlossary: React.FC<DeleteGlossaryProps> = ({ itemId, glossaryName, onClose }) => {
  const { isPending, mutateAsync } = useDeleteGlossary();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const deleteGlossary = async () => {
    try {
      const res = await mutateAsync({ itemId });

      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Glossary item deleted",
        });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (_error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete glossary item",
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete Glossary Item</DialogTitle>
        <DialogDescription>
          Are you sure you want to delete &quot;{glossaryName}&quot;? This action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-4">
        <DialogTrigger asChild>
          <Button variant="secondary" disabled={isPending}>
            Cancel
          </Button>
        </DialogTrigger>
        <Button variant="destructive" onClick={deleteGlossary} disabled={isPending}>
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default DeleteGlossary;
