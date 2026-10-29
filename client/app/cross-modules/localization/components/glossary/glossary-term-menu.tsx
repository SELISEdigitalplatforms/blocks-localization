import { KeyboardEvent, ReactElement } from "react";
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
  TermTargetLanguage,
} from "@blocks-localization/components/glossary/glossary-term-popover";
import { distinctGlossaryMatches } from "@blocks-localization/components/glossary/highlighted-source-text";

export const GLOSSARY_TERM_MENU_HINT = "Press Alt+Shift+G to insert a glossary term.";

/**
 * True for Alt+Shift+G. Reads `code`, not `key`: on macOS Option+Shift+G types "˝".
 */
export const isGlossaryTermMenuShortcut = (event: KeyboardEvent<HTMLElement>) =>
  event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey && event.code === "KeyG";

export interface GlossaryTermMenuItem {
  glossaryId: string;
  name: string;
  /** What Enter inserts; undefined when a Translate term has no value for the culture. */
  value?: string;
}

/**
 * One entry per matched term, by rule (Phase 4): Translate → the target value (disabled when
 * missing), Keep → the source surface, Forbidden → not listed.
 */
export const getGlossaryTermMenuItems = (
  matches: GlossaryMatch[],
  targetCulture: string,
): GlossaryTermMenuItem[] =>
  distinctGlossaryMatches(matches).flatMap((match) => {
    const term = getGlossaryTermValue(match.meta, match.surface, targetCulture);
    const name = match.glossary.name || match.surface;
    switch (term.kind) {
      case "translate":
      case "keep":
        return [{ glossaryId: match.glossary.itemId, name, value: term.value }];
      case "missing":
        return [{ glossaryId: match.glossary.itemId, name }];
      default:
        return [];
    }
  });

interface GlossaryTermMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matches: GlossaryMatch[];
  targetLanguage: TermTargetLanguage;
  onInsert: (value: string) => void;
  /** Called on close without inserting, so focus goes back to the field (Escape). */
  onReturnFocus: () => void;
  /** The target field the menu is anchored to. */
  children: ReactElement;
}

/** Alt+Shift+G menu of the source's glossary terms; Enter inserts at the caret (H11, C6). */
const GlossaryTermMenu = ({
  open,
  onOpenChange,
  matches,
  targetLanguage,
  onInsert,
  onReturnFocus,
  children,
}: Readonly<GlossaryTermMenuProps>) => {
  const items = getGlossaryTermMenuItems(matches, targetLanguage.languageCode);
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
        <Command aria-label="Insert glossary term">
          <CommandInput placeholder="Search glossary terms..." />
          <CommandList>
            <CommandEmpty>
              {items.length === 0 ? "No glossary terms in the source" : "No matching terms"}
            </CommandEmpty>
            {items.length > 0 && (
              <CommandGroup heading={`Insert in ${languageName}`}>
                {items.map((item) => (
                  <CommandItem
                    key={item.glossaryId}
                    value={`${item.name} ${item.value ?? ""}`}
                    disabled={!item.value}
                    onSelect={() => {
                      if (!item.value) return;
                      onOpenChange(false);
                      onInsert(item.value);
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                    <span aria-hidden="true" className="text-low-emphasis">
                      →
                    </span>
                    <span className="truncate font-medium">
                      {item.value ?? `no ${languageName} translation`}
                    </span>
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
