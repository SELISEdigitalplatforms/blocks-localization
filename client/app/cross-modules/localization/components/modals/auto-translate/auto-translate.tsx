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
import { useProjectStore } from "@/store/useProjectStore";
import { toast } from "@/hooks/use-toast";

const AutoTranslate = () => {
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
          <Button disabled={isPending} variant="secondary" className="min-w-[80px]">
            Cancel
          </Button>
        </DialogTrigger>
        <DialogTrigger asChild>
          <Button disabled={isPending} className="min-w-[80px]" onClick={handleTranslate}>
            Yes
          </Button>
        </DialogTrigger>
      </DialogFooter>
    </DialogContent>
  );
};

export default AutoTranslate;
