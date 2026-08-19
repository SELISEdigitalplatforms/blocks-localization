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
import { toast } from "@/hooks/use-toast";

interface AutoTranslateProps {
  onClose?: (value?: boolean) => void;
}

const AutoTranslate: React.FC<AutoTranslateProps> = ({ onClose }) => {
  const { isPending, mutateAsync } = useTranslateAll();

  const formatErrorMessage = (errors: unknown): string => {
    if (errors === null || errors === undefined) return "Unknown error";
    if (typeof errors === "string") return errors;
    if (typeof errors === "object") {
      const entries = Object.entries(errors);
      if (entries.length > 0) {
        return entries.map(([, value]) => String(value)).join("; ");
      }
    }
    return String(errors);
  };

  const handleTranslate = async () => {
    const payload = {
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
        onClose?.(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatErrorMessage(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : String(error),
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
