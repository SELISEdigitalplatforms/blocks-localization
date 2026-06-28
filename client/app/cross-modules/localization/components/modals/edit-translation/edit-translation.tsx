import React, { useState } from "react";
import { Label } from "@/components/ui-kits/label/label";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { Wand } from "lucide-react";
import {
  IBlocksLanguageKey,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import {
  useGetTranslationSuggestion,
  useSaveBlocksLanguageKey,
} from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/blocks-kit";

interface EditTranslationProps {
  dialogTitle: string;
  keyDetails: IBlocksLanguageKey;
  destinationLanguageCode: string;
  languageListData: ILanguageConfig[];
}

const EditTranslation: React.FC<EditTranslationProps> = ({
  dialogTitle,
  keyDetails,
  destinationLanguageCode,
  languageListData,
}) => {
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();
  const { isPending: isAutoTranslateLoading, mutateAsync: autoTranslateAsync } =
    useGetTranslationSuggestion();

  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const [translation, setTranslation] = useState(
    keyDetails.resources?.find(
      (resource) => resource.culture === destinationLanguageCode,
    )?.value || "",
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
          // elementDetailContext: keyDetails.context,
          glossaryIds: keyDetails.glossaryIds,
          moduleId: keyDetails.moduleId,
          destinationLanguageCode: destinationLanguageCode,
          projectKey: tenantId,
        };
        const res = await autoTranslateAsync(payload);
        if (res.content) {
          setTranslation(res.content);
          toast({
            variant: "success",
            title: "Success",
            description: "Translated successfully",
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
  }

  async function handleSave() {
    const index = keyDetails.resources.findIndex(
      (resource) => resource.culture === destinationLanguageCode,
    );
    if (index === -1) {
      keyDetails.resources?.push({
        culture: destinationLanguageCode,
        value: translation,
      });
    } else if (keyDetails.resources) {
      keyDetails.resources[index].value = translation;
    } else {
      keyDetails.resources = [
        {
          culture: destinationLanguageCode,
          value: translation,
        },
      ];
    }
    // keyDetails.resources = keyDetails?.resources && keyDetails.resources.map(resource => {
    //   if (resource.culture === destinationLanguageCode) {
    //     return {
    //       ...resource,
    //       value: translation,
    //     };
    //   }
    //   return resource;
    // });
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
          keyDetails?.routes?.length && keyDetails?.routes?.length > 0
            ? keyDetails.routes
            : [],
        glossaryIds: keyDetails.glossaryIds,
        isPartiallyTranslated: keyDetails.isPartiallyTranslated,
        projectKey: tenantId,
        context: keyDetails.context,
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Language key updated successfully",
        });
        // form.reset();
        // router.replace("/services/language");
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
                (resource) =>
                  resource.culture === languageListData[0].languageCode,
              )?.value
            }
          </DialogDescription>
          <div className="mt-3 flex justify-between">
            <Label
              htmlFor="configName"
              className="mt-3 text-left font-medium text-high-emphasis"
            >
              {
                languageListData.find(
                  (l) => l.languageCode == destinationLanguageCode,
                )?.languageName
              }{" "}
              Translation
            </Label>
            <div className="flex gap-2">
              {/* <Button size="sm" variant="outline" className="gap-2">
              <Bolt className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                Configure auto translation
              </span>
            </Button> */}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={
                  isAutoTranslateLoading ||
                  languageListData.find(
                    (l) => l.languageCode == destinationLanguageCode,
                  )?.isDefault
                }
                onClick={autoTranslate(
                  languageListData.find(
                    (l) => l.languageCode == destinationLanguageCode,
                  )?.languageName,
                  keyDetails.resources?.find(
                    (resource) =>
                      resource.culture === languageListData[0].languageCode,
                  )?.value || "",
                )}
              >
                <Wand className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Auto-Translate
                </span>
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
          <Button
            size="default"
            disabled={isPending || !translation}
            onClick={handleSave}
          >
            Save
          </Button>
        </DialogTrigger>
      </DialogFooter>
    </DialogContent>
  );
};

export default EditTranslation;
