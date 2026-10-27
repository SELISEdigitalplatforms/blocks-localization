import React, { useCallback, useState } from "react";
import { Label } from "@/components/ui-kits/label/label";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogContent,
} from "@/components/ui-kits/dialog/dialog";
import { Button } from "@/components/ui-kits/button/button";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { BookOpen, LoaderCircle, Wand } from "lucide-react";
import {
  IBlocksLanguageKey,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import {
  GlossaryTargetChecks,
  GlossaryUnavailableNote,
  useGlossarySuggestionRows,
} from "@blocks-localization/components/glossary/glossary-violation-list";
import {
  distinctGlossaryMatches,
  HighlightedSourceText,
} from "@blocks-localization/components/glossary/highlighted-source-text";
import {
  useApplicableGlossaryMatches,
  useLoadedGlossaries,
} from "@blocks-localization/hooks/use-live-glossary-check";
import { useTargetInsertion } from "@blocks-localization/hooks/use-target-insertion";
import { getDefaultLanguage } from "@blocks-localization/utils/glossary-rule-marker";
import { GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";
import { hasRuleForCulture } from "@blocks-localization/utils/glossary-validation";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";

const NO_MATCHES: GlossaryMatch[] = [];

/** The hint next to the source label, honest about what the glossary has for this language. */
const sourceTermsHint = (termCount: number, withWording: number, language: string) => {
  const terms = termCount === 1 ? "1 glossary term" : `${termCount} glossary terms`;
  if (withWording === termCount) return `${terms} · select to see the approved wording`;
  if (withWording === 0) return `${terms} · no ${language} wording in the glossary yet`;
  return `${terms} · ${withWording} with ${language} wording`;
};

interface EditTranslationProps {
  dialogTitle: string;
  keyDetails: IBlocksLanguageKey;
  destinationLanguageCode: string;
  languageListData: ILanguageConfig[];
  onClose: (value?: boolean) => void;
  /** The project's full glossary (View Details' shared loader): suggestions, highlights, checks. */
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

  // Highlights and live checks: plain text and no warnings until the glossary loads (C2).
  const glossaries = useLoadedGlossaries(loadGlossaries);
  const sourceMatches = useApplicableGlossaryMatches(glossaries, defaultLanguageText, {
    sourceCulture: defaultLanguage?.languageCode ?? "",
    keyGlossaryIds: keyDetails.glossaryIds,
    moduleId: keyDetails.moduleId,
  });
  /** A user edit (typing or Insert): the suggestion's list gives way to the live check. */
  const editTranslation = useCallback(
    (value: string) => {
      setTranslation(value);
      clearViolations(destinationLanguageCode);
    },
    [clearViolations, destinationLanguageCode],
  );
  const { bindTarget, insert } = useTargetInsertion({
    cultures: [destinationLanguageCode],
    getValue: () => translation,
    setValue: (_culture, value) => editTranslation(value),
  });

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

  // Editing the default language itself: there is no target wording to look up or apply.
  const highlightMatches = destinationLanguage?.isDefault ? NO_MATCHES : sourceMatches;
  const terms = distinctGlossaryMatches(highlightMatches);
  const termsWithWording = terms.filter((match) =>
    hasRuleForCulture(match.meta, destinationLanguageCode),
  ).length;

  return (
    <DialogContent className="w-[calc(100vw-2rem)] rounded-lg sm:max-w-[700px]">
      <DialogHeader>
        <DialogTitle className="text-left">{dialogTitle}</DialogTitle>
      </DialogHeader>
      <div className="grid min-w-0 gap-5">
        <section aria-labelledby="edit-translation-source-label" className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <p
              id="edit-translation-source-label"
              className="text-sm font-medium text-medium-emphasis"
            >
              {defaultLanguage?.languageName} (default)
            </p>
            {terms.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-low-emphasis">
                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {sourceTermsHint(
                  terms.length,
                  termsWithWording,
                  destinationLanguage?.languageName || destinationLanguageCode,
                )}
              </p>
            )}
          </div>
          <DialogDescription className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left text-sm leading-7 text-high-emphasis">
            <HighlightedSourceText
              text={defaultLanguageText}
              matches={highlightMatches}
              targetLanguage={{
                languageCode: destinationLanguageCode,
                languageName: destinationLanguage?.languageName ?? "",
              }}
              targetText={translation}
              onInsert={destinationLanguage?.isDefault ? undefined : insert}
            />
          </DialogDescription>
        </section>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="destinationLanguageText"
              className="text-sm font-medium text-high-emphasis"
            >
              {destinationLanguage?.languageName} translation
            </Label>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              aria-label="Auto-Translate"
              disabled={isAutoTranslateLoading || destinationLanguage?.isDefault}
              onClick={autoTranslate}
            >
              {isAutoTranslateLoading ? (
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Wand className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span className="hidden whitespace-nowrap sm:inline">
                {isAutoTranslateLoading ? "Translating…" : "Auto-Translate"}
              </span>
            </Button>
          </div>
          {glossaryRow.glossaryUnavailable && <GlossaryUnavailableNote />}
          <Textarea
            id="destinationLanguageText"
            className="border-default min-h-[116px] border shadow-none"
            placeholder="Enter translation"
            value={translation}
            {...bindTarget(destinationLanguageCode)}
            onChange={(e) => editTranslation(e.target.value)}
          />
          <GlossaryTargetChecks
            className="mt-0"
            row={glossaryRow}
            targetText={translation}
            targetCulture={destinationLanguageCode}
            liveMatches={destinationLanguage?.isDefault ? [] : sourceMatches}
            disabled={isAutoTranslateLoading}
            onSuggestionFix={(violation) => {
              const fixed = fix(destinationLanguageCode, violation, translation);
              if (fixed !== null) setTranslation(fixed);
            }}
            onRetry={() => void runAutoTranslate()}
            onLiveFix={editTranslation}
          />
        </div>
      </div>
      <DialogFooter className="gap-2 sm:gap-2">
        <DialogClose asChild>
          <Button variant="outline" size="default">
            Cancel
          </Button>
        </DialogClose>
        <Button size="default" disabled={isPending || !translation} onClick={handleSave}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default EditTranslation;
