import React from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Label } from "@/components/ui-kits/label/label";
import { useTranslateAll } from "@blocks-localization/hooks/use-language-manager";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { toast } from "@/hooks/use-toast";
import { IBlocksLanguageKey } from "@blocks-localization/models/language";

interface AutoTranslateProps {
  translatingKeys: Set<string>;
  setTranslatingKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  keysData?: { keys: IBlocksLanguageKey[] };
}

const AutoTranslate: React.FC<AutoTranslateProps> = ({
  translatingKeys,
  setTranslatingKeys,
  keysData,
}) => {
  const { isPending, mutateAsync } = useTranslateAll();
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  const handleTranslate = async () => {
    if (!projectKey) return;
    const payload = {
      projectKey: projectKey,
      messageCoRelationId: "",
      defaultLanguage: "en-US",
    };

    try {
      const res = await mutateAsync(payload);

      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Processing Translation",
          description: "Keys translation in progress.",
        });

        // Track all visible keys as translating (for showing skeleton/loading state)
        if (keysData?.keys) {
          const allKeyIds = new Set(keysData.keys.map((k) => k.itemId));
          setTranslatingKeys((prev) => {
            const next = new Set(prev);
            allKeyIds.forEach((keyId) => next.add(keyId));
            return next;
          });
        }
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  return (
    <DialogContent>
      <DialogHeader className="mb-4">
        <DialogTitle>Auto-translate all keys</DialogTitle>
        <Label className="!mt-[12px] font-normal text-medium-emphasis">
          Are you sure you want to automatically translate all keys?
        </Label>
      </DialogHeader>
      <DialogFooter className="mt-6">
        <DialogTrigger asChild>
          <Button
            disabled={isPending}
            variant="secondary"
            className="min-w-[80px]"
          >
            Cancel
          </Button>
        </DialogTrigger>
        <DialogTrigger asChild>
          <Button
            disabled={isPending}
            className="min-w-[80px]"
            onClick={handleTranslate}
          >
            Yes
          </Button>
        </DialogTrigger>
      </DialogFooter>
    </DialogContent>
  );
};

export default AutoTranslate;
