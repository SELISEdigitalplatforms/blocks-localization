import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, LoaderCircle, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui-kits/command/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { toast } from "@/hooks/use-toast";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryTranslationChips from "@blocks-localization/components/glossary/glossary-translation-chips";
import GlossaryEditorSheet from "@blocks-localization/components/modals/glossary/glossary-editor-sheet";
import {
  useGetLanguages,
  useResolveGlossariesByIds,
  useSearchGlossaries,
} from "@blocks-localization/hooks/use-language-manager";
import { useDebouncedValue } from "@blocks-localization/hooks/use-live-glossary-check";
import { IGlossary, ILanguageConfig } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { parseGlossaryMeta } from "@blocks-localization/utils/glossary-meta";

export const PICKER_SEARCH_DEBOUNCE_MS = 300;
const NO_RESULTS: IGlossary[] = [];
export const CREATED_NOT_FOUND_MESSAGE =
  "Term created, but it couldn't be selected. Search for it.";

/**
 * `Glossary/Save` returns no id (A3): the new term is the search result whose name equals
 * the trimmed name exactly (case-sensitive); the latest `createDate` wins among several.
 */
export const pickCreatedGlossary = (
  items: IGlossary[] | undefined,
  name: string,
): IGlossary | undefined => {
  const trimmed = name.trim();
  const exact = (items ?? []).filter((item) => item.name === trimmed);
  const time = (item: IGlossary) => {
    const value = Date.parse(item.createDate ?? "");
    return Number.isNaN(value) ? 0 : value;
  };
  return exact.reduce<IGlossary | undefined>(
    (latest, item) => (!latest || time(item) > time(latest) ? item : latest),
    undefined,
  );
};

const GlossaryResultRow = ({
  glossary,
  languages,
  selected,
}: Readonly<{
  glossary: IGlossary;
  languages: ILanguageConfig[] | undefined;
  selected: boolean;
}>) => {
  const parsed = parseGlossaryMeta(glossary.additionalNote ?? "");
  const unsupported = parsed.status === "unsupported-version";
  return (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium text-high-emphasis">{glossary.name}</span>
          {unsupported ? (
            <span className="text-xs text-medium-emphasis">—</span>
          ) : (
            <GlossaryRuleBadge rule={parsed.meta.rule} />
          )}
        </div>
        {!unsupported && (
          <div className="text-xs">
            <GlossaryTranslationChips meta={parsed.meta} languages={languages} max={3} />
          </div>
        )}
      </div>
      <Check
        className={selected ? "mt-0.5 h-4 w-4 shrink-0" : "mt-0.5 h-4 w-4 shrink-0 opacity-0"}
        aria-hidden="true"
      />
    </div>
  );
};

interface SelectedChipProps {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onRemove: () => void;
}

const SelectedChip = ({ label, loading = false, disabled, onRemove }: SelectedChipProps) => (
  <Badge variant="secondary" className="max-w-full gap-1 pr-1">
    {loading ? (
      <Skeleton className="h-3 w-16" aria-label="Loading glossary" />
    ) : (
      <span className="truncate">{label}</span>
    )}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-5 w-5 shrink-0 rounded-full p-0 hover:bg-muted-foreground/20"
      aria-label={`Remove ${label}`}
      disabled={disabled}
      onClick={onRemove}
    >
      <X className="h-3 w-3" aria-hidden="true" />
    </Button>
  </Badge>
);

interface GlossaryPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Offers "Create "<query>"" when the search finds nothing. */
  allowCreate?: boolean;
  disabled?: boolean;
  /** Glossaries the caller already has (seed, resolved tags): names without a request. */
  knownGlossaries?: IGlossary[];
}

/**
 * Search-and-select for tagging glossaries to a module or a key. Selected chips always
 * render: names come from known glossaries or the search, otherwise from `Glossary/Get`.
 */
