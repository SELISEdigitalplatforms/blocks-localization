import React, { useState } from "react";
import { Button } from "@/platform/ui/components/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/platform/ui/components/dialog/dialog";
import { Undo2, Delete } from "lucide-react";
import { Label } from "@/platform/ui/components/label/label";
import { Textarea } from "@/platform/ui/components/textarea/textarea";
import type { IBlocksLanguageKey } from "@/features/uilm/types/language";
import { useUilmSaveLanguageKey, useUilmProjectKey } from "@/features/uilm/hooks/use-uilm-queries";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";

interface GptPromptModalProps {
  defaultValue?: string;
  keyDetails: IBlocksLanguageKey;
}

export function GptPromptModal({ defaultValue: propDefaultValue, keyDetails }: GptPromptModalProps) {
  const defaultValue =
    propDefaultValue ||
    "The requirement is to translate a user interface element of a webpage. Output only the translated text (no quotes, no explanation).";
  const [text, setText] = useState(defaultValue);
  const projectKey = useUilmProjectKey();
  const { isPending, mutateAsync } = useUilmSaveLanguageKey();

  const handleWordsLimit = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
  };

  const restoreDefault = () => {
    setText(defaultValue);
  };

  const clearValue = () => {
    setText("");
  };

  async function handleSave() {
    try {
      const payload = {
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources:
          keyDetails?.resources?.length && keyDetails?.resources?.length > 0
            ? keyDetails.resources
            : [],
        routes:
          keyDetails?.routes?.length && keyDetails?.routes?.length > 0 ? keyDetails.routes : [],
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        projectKey,
        context: text,
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        showSuccessToast({ description: "Auto translation prompt updated successfully" });
      } else {
        showErrorToast({ errors: res?.errorMessage || "Save failed" });
      }
    } catch (error) {
      showErrorToast({
        errors: error instanceof Error ? error.message : JSON.stringify(error),
      });
    }
  }

  return (
    <DialogContent className="md:min-w-[720px]" aria-describedby="dialog-description">
      <DialogHeader className="mb-2">
        <DialogTitle>Auto translation prompt</DialogTitle>
        <DialogDescription></DialogDescription>
      </DialogHeader>

      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <Label>ChatGPT prompt</Label>
          <div className="flex items-center">
            <Button variant="secondary" onClick={restoreDefault}>
              <Undo2 className="mr-2 h-5 w-5" />
              Restore default
            </Button>
            <Button variant="secondary" className="ml-[16px]" onClick={clearValue}>
              <Delete className="mr-2 h-5 w-5" />
              Clear
            </Button>
          </div>
        </div>
        <div className="flex flex-col">
          <div className="relative rounded-md border border-input bg-background">
            <Textarea
              value={text}
              onChange={handleWordsLimit}
              className="h-28 resize-none rounded-none border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="border-0 bg-background px-3 py-2 text-sm text-muted-foreground">
              Translate the following from {"{CurrentLanguage}"} to {"{DestinationLanguage}"}:&apos;
              {"{SourceText}"}&apos;.
            </div>
          </div>
        </div>
      </div>
      <DialogFooter className="mt-2">
        <DialogTrigger asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogTrigger>
        <DialogTrigger asChild>
          <Button disabled={isPending} onClick={handleSave}>
            Save
          </Button>
        </DialogTrigger>
      </DialogFooter>
    </DialogContent>
  );
}
