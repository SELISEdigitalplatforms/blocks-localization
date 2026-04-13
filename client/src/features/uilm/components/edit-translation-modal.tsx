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
import { Label } from "@/platform/ui/components/label/label";
import { Textarea } from "@/platform/ui/components/textarea/textarea";
import { Wand } from "lucide-react";
import type { IBlocksLanguageKey, ILanguageConfig } from "@/features/uilm/types/language";
import {
  useUilmGetTranslationSuggestion,
  useUilmSaveLanguageKey,
} from "@/features/uilm/hooks/use-uilm-queries";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";

interface EditTranslationProps {
  dialogTitle: string;
  keyDetails: IBlocksLanguageKey;
  destinationLanguageCode: string;
  languageListData: ILanguageConfig[];
}

export function EditTranslationModal({
  dialogTitle,
  keyDetails,
  destinationLanguageCode,
  languageListData,
}: EditTranslationProps) {
  const { isPending, mutateAsync } = useUilmSaveLanguageKey();
  const { isPending: isAutoTranslateLoading, mutateAsync: autoTranslateAsync } =
    useUilmGetTranslationSuggestion();

  const [translation, setTranslation] = useState(
    keyDetails.resources?.find((resource) => resource.culture === destinationLanguageCode)?.value ||
      "",
  );

  function autoTranslate(
    destinationLanguage: string | undefined,
    defaultLanguageText: string,
  ): React.MouseEventHandler<HTMLButtonElement> {
    return async (e) => {
      e.preventDefault();
      try {
        const payload = {
          sourceText: defaultLanguageText,
          destinationLanguage: destinationLanguage || "English",
          currentLanguage: "English",
          temperature: 0.1,
          elementDetailContext: keyDetails.context,
        };
        const res = await autoTranslateAsync(payload);
        if (res.content) {
          setTranslation(res.content);
          showSuccessToast({ description: "Translated successfully" });
        } else {
          showErrorToast({ errors: JSON.stringify(res?.errors) });
        }
      } catch (error) {
        showErrorToast({
          errors: error instanceof Error ? error.message : JSON.stringify(error),
        });
      }
    };
  }

  async function handleSave() {
    const index = keyDetails.resources.findIndex(
      (resource) => resource.culture === destinationLanguageCode,
    );
    const updatedResources = [...keyDetails.resources];
    if (index === -1) {
      updatedResources.push({
        culture: destinationLanguageCode,
        value: translation,
      });
    } else {
      updatedResources[index] = { ...updatedResources[index], value: translation };
    }

    try {
      const payload = {
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources: updatedResources,
        routes: keyDetails?.routes ?? [],
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        projectKey: "",
        context: keyDetails.context,
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        showSuccessToast({ description: "Language key updated successfully" });
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
    <DialogContent className="rounded-md sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle className="text-left">{dialogTitle}</DialogTitle>
        <div className="py-4 text-left">
          <p className="mb-2 text-[14px] text-low-emphasis">
            Default value ({languageListData[0].languageName})
          </p>
          <DialogDescription className="text-high-emphasis">
            {
              keyDetails.resources?.find(
                (resource) => resource.culture === languageListData[0].languageCode,
              )?.value
            }
          </DialogDescription>
          <div className="mt-3 flex justify-between">
            <Label htmlFor="destinationLanguageText" className="mt-3 text-left font-medium text-high-emphasis">
              {
                languageListData.find((l) => l.languageCode === destinationLanguageCode)
                  ?.languageName
              }{" "}
              Translation
            </Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={
                  isAutoTranslateLoading ||
                  languageListData.find((l) => l.languageCode === destinationLanguageCode)?.isDefault
                }
                onClick={autoTranslate(
                  languageListData.find((l) => l.languageCode === destinationLanguageCode)
                    ?.languageName,
                  keyDetails.resources?.find(
                    (resource) => resource.culture === languageListData[0].languageCode,
                  )?.value || "",
                )}
              >
                <Wand className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Auto-Translate</span>
              </Button>
            </div>
          </div>

          <Textarea
            id="destinationLanguageText"
            className="border-default col-span-3 mt-1 min-h-[116px] border shadow-none"
            placeholder="Enter translation"
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
          />
        </div>
      </DialogHeader>
      <DialogFooter className="mt-[-14px] flex flex-row gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="default">
            Cancel
          </Button>
        </DialogTrigger>
        <DialogTrigger asChild>
          <Button size="default" disabled={isPending || !translation} onClick={handleSave}>
            Save
          </Button>
        </DialogTrigger>
      </DialogFooter>
    </DialogContent>
  );
}
