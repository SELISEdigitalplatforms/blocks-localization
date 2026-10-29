import { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { IBlocksLanguageKey, IGlossary } from "@blocks-localization/models/language";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import GlossaryPicker from "@blocks-localization/components/glossary/glossary-picker";

interface EditKeyGlossaryProps {
  keyDetails: IBlocksLanguageKey;
  resolvedGlossaries: IGlossary[];
  onClose: () => void;
}

/** Mounted only while the dialog is open, so every open starts from the key's current tags. */
function EditKeyGlossaryBody({
  keyDetails,
  resolvedGlossaries,
  onClose,
}: Readonly<EditKeyGlossaryProps>) {
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();
  const [selectedIds, setSelectedIds] = useState<string[]>(keyDetails.glossaryIds ?? []);

  async function handleSave() {
    try {
      // The key's full payload, so context, routes and resources are kept (C13).
      const payload = {
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources:
          keyDetails?.resources?.length && keyDetails?.resources?.length > 0
            ? keyDetails.resources
            : [],
        routes: keyDetails.routes ?? [],
        glossaryIds: selectedIds,
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        context: keyDetails.context,
      };

      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Glossary updated successfully",
        });
        onClose();
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatErrorMessage(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: formatErrorMessage(error),
      });
    }
  }

  return (
    <>
      <DialogHeader className="space-y-1.5">
        <DialogTitle className="text-left text-xl">Tag Glossary</DialogTitle>
        <DialogDescription className="text-left text-sm text-medium-emphasis">
          Tagged terms guide AI translation and glossary checks for the key{" "}
          <span className="break-all font-medium text-high-emphasis">{keyDetails.keyName}</span>.
        </DialogDescription>
      </DialogHeader>

      <div className="min-w-0">
        <GlossaryPicker
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          allowCreate
          disabled={isPending}
          knownGlossaries={resolvedGlossaries}
        />
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        <DialogClose asChild>
          <Button
            variant="outline"
            size="default"
            disabled={isPending}
            className="flex-1 sm:flex-1"
          >
            Cancel
          </Button>
        </DialogClose>
        <Button
          size="default"
          onClick={handleSave}
          disabled={isPending}
          className="flex-1 sm:flex-1"
        >
          {isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </>
  );
}

function EditKeyGlossary(props: Readonly<EditKeyGlossaryProps>) {
  return (
    <DialogContent className="w-[calc(100vw-2rem)] rounded-lg sm:max-w-[520px]">
      <EditKeyGlossaryBody {...props} />
    </DialogContent>
  );
}

export default EditKeyGlossary;
