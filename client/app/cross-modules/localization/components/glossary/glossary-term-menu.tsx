import { KeyboardEvent, ReactElement } from "react";
import { Check } from "lucide-react";
import { type TFunction, useT } from "@seliseblocks/genesis-os/i18n";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui-kits/popover/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import {
  getGlossaryTermValue,
  isGlossaryMatchUsed,
  TermTargetLanguage,
} from "@blocks-localization/components/glossary/glossary-term-popover";
import { distinctGlossaryMatches } from "@blocks-localization/components/glossary/highlighted-source-text";

const isApplePlatform = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);

/** The shortcut in the platform's own terms: Option (⌥) on Apple keyboards, Alt elsewhere. */
export const getGlossaryTermMenuShortcut = () =>
  isApplePlatform()
    ? { keys: "⌥⇧G", label: "Option+Shift+G" }
    : { keys: "Alt+Shift+G", label: "Alt+Shift+G" };

export const getGlossaryTermMenuHint = (t: TFunction) =>
  t("GLOSSARY_TERM_MENU.SHORTCUT_HINT", { shortcut: getGlossaryTermMenuShortcut().label });

/**
 * True for Alt+Shift+G (Option+Shift+G on macOS). Reads `code`, not `key`: on macOS
 * Option+Shift+G types "˝".
 */
export const isGlossaryTermMenuShortcut = (event: KeyboardEvent<HTMLElement>) =>
  event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === "KeyG";

export interface GlossaryTermMenuItem {
  glossaryId: string;
  name: string;
  /** The wording in the source, replaced by the value if it is left in the target. */
  surface: string;
  /** What Enter inserts; undefined when a Translate term has no value for the culture. */
  value?: string;
  /** The target text already has the value: listed as done, not insertable again. */
  used: boolean;
}

/**
 * One entry per matched term, by rule (Phase 4): Translate → the target value (disabled when
 * missing), Keep → the source surface, Forbidden → not listed.
 */
export const getGlossaryTermMenuItems = (
  matches: GlossaryMatch[],
  targetCulture: string,
  targetText = "",
): GlossaryTermMenuItem[] =>
  distinctGlossaryMatches(matches).flatMap((match): GlossaryTermMenuItem[] => {
    const term = getGlossaryTermValue(match.meta, match.surface, targetCulture);
    const item = {
      glossaryId: match.glossary.itemId,
      name: match.glossary.name || match.surface,
      surface: match.surface,
    };
    switch (term.kind) {
      case "translate":
      case "keep":
        return [
          {
            ...item,
            value: term.value,
            used: isGlossaryMatchUsed(match, targetText, targetCulture),
          },
        ];
      case "missing":
        return [{ ...item, used: false }];
      default:
        return [];
    }
  });

/** True when some glossary has wording for the culture that the target text does not use yet. */
export const hasInsertableGlossaryTerms = (
  matches: GlossaryMatch[],
  targetCulture: string,
  targetText = "",
) =>
  getGlossaryTermMenuItems(matches, targetCulture, targetText).some(
    (item) => !!item.value && !item.used,
  );

interface GlossaryTermMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: GlossaryMatch[];
  targetLanguage: TermTargetLanguage;
  /** The current target text: glossaries it already uses are listed as done. */
  targetText: string;
  onInsert: (value: string, replacing?: string) => void;
  /** Called on close without inserting, so focus goes back to the field (Escape). */
  onReturnFocus: () => void;
  children: ReactElement;
}

const GlossaryTermMenu = ({
  open,
  onOpenChange,
  matches,
  targetLanguage,
  targetText,
  onInsert,
  onReturnFocus,
  children,
}: Readonly<GlossaryTermMenuProps>) => {
  const { t } = useT("localization.glossary");
  const items = getGlossaryTermMenuItems(matches, targetLanguage.languageCode, targetText);
  const toInsert = items.filter((item) => !item.used);
  const used = items.filter((item) => item.used);
  const languageName = targetLanguage.languageName || targetLanguage.languageCode;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      <PopoverContent
        // Inside a dialog: a portalled popover would sit outside its focus trap.
        portalled={false}
        align="start"
        className="z-60 w-80 p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onReturnFocus();
        }}
      >
        <Command aria-label={t("GLOSSARY_TERM_MENU.ARIA_LABEL")}>
          <CommandInput placeholder={t("GLOSSARY_TERM_MENU.SEARCH")} />
          <CommandList>
            <CommandEmpty>
              {items.length === 0
                ? t("GLOSSARY_TERM_MENU.NONE_IN_SOURCE")
                : t("GLOSSARY_TERM_MENU.NO_MATCH")}
            </CommandEmpty>
            {toInsert.length > 0 && (
              <CommandGroup heading={t("GLOSSARY_TERM_MENU.INSERT_IN", { language: languageName })}>
                {toInsert.map((item) => (
                  <CommandItem
                    key={item.glossaryId}
                    value={`${item.name} ${item.value ?? ""}`}
                    disabled={!item.value}
                    onSelect={() => {
                      if (!item.value) return;
                      onOpenChange(false);
                      onInsert(item.value, item.surface);
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                    <span aria-hidden="true" className="text-low-emphasis">
                      →
                    </span>
                    <span className="truncate font-medium">
                      {item.value ??
                        t("GLOSSARY_TERM_MENU.NO_TRANSLATION", { language: languageName })}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {used.length > 0 && (
              <CommandGroup heading={t("GLOSSARY_TERM_MENU.ALREADY_USED")}>
                {used.map((item) => (
                  <CommandItem
                    key={item.glossaryId}
                    value={`${item.name} ${item.value ?? ""}`}
                    // Inserting it again would only duplicate it.
                    disabled
                  >
                    <span className="truncate">{item.name}</span>
                    <span aria-hidden="true" className="text-low-emphasis">
                      →
                    </span>
                    <span className="truncate">{item.value}</span>
                    <Check className="ml-auto h-3.5 w-3.5 text-success" aria-hidden="true" />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default GlossaryTermMenu;
