import { memo } from "react";
import { EllipsisVertical, Languages, Trash, Wand } from "lucide-react";
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
import { useInlineKeyEditor } from "../hooks/use-inline-key-editor";

interface KeyActionsMenuProps {
  actionLabel: string;
  onDelete: () => void;
  onTranslate: () => void;
}

const KeyActionsMenu = memo(({ actionLabel, onDelete, onTranslate }: KeyActionsMenuProps) => (
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
        <span>Translate</span>
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
        <span>Delete</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
));
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
    const moduleName = languageModules.find(
      (languageModule) => languageModule.itemId === keyDetails.moduleId,
    )?.moduleName;
    const {
      autoTranslate,
      discardChanges,
      draftTranslations,
      hasChanges,
      hasEmptyChange,
      isAutoTranslating,
      isSaving,
      saveChanges,
      setTranslation,
      sortedLanguages,
    } = useInlineKeyEditor(keyDetails, languageListData);

    return (
      <div className="space-y-5 px-4 py-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="col-start-1 row-start-1 min-w-0">
            <p className="text-xs font-medium text-low-emphasis">Module</p>
            <p className="mt-1 truncate text-sm text-high-emphasis">{moduleName || "-"}</p>
          </div>
          <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <p className="text-xs font-medium text-low-emphasis">Context</p>
            <p
              className="mt-1 truncate text-sm text-high-emphasis"
              title={keyDetails.context || "-"}
            >
              {keyDetails.context || "-"}
            </p>
          </div>
          <div className="col-start-2 row-start-1 flex items-center justify-end self-start lg:col-start-3 lg:self-end">
            <KeyActionsMenu
              actionLabel={`Actions for ${keyDetails.keyName}`}
              onTranslate={onTranslate}
              onDelete={onDelete}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-low-emphasis">Translations</p>
          <TooltipProvider delayDuration={300}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedLanguages.map((language) => (
                <div key={language.languageCode} className="min-w-0">
                  <div className="mb-1.5 flex min-h-8 items-center justify-between gap-2">
                    <label
                      htmlFor={`translation-${keyDetails.itemId}-${language.languageCode}`}
                      className="truncate text-xs font-medium text-medium-emphasis"
                    >
                      {language.languageName}
                      {language.isDefault ? " (Default)" : ""}
                    </label>
                    {!language.isDefault && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 shrink-0 p-0"
                            aria-label={`Auto-translate ${language.languageName}`}
                            disabled={isAutoTranslating}
                            onClick={(event) => {
                              event.stopPropagation();
                              void autoTranslate(language.languageCode);
                            }}
                          >
                            <Wand className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p>Auto-translate</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <Textarea
                    id={`translation-${keyDetails.itemId}-${language.languageCode}`}
                    aria-label={`${language.languageName} translation`}
                    className="min-h-[96px] resize-y border-border bg-background text-high-emphasis caret-primary shadow-none placeholder:text-low-emphasis focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                    placeholder="Enter translation"
                    value={draftTranslations[language.languageCode] ?? ""}
                    onChange={(event) => setTranslation(language.languageCode, event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                  />
                </div>
              ))}
            </div>
          </TooltipProvider>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-blocks-primary-50 pt-4 dark:border-blocks-primary-100 sm:flex-row sm:items-center sm:justify-end">
          {hasEmptyChange && (
            <p role="alert" className="mr-auto text-xs text-error">
              A changed translation cannot be empty.
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
            Discard
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
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </div>
    );
  },
);
InlineKeyDetails.displayName = "InlineKeyDetails";
