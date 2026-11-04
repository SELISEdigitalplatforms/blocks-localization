import React, { useCallback, useRef, useState } from "react";
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
import { BookOpen, Check, LoaderCircle, Plus, Wand } from "lucide-react";
import { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import {
  GlossaryTargetChecks,
  useGlossarySuggestionRows,
} from "@blocks-localization/components/glossary/glossary-violation-list";
import {
  distinctGlossaryMatches,
  HighlightedSourceText,
} from "@blocks-localization/components/glossary/highlighted-source-text";
import { useSourceGlossaryMatches } from "@blocks-localization/hooks/use-live-glossary-check";
import { useTargetInsertion } from "@blocks-localization/hooks/use-target-insertion";
import { getDefaultLanguage } from "@blocks-localization/utils/glossary-rule-marker";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { isMatchedGlossaryName } from "@blocks-localization/utils/glossary-name";
import { hasRuleForCulture } from "@blocks-localization/utils/glossary-validation";
import GlossaryEditorSheet from "@blocks-localization/components/modals/glossary/glossary-editor-sheet";
import GlossaryTermMenu, {
  getGlossaryTermMenuHint,
  getGlossaryTermMenuItems,
  getGlossaryTermMenuShortcut,
  isGlossaryTermMenuShortcut,
} from "@blocks-localization/components/glossary/glossary-term-menu";
import { useSourceTextSelection } from "@blocks-localization/hooks/use-source-text-selection";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { useT, type TFunction } from "@seliseblocks/genesis-os/i18n";

const COMMON_ERROR = "common:ERROR";

const NO_MATCHES: GlossaryMatch[] = [];

interface SourceTermsCounts {
  terms: number;
  withWording: number;
  /** Terms with wording to write in the target (Translate with a value, or Keep). */
  insertable: number;
  /** Of those, the ones the target text does not use yet. */
  pending: number;
}

/**
 * The hint next to the source label: what is left to do for the glossaries, or that they are
 * all used, and honest about what the glossary has for this language.
 */
const sourceTermsHint = (
  t: TFunction,
  { terms, withWording, insertable, pending }: SourceTermsCounts,
  language: string,
) => {
  if (withWording === 0) return t("EDIT_TRANSLATION.HINT_NONE", { count: terms, language });
  if (pending > 0) return t("EDIT_TRANSLATION.HINT_PENDING", { count: terms, pending });
  if (insertable === terms) return t("EDIT_TRANSLATION.HINT_USED", { count: terms });
  if (withWording === terms) return t("EDIT_TRANSLATION.HINT_ALL", { count: terms });
  return t("EDIT_TRANSLATION.HINT_SOME", { count: terms, withWording, language });
};

interface EditTranslationProps {
  dialogTitle: string;
  keyDetails: IBlocksLanguageKey;
  destinationLanguageCode: string;
  languageListData: ILanguageConfig[];
  onClose: (value?: boolean) => void;
}

const EditTranslation: React.FC<EditTranslationProps> = ({
  dialogTitle,
  keyDetails,
  destinationLanguageCode,
  languageListData,
  onClose,
}) => {
  const { t } = useT("localization.keys");
  const { isPending, mutateAsync } = useSaveBlocksLanguageKey();
  const {
    request,
    isPending: isSuggestionPending,
    getRow,
    clearViolations,
    fix,
  } = useGlossarySuggestionRows();
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

  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLTextAreaElement | null>(null);
  const [termMenuOpen, setTermMenuOpen] = useState(false);
  const [addTermName, setAddTermName] = useState<string | undefined>(undefined);
  const sourceSelection = useSourceTextSelection(sourceRef);

  const [translation, setTranslation] = useState(
    keyDetails.resources?.find((resource) => resource.culture === destinationLanguageCode)?.value ||
      "",
  );

  const { matches, isCurrent } = useSourceGlossaryMatches({
    text: defaultLanguageText,
    sourceCulture: defaultLanguage?.languageCode ?? "",
    keyId: keyDetails.itemId,
    moduleId: keyDetails.moduleId,
    glossaryIds: keyDetails.glossaryIds,
  });
  const sourceMatches = isCurrent ? matches : NO_MATCHES;
  /** A user edit (typing or Insert): the suggestion's list gives way to the live check. */
  const editTranslation = useCallback(
    (value: string) => {
      setTranslation(value);
      clearViolations(destinationLanguageCode);
    },
    [clearViolations, destinationLanguageCode, setTranslation],
  );
  const { bindTarget, insert } = useTargetInsertion({
    cultures: [destinationLanguageCode],
    getValue: () => translation,
    setValue: (_culture, value) => editTranslation(value),
  });
  const targetBinding = bindTarget(destinationLanguageCode);

  async function runAutoTranslate() {
    const outcome = await request({
      requestKey: destinationLanguageCode,
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
        title: t("common:SUCCESS"),
        description: t("EDIT_TRANSLATION.TRANSLATED"),
      });
      return;
    }
    toast({
      variant: "destructive",
      title: t(COMMON_ERROR),
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
          title: t("common:SUCCESS"),
          description: t("EDIT_TRANSLATION.UPDATED"),
        });
        onClose(false);
      } else {
        toast({
          variant: "destructive",
          title: t(COMMON_ERROR),
          description: formatErrorMessage(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: t(COMMON_ERROR),
        description: formatErrorMessage(error),
      });
    }
  }

  // Editing the default language itself: there is no target wording to look up or apply.
  const highlightMatches = destinationLanguage?.isDefault ? NO_MATCHES : sourceMatches;
  const terms = distinctGlossaryMatches(highlightMatches);
  const insertableTerms = getGlossaryTermMenuItems(
    highlightMatches,
    destinationLanguageCode,
    translation,
  ).filter((item) => !!item.value);
  const termCounts: SourceTermsCounts = {
    terms: terms.length,
    withWording: terms.filter((match) => hasRuleForCulture(match.meta, destinationLanguageCode))
      .length,
    insertable: insertableTerms.length,
    pending: insertableTerms.filter((item) => !item.used).length,
  };
  // Same condition as the "used in the translation" hint.
  const allTermsUsed =
    termCounts.terms > 0 &&
    termCounts.pending === 0 &&
    termCounts.insertable === termCounts.terms;
  // Only while some glossary is not in the translation yet: inserting a used one duplicates it.
  const canInsertTerm = !destinationLanguage?.isDefault && termCounts.pending > 0;
  const termShortcut = getGlossaryTermMenuShortcut();
  // Not while editing the default language (nothing to translate), nor for text that already is a glossary.
  const canAddSelectionToGlossary =
    !!sourceSelection &&
    !destinationLanguage?.isDefault &&
    !isMatchedGlossaryName(sourceSelection, sourceMatches);

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
              {t("EDIT_TRANSLATION.SOURCE_LABEL", { language: defaultLanguage?.languageName ?? "" })}
            </p>
            {terms.length > 0 && (
              <p className="flex items-center gap-1.5 text-xs text-low-emphasis">
                {allTermsUsed ? (
                  <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                )}
                {sourceTermsHint(
                  t,
                  termCounts,
                  destinationLanguage?.languageName || destinationLanguageCode,
                )}
              </p>
            )}
          </div>
          <DialogDescription
            ref={sourceRef}
            className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/40 px-3 py-2.5 text-left text-sm leading-7 text-high-emphasis"
          >
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
          {canAddSelectionToGlossary && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit gap-1"
              // Keeps the text selected while clicking.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setAddTermName(sourceSelection)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("EDIT_TRANSLATION.ADD_TO_GLOSSARY")}
            </Button>
          )}
        </section>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor="destinationLanguageText"
              className="text-sm font-medium text-high-emphasis"
            >
              {t("EDIT_TRANSLATION.TRANSLATION_LABEL", { language: destinationLanguage?.languageName ?? "" })}
            </Label>
            <div className="flex shrink-0 items-center gap-2">
              {canInsertTerm && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  aria-label={t("EDIT_TRANSLATION.INSERT_GLOSSARY")}
                  aria-keyshortcuts="Alt+Shift+G"
                  title={getGlossaryTermMenuHint()}
                  onClick={() => setTermMenuOpen(true)}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden whitespace-nowrap sm:inline">
                    {t("EDIT_TRANSLATION.INSERT_GLOSSARY")}
                  </span>
                  <kbd
                    aria-hidden="true"
                    className="hidden rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] font-medium leading-none text-low-emphasis sm:inline"
                  >
                    {termShortcut.keys}
                  </kbd>
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                aria-label={t("EDIT_TRANSLATION.AUTO_TRANSLATE")}
                disabled={isAutoTranslateLoading || destinationLanguage?.isDefault}
                onClick={autoTranslate}
              >
                {isAutoTranslateLoading ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Wand className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span className="hidden whitespace-nowrap sm:inline">
                  {isAutoTranslateLoading
                    ? t("EDIT_TRANSLATION.TRANSLATING")
                    : t("EDIT_TRANSLATION.AUTO_TRANSLATE")}
                </span>
              </Button>
            </div>
          </div>
          <GlossaryTermMenu
            open={termMenuOpen}
            onOpenChange={setTermMenuOpen}
            matches={highlightMatches}
            targetLanguage={{
              languageCode: destinationLanguageCode,
              languageName: destinationLanguage?.languageName ?? "",
            }}
            targetText={translation}
            onInsert={insert}
            onReturnFocus={() => targetRef.current?.focus()}
          >
            <Textarea
              id="destinationLanguageText"
              className="border-default min-h-[116px] border shadow-none"
              placeholder={t("EDIT_TRANSLATION.PLACEHOLDER")}
              value={translation}
              {...targetBinding}
              ref={(element) => {
                targetRef.current = element;
                targetBinding.ref(element);
              }}
              aria-describedby={canInsertTerm ? "glossary-term-menu-hint" : undefined}
              onKeyDown={(event) => {
                if (destinationLanguage?.isDefault || !isGlossaryTermMenuShortcut(event)) return;
                event.preventDefault();
                setTermMenuOpen(true);
              }}
              onChange={(e) => editTranslation(e.target.value)}
            />
          </GlossaryTermMenu>
          {canInsertTerm && (
            <p id="glossary-term-menu-hint" className="sr-only">
              {getGlossaryTermMenuHint()}
            </p>
          )}
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
      <GlossaryEditorSheet
        open={addTermName !== undefined}
        onOpenChange={(open) => {
          if (!open) setAddTermName(undefined);
        }}
        initialName={addTermName}
      />
      <DialogFooter className="gap-2 sm:gap-2">
        <DialogClose asChild>
          <Button variant="outline" size="default">
            {t("common:CANCEL")}
          </Button>
        </DialogClose>
        <Button size="default" disabled={isPending || !translation} onClick={handleSave}>
          {isPending ? t("EDIT_TRANSLATION.SAVING") : t("common:SAVE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

export default EditTranslation;
