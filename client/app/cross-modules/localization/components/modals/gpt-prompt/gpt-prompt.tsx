import React, { useState } from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Undo2, Delete } from "lucide-react";
import { Label } from "@/components/ui-kits/label/label";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { IBlocksLanguageKey } from "@blocks-localization/models/language";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/genesis-os";

const GptPrompt: React.FC<{
  defaultValue?: string;
  keyDetails: IBlocksLanguageKey;
  onClose: (value: boolean) => void;
}> = ({ defaultValue: propDefaultValue, keyDetails, onClose }) => {
  const defaultValue =
    propDefaultValue ||
    "The requirement is to translate a user interface element of a webpage. Output only the translated text (no quotes, no explanation).";
  const [text, setText] = useState(defaultValue);
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();


  const handleWordsLimit = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textAreaText = event.target.value;
    setText(textAreaText);
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
        glossaryIds: keyDetails.glossaryIds,
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        context: text,
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Auto translation prompt updated successfully",
        });
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
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
          {/* <div className="mt-2 flex w-full justify-end">
            <div className="text-[14px] font-normal text-medium-emphasis">
              {wordCount(text)}/{wordsLimit}
            </div>
          </div> */}
        </div>
      </div>
      <DialogFooter className="mt-2">
        <DialogTrigger asChild>
          <Button variant="secondary">Cancel</Button>
        </DialogTrigger>
        <Button disabled={isPending} onClick={handleSave}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default GptPrompt;