const GlossaryPicker = ({
  selectedIds,
  onChange,
  allowCreate = false,
  disabled = false,
  knownGlossaries,
}: Readonly<GlossaryPickerProps>) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  // Glossaries picked in this session (search results, created or duplicate terms).
  const [picked, setPicked] = useState<Record<string, IGlossary>>({});
  const inputRef = useRef<HTMLInputElement>(null);
  // The create lookup resolves after the sheet closed: it must add to the current selection.
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  const searchText = useDebouncedValue(query.trim(), PICKER_SEARCH_DEBOUNCE_MS);
  // One query per text: a stale response lands under its own key and is never shown (C10).
  const {
    data: searchResults,
    isLoading: isSearching,
    isError: isSearchError,
  } = useSearchGlossaries(searchText, open);
  const { data: languages } = useGetLanguages();
  const results = searchResults?.items ?? NO_RESULTS;

  const known = useMemo(() => {
    const byId = new Map<string, IGlossary>();
    for (const glossary of [...(knownGlossaries ?? []), ...Object.values(picked), ...results]) {
      byId.set(glossary.itemId, glossary);
    }
    return byId;
  }, [knownGlossaries, picked, results]);

  const unresolvedIds = useMemo(
    () => selectedIds.filter((id) => !known.has(id)),
    [selectedIds, known],
  );
  const resolution = useResolveGlossariesByIds(unresolvedIds, unresolvedIds.length > 0);
  const resolvedById = new Map(
    resolution.glossaries.map((glossary) => [glossary.itemId, glossary]),
  );
  const failedIds = new Set(resolution.failedIds);

  const select = (glossary: IGlossary) => {
    const current = selectedIdsRef.current;
    setPicked((previous) => ({ ...previous, [glossary.itemId]: glossary }));
    if (!current.includes(glossary.itemId)) {
      selectedIdsRef.current = [...current, glossary.itemId];
      onChange(selectedIdsRef.current);
    }
  };

  const toggle = (glossary: IGlossary) => {
    if (selectedIds.includes(glossary.itemId)) {
      onChange(selectedIds.filter((id) => id !== glossary.itemId));
      return;
    }
    select(glossary);
  };

  const remove = (id: string) => onChange(selectedIds.filter((selectedId) => selectedId !== id));

  const startCreate = () => {
    setCreateName(query.trim());
    setOpen(false);
    setSheetOpen(true);
  };

  /** Finds the new term by name (C19): the selection stays unchanged when it isn't found. */
  const selectCreated = async (savedName: string) => {
    try {
      const page = await languageManagerService.fetchGlossaries({
        pageNumber: 0,
        pageSize: 10,
        searchText: savedName,
      });
      const created = pickCreatedGlossary(page?.items, savedName);
      if (created) {
        select(created);
        return;
      }
    } catch {
      // Reported below like a missing result.
    }
    toast({ variant: "destructive", title: "Error", description: CREATED_NOT_FOUND_MESSAGE });
  };

  const chipLabel = (id: string) =>
    known.get(id)?.name ??
    resolvedById.get(id)?.name ??
    (failedIds.has(id) ? "Unknown glossary" : "");

  const renderResults = () => {
    if (isSearchError) {
      return (
        <p className="px-3 py-6 text-center text-sm text-error">Couldn&apos;t search glossaries</p>
      );
    }
    if (isSearching) {
      return (
        <div
          role="status"
          className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-medium-emphasis"
        >
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Searching…
        </div>
      );
    }
    return (
      <>
        <CommandEmpty className="px-3 py-4 text-center text-sm">
          {allowCreate && query.trim() ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={startCreate}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate">Create &quot;{query.trim()}&quot;</span>
            </Button>
          ) : (
            "No glossary found."
          )}
        </CommandEmpty>
        <CommandGroup>
          {results.map((glossary) => (
            <CommandItem
              key={glossary.itemId}
              value={glossary.itemId}
              onSelect={() => toggle(glossary)}
            >
              <GlossaryResultRow
                glossary={glossary}
                languages={languages}
                selected={selectedIds.includes(glossary.itemId)}
              />
            </CommandItem>
          ))}
        </CommandGroup>
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const label = chipLabel(id);
            return (
              <SelectedChip
                key={id}
                label={label || "glossary"}
                loading={!label}
                disabled={disabled}
                onRemove={() => remove(id)}
              />
            );
          })}
        </div>
      )}

      {/* A plain wrapper, so the gap doesn't shift the fields below when the popover opens. */}
      <div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between font-normal"
              disabled={disabled}
            >
              Search glossary...
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="z-60 w-[min(420px,calc(100vw-2rem))] min-w-0 p-0"
            align="start"
            portalled={false}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <Command shouldFilter={false}>
              <CommandInput
                ref={inputRef}
                placeholder="Search glossary..."
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>{renderResults()}</CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {allowCreate && (
        <GlossaryEditorSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          initialName={createName}
          onSaved={(savedName) => void selectCreated(savedName)}
          onSelectExisting={select}
          onCloseAutoFocus={(event) => {
            // No trigger in picker mode: reopen the search, which focuses its input.
            event.preventDefault();
            setOpen(true);
          }}
        />
      )}
    </div>
  );
};

export default GlossaryPicker;
