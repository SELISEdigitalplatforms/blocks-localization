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
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import {
  GlossaryUnavailableNote,
  GlossaryViolationList,
  useGlossarySuggestionRows,
} from "@blocks-localization/components/glossary/glossary-violation-list";
import { getDefaultLanguage } from "@blocks-localization/utils/glossary-rule-marker";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";

interface EditTranslationProps {
  dialogTitle: string;
  keyDetails: IBlocksLanguageKey;
  destinationLanguageCode: string;
  languageListData: ILanguageConfig[];
  onClose: (value?: boolean) => void;
  /** The project's full glossary (View Details' shared loader); used with the flag on. */
  loadGlossaries?: () => Promise<IGlossary[]>;
}

const EditTranslation: React.FC<EditTranslationProps> = ({
  dialogTitle,
  keyDetails,
  destinationLanguageCode,
  languageListData,
  onClose,
  loadGlossaries,
}) => {
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();
  const {
    request,
    isPending: isSuggestionPending,
    getRow,
    clearViolations,
    fix,
  } = useGlossarySuggestionRows({ loadGlossaries });
  // Not languageListData[0]: the cached list is only default-first if a caller sorted it (A10).
  const defaultLanguage = getDefaultLanguage(languageListData);
  const destinationLanguage = languageListData.find(
    (l) => l.languageCode == destinationLanguageCode,
  );
  const defaultLanguageText =
    keyDetails.resources?.find((resource) => resource.culture === defaultLanguage?.languageCode)
      ?.value || "";
  const isAutoTranslateLoading = isSuggestionPending(destinationLanguageCode);
  const glossaryRow = getRow(destinationLanguageCode);

  const [translation, setTranslation] = useState(
    keyDetails.resources?.find((resource) => resource.culture === destinationLanguageCode)?.value ||
      "",
  );

  async function runAutoTranslate() {
    const outcome = await request({
      requestKey: destinationLanguageCode,
      legacyPayload: {
        sourceText: defaultLanguageText,
        destinationLanguage: destinationLanguage?.languageName || "English",
        currentLanguage: defaultLanguage?.languageName || "English",
        temperature: 0.1,
        glossaryIds: keyDetails.glossaryIds,
        moduleId: keyDetails.moduleId,
        destinationLanguageCode: destinationLanguageCode,
      },
      sourceText: defaultLanguageText,
      defaultLanguage,
      targetLanguage: {
        languageName: destinationLanguage?.languageName ?? "",
        languageCode: destinationLanguageCode,
      },
      keyContext: keyDetails.context,
      keyGlossaryIds: keyDetails.glossaryIds,
      moduleId: keyDetails.moduleId,
    });
    if (outcome.status === "stale") return;
    if (outcome.status === "success") {
      setTranslation(outcome.content);
      toast({
        variant: "success",
        title: "Success",
        description: "Translated successfully",
      });
      return;
    }
    toast({
      variant: "destructive",
      title: "Error",
      description: formatErrorMessage(outcome.status === "empty" ? outcome.errors : outcome.error),
    });
  }

  const autoTranslate: React.MouseEventHandler<HTMLButtonElement> = (e) => {
    e.preventDefault();
    void runAutoTranslate();
  };

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
      // eslint-disable-next-line react-hooks/immutability -- mutating the caller's keyDetails in place is the existing contract this save relies on.
      keyDetails.resources[index].value = translation;
    } else {
      // eslint-disable-next-line react-hooks/immutability -- mutating the caller's keyDetails in place is the existing contract this save relies on.
      keyDetails.resources = [
        {
          culture: destinationLanguageCode,
          value: translation,
        },
      ];
    }
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
        context: keyDetails.context,
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Language key updated successfully",
        });
        onClose(false);
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
    <DialogContent className="rounded-md sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle className="text-left">{dialogTitle}</DialogTitle>
        <div className="py-4 text-left">
          <p className="mb-2 text-[14px] text-low-emphasis">
            Default value ({defaultLanguage?.languageName})
          </p>
          <DialogDescription className="text-high-emphasis">
            {defaultLanguageText}
          </DialogDescription>
          <div className="mt-3 flex justify-between">
            <Label htmlFor="configName" className="mt-3 text-left font-medium text-high-emphasis">
              {destinationLanguage?.languageName} Translation
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
                disabled={isAutoTranslateLoading || destinationLanguage?.isDefault}
                onClick={autoTranslate}
              >
                <Wand className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Auto-Translate</span>
              </Button>
            </div>
          </div>
          {glossaryRow.glossaryUnavailable && <GlossaryUnavailableNote className="mt-2" />}

          <Textarea
            id="destinationLanguageText"
            className="border-default col-span-3 mt-1 min-h-[116px] border shadow-none"
            placeholder="Enter translation"
            value={translation}
            onChange={(e) => {
              setTranslation(e.target.value);
              clearViolations(destinationLanguageCode);
            }}
          />
          <GlossaryViolationList
            violations={glossaryRow.violations}
            matches={glossaryRow.matches}
            targetCulture={glossaryRow.targetCulture}
            disabled={isAutoTranslateLoading}
            onFix={(violation) => {
              const fixed = fix(destinationLanguageCode, violation, translation);
              if (fixed !== null) setTranslation(fixed);
            }}
            onRetry={() => void runAutoTranslate()}
          />
        </div>
      </DialogHeader>
      <DialogFooter className="mt-[-14px] flex gap-2">
        <DialogTrigger asChild>
          <Button variant="outline" size="default">
            Cancel
          </Button>
        </DialogTrigger>
        <Button size="default" disabled={isPending || !translation} onClick={handleSave}>
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default EditTranslation;
