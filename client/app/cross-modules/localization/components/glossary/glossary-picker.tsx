import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, CircleHelp, LoaderCircle, Plus, Search, X } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os/i18n";

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
import { cn } from "@/lib/utils";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryEditorSheet from "@blocks-localization/components/modals/glossary/glossary-editor-sheet";
import {
  useResolveGlossariesByIds,
  useSearchGlossaries,
} from "@blocks-localization/hooks/use-language-manager";
import { useDebouncedValue } from "@blocks-localization/hooks/use-live-glossary-check";
import { IGlossary } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import {
  isUnsupportedGlossaryNote,
  toGlossaryMeta,
} from "@blocks-localization/utils/glossary-display";

export const PICKER_SEARCH_DEBOUNCE_MS = 300;
const NO_RESULTS: IGlossary[] = [];

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
  selected,
}: Readonly<{
  glossary: IGlossary;
  selected: boolean;
}>) => {
  const unsupported = isUnsupportedGlossaryNote(glossary);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="min-w-0 flex-1 truncate font-medium text-high-emphasis">
        {glossary.name}
      </span>
      {unsupported ? (
        <span className="text-xs text-medium-emphasis">—</span>
      ) : (
        <GlossaryRuleBadge rule={toGlossaryMeta(glossary).rule} />
      )}
      <Check
        className={cn("h-4 w-4 shrink-0 text-primary", !selected && "opacity-0")}
        aria-hidden="true"
      />
    </div>
  );
};

interface SelectedChipProps {
  label: string;
  loading?: boolean;
  /** The id couldn't be resolved (C7): still removable, but visibly not a real name. */
  unresolved?: boolean;
  disabled?: boolean;
  onRemove: () => void;
}

const SelectedChip = ({
  label,
  loading = false,
  unresolved = false,
  disabled,
  onRemove,
}: SelectedChipProps) => {
  const { t } = useT("localization.glossary");
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-7 max-w-full gap-1 rounded-full py-0 pl-2.5 pr-1 font-medium",
        unresolved &&
          "border-dashed border-border-medium-emphasis bg-transparent text-medium-emphasis",
      )}
    >
      {unresolved && <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {loading ? (
        <Skeleton className="h-3 w-16" aria-label={t("GLOSSARY_PICKER.LOADING_GLOSSARY")} />
      ) : (
        <span className="truncate">{label}</span>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-5 w-5 shrink-0 rounded-full p-0 hover:bg-muted-foreground/20"
        aria-label={t("GLOSSARY_PICKER.REMOVE", { label })}
        disabled={disabled}
        onClick={onRemove}
      >
        <X className="h-3 w-3" aria-hidden="true" />
      </Button>
    </Badge>
  );
};

interface GlossaryPickerProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  allowCreate?: boolean;
  disabled?: boolean;
  /** Glossaries the caller already has (seed, resolved tags): names without a request. */
  knownGlossaries?: IGlossary[];
}

const GlossaryPicker = ({
  selectedIds,
  onChange,
  allowCreate = false,
  disabled = false,
  knownGlossaries,
}: Readonly<GlossaryPickerProps>) => {
  const { t } = useT("localization.glossary");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [createName, setCreateName] = useState("");
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
    refetch: retrySearch,
  } = useSearchGlossaries(searchText, open);
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
    toast({
      variant: "destructive",
      title: t("common:ERROR"),
      description: t("GLOSSARY_PICKER.CREATED_NOT_FOUND"),
    });
  };

  const chipLabel = (id: string) =>
    known.get(id)?.name ??
    resolvedById.get(id)?.name ??
    (failedIds.has(id) ? t("GLOSSARY_PICKER.UNKNOWN_GLOSSARY") : "");

  const trimmedQuery = query.trim();
  // Create stays reachable when the search only finds near matches ("Work" → "Workspace").
  // The sheet's duplicate check covers case variants of an existing name (H15).
  const canCreate =
    allowCreate &&
    !!trimmedQuery &&
    !results.some((glossary) => glossary.name.toLowerCase() === trimmedQuery.toLowerCase());

  const renderResults = () => {
    if (isSearchError) {
      return (
        <div role="alert" className="flex flex-col items-center gap-2 px-3 py-6 text-center">
          <p className="text-sm text-error">{t("GLOSSARY_PICKER.SEARCH_FAILED")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void retrySearch()}>
            {t("GLOSSARY_PICKER.TRY_AGAIN")}
          </Button>
        </div>
      );
    }
    if (isSearching) {
      return (
        <output className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-medium-emphasis">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          {t("GLOSSARY_PICKER.SEARCHING")}
        </output>
      );
    }
    return (
      <>
        <CommandEmpty className="px-3 py-6 text-center text-sm text-medium-emphasis">
          {trimmedQuery
            ? t("GLOSSARY_PICKER.NO_MATCH", { query: trimmedQuery })
            : t("GLOSSARY_PICKER.NO_TERMS")}
        </CommandEmpty>
        {results.length > 0 && (
          <CommandGroup>
            {results.map((glossary) => (
              <CommandItem
                key={glossary.itemId}
                value={glossary.itemId}
                className="py-2"
                onSelect={() => toggle(glossary)}
              >
                <GlossaryResultRow
                  glossary={glossary}
                  selected={selectedIds.includes(glossary.itemId)}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {canCreate && (
          <CommandGroup className={results.length > 0 ? "border-t border-border" : undefined}>
            <CommandItem
              value={`create:${trimmedQuery}`}
              className="gap-2 py-2 text-primary"
              onSelect={startCreate}
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {t("GLOSSARY_PICKER.CREATE", { query: trimmedQuery })}
              </span>
            </CommandItem>
          </CommandGroup>
        )}
      </>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.length > 0 && (
        <div className="grid gap-2">
          <p className="text-xs font-medium text-medium-emphasis">
            {t("GLOSSARY_PICKER.SELECTED", { count: selectedIds.length })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedIds.map((id) => {
              const label = chipLabel(id);
              return (
                <SelectedChip
                  key={id}
                  label={label || t("GLOSSARY_PICKER.FALLBACK_LABEL")}
                  loading={!label}
                  unresolved={failedIds.has(id) && !known.has(id) && !resolvedById.has(id)}
                  disabled={disabled}
                  onRemove={() => remove(id)}
                />
              );
            })}
          </div>
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
              className="w-full justify-start gap-2 font-normal text-low-emphasis"
              disabled={disabled}
            >
              <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">
                {allowCreate
                  ? t("GLOSSARY_PICKER.SEARCH_OR_CREATE")
                  : t("GLOSSARY_PICKER.SEARCH_TERMS")}
              </span>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
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
                placeholder={t("GLOSSARY_PICKER.SEARCH_PLACEHOLDER")}
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
