import { memo, useRef, useState } from "react";
import { EllipsisVertical, Languages, Plus, Trash, Wand } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import type {
  IBlocksLanguageKey,
  ILanguageConfig,
  IModuleGets,
} from "@blocks-localization/models/language";
import { GlossaryTargetChecklist } from "@blocks-localization/components/glossary/glossary-target-checklist";
import GlossaryEditorSheet from "@blocks-localization/components/modals/glossary/glossary-editor-sheet";
import { useSourceTextSelection } from "@blocks-localization/hooks/use-source-text-selection";
import { isMatchedGlossaryName } from "@blocks-localization/utils/glossary-name";
import { useInlineKeyEditor } from "../hooks/use-inline-key-editor";
import { useT } from "@seliseblocks/genesis-os/i18n";

interface KeyActionsMenuProps {
  actionLabel: string;
  onDelete: () => void;
  onTranslate: () => void;
}

const KeyActionsMenu = memo(({ actionLabel, onDelete, onTranslate }: KeyActionsMenuProps) => {
  const { t } = useT("localization.language-table");
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 w-9 p-0 text-medium-emphasis hover:text-high-emphasis"
          aria-label={actionLabel}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <EllipsisVertical width={20} height={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={(event) => {
            event.stopPropagation();
            onTranslate();
          }}
        >
          <Languages className="mr-2 h-4 w-4" />
          <span>{t("INLINE_KEY_DETAILS.TRANSLATE")}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-error focus:bg-blocks-error-50 focus:text-error"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <Trash className="mr-2 h-4 w-4" />
          <span>{t("common:DELETE")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
KeyActionsMenu.displayName = "KeyActionsMenu";

interface InlineKeyDetailsProps {
  keyDetails: IBlocksLanguageKey;
  languageListData: ILanguageConfig[];
  languageModules: Pick<IModuleGets, "itemId" | "moduleName">[];
  onTranslate: () => void;
  onDelete: () => void;
}

export const InlineKeyDetails = memo(
  ({
    keyDetails,
    languageListData,
    languageModules,
    onTranslate,
    onDelete,
  }: InlineKeyDetailsProps) => {
    const { t } = useT("localization.language-table");
    const moduleName = languageModules.find(
      (languageModule) => languageModule.itemId === keyDetails.moduleId,
    )?.moduleName;
    const {
      applyLiveFix,
      autoTranslate,
      discardChanges,
      draftTranslations,
      fixViolation,
      getGlossaryRow,
      hasChanges,
      hasEmptyChange,
      isAutoTranslating,
      isSaving,
      saveChanges,
      setTranslation,
      sortedLanguages,
      sourceMatches,
    } = useInlineKeyEditor(keyDetails, languageListData);
    const sourceRef = useRef<HTMLTextAreaElement>(null);
    const sourceSelection = useSourceTextSelection(sourceRef);
    // Text that already is a glossary has nothing to add.
    const canAddSelectionToGlossary =
      !!sourceSelection && !isMatchedGlossaryName(sourceSelection, sourceMatches);
    const [addTermName, setAddTermName] = useState<string | undefined>(undefined);

    return (
      <div className="space-y-5 px-4 py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="col-start-1 row-start-1 min-w-0">
            <p className="text-xs font-medium text-low-emphasis">
              {t("INLINE_KEY_DETAILS.MODULE")}
            </p>
            <p className="mt-1 truncate text-sm text-high-emphasis">{moduleName || "-"}</p>
          </div>
          <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <p className="text-xs font-medium text-low-emphasis">
              {t("INLINE_KEY_DETAILS.CONTEXT")}
            </p>
            <p
              className="mt-1 truncate text-sm text-high-emphasis"
              title={keyDetails.context || t("INLINE_KEY_DETAILS.NO_CONTEXT")}
            >
              {keyDetails.context || t("INLINE_KEY_DETAILS.NO_CONTEXT")}
            </p>
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-end self-start lg:col-start-3 lg:self-end">
            <KeyActionsMenu
              actionLabel={t("INLINE_KEY_DETAILS.ACTIONS_FOR", { name: keyDetails.keyName })}
              onTranslate={onTranslate}
              onDelete={onDelete}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-low-emphasis">
            {t("INLINE_KEY_DETAILS.TRANSLATIONS")}
          </p>
          <TooltipProvider delayDuration={300}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedLanguages.map((language) => {
                const glossaryRow = getGlossaryRow(language.languageCode);
                const isRowTranslating = isAutoTranslating(language.languageCode);
                return (
                  <div key={language.languageCode} className="min-w-0">
                    <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2">
                      <label
                        htmlFor={`translation-${keyDetails.itemId}-${language.languageCode}`}
                        className="truncate text-xs font-medium text-medium-emphasis"
                      >
                        {language.languageName}
                        {language.isDefault ? ` ${t("INLINE_KEY_DETAILS.DEFAULT_SUFFIX")}` : ""}
                      </label>
                      {!language.isDefault && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 w-8 shrink-0 p-0"
                              aria-label={t("INLINE_KEY_DETAILS.AUTO_TRANSLATE_LANGUAGE", {
                                language: language.languageName,
                              })}
                              disabled={isRowTranslating}
                              onClick={(event) => {
                                event.stopPropagation();
                                void autoTranslate(language.languageCode);
                              }}
                            >
                              <Wand className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{t("INLINE_KEY_DETAILS.AUTO_TRANSLATE")}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <Textarea
                      id={`translation-${keyDetails.itemId}-${language.languageCode}`}
                      aria-label={t("INLINE_KEY_DETAILS.LANGUAGE_TRANSLATION", {
                        language: language.languageName,
                      })}
                      className="min-h-[96px] resize-y border-border bg-background text-high-emphasis caret-primary shadow-none placeholder:text-low-emphasis focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                      placeholder={t("INLINE_KEY_DETAILS.ENTER_TRANSLATION")}
                      value={draftTranslations[language.languageCode] ?? ""}
                      onChange={(event) =>
                        setTranslation(language.languageCode, event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      ref={language.isDefault ? sourceRef : undefined}
                    />
                    {language.isDefault && canAddSelectionToGlossary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 w-fit gap-1"
                        // Keeps the text selected while clicking.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          setAddTermName(sourceSelection);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        {t("localization.keys:EDIT_TRANSLATION.ADD_TO_GLOSSARY")}
                      </Button>
                    )}
                    {!language.isDefault && (
                      <GlossaryTargetChecklist
                        row={glossaryRow}
                        targetText={draftTranslations[language.languageCode] ?? ""}
                        targetCulture={language.languageCode}
                        languageName={language.languageName}
                        liveMatches={sourceMatches}
                        disabled={isRowTranslating}
                        onSuggestionFix={(violation) =>
                          fixViolation(language.languageCode, violation)
                        }
                        onRetry={() => void autoTranslate(language.languageCode)}
                        onLiveFix={(fixed) => applyLiveFix(language.languageCode, fixed)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </div>

        {/* React events from the portalled sheet would bubble here; keep them away from the row. */}
        <GlossaryEditorSheet
          open={addTermName !== undefined}
          onOpenChange={(open) => {
            if (!open) setAddTermName(undefined);
          }}
          initialName={addTermName}
          isolateEvents
        />

        <div className="sticky left-4 flex w-[calc(100cqw-2rem)] flex-col-reverse gap-2 border-t border-blocks-primary-50 pt-4 dark:border-blocks-primary-100 sm:flex-row sm:items-center sm:justify-end">
          {hasEmptyChange && (
            <p role="alert" className="mr-auto text-xs text-error">
              {t("INLINE_KEY_DETAILS.CHANGED_EMPTY")}
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasChanges || isSaving}
            onClick={(event) => {
              event.stopPropagation();
              discardChanges();
            }}
          >
            {t("INLINE_KEY_DETAILS.DISCARD")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!hasChanges || hasEmptyChange || isSaving}
            onClick={(event) => {
              event.stopPropagation();
              void saveChanges();
            }}
          >
            {isSaving ? t("INLINE_KEY_DETAILS.SAVING") : t("common:SAVE_CHANGES")}
          </Button>
        </div>
      </div>
    );
  },
);
InlineKeyDetails.displayName = "InlineKeyDetails";
