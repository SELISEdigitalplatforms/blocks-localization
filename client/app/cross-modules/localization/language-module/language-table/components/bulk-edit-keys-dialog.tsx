import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronsUpDown, Info, X } from "lucide-react";
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
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui-kits/popover/popover";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { toast } from "@/hooks/use-toast";
import {
  useGetGlossaries,
  useGetModuleGlossaries,
  useSaveBlocksLanguageKeys,
  useSearchGlossaries,
} from "@blocks-localization/hooks/use-language-manager";
import type {
  IBlocksLanguageKey,
  IGlossary,
  ILanguageConfig,
  ISaveBlocksLanguageKeyPayload,
} from "@blocks-localization/models/language";

interface BulkEditKeysDialogProps {
  keys: IBlocksLanguageKey[];
  languages: ILanguageConfig[];
  onCancel: () => void;
  onSaved: () => void;
}

export const buildBulkEditPayload = (
  keys: IBlocksLanguageKey[],
  languages: ILanguageConfig[],
  translationValue: string,
  glossaryIdsToApply: string[],
  moduleGlossaryIdsByModule: Record<string, string[]> = {},
): ISaveBlocksLanguageKeyPayload[] =>
  keys.flatMap((key) => {
    const resources = new Map(
      (key.resources ?? []).map((resource) => [resource.culture, { ...resource }]),
    );

    const shouldUpdateTranslations = translationValue.length > 0;
    const hasTranslationChange =
      shouldUpdateTranslations &&
      languages.some(
        (language) => resources.get(language.languageCode)?.value !== translationValue,
      );

    if (hasTranslationChange) {
      languages.forEach((language) => {
        resources.set(language.languageCode, {
          culture: language.languageCode,
          value: translationValue,
        });
      });
    }

    const inheritedGlossaryIds = new Set(moduleGlossaryIdsByModule[key.moduleId] ?? []);
    const currentDirectGlossaryIds = new Set(key.glossaryIds ?? []);
    const newDirectGlossaryIds = glossaryIdsToApply.filter(
      (glossaryId) =>
        !inheritedGlossaryIds.has(glossaryId) && !currentDirectGlossaryIds.has(glossaryId),
    );

    if (!hasTranslationChange && newDirectGlossaryIds.length === 0) return [];

    return [
      {
        itemId: key.itemId,
        keyName: key.keyName,
        moduleId: key.moduleId,
        resources: Array.from(resources.values()),
        routes: key.routes ?? [],
        glossaryIds: Array.from(new Set([...(key.glossaryIds ?? []), ...newDirectGlossaryIds])),
        isPartiallyTranslated: key.isPartiallyTranslated,
        context: key.context,
      },
    ];
  });

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "The selected keys could not be updated. Review the values and try again.";
};

interface KeyGlossaryAssignmentsProps {
  directGlossaryIds: string[];
  glossaryById: Map<string, IGlossary>;
  isLoadingDirectGlossaries: boolean;
  moduleId: string;
  onModuleGlossariesResolved: (moduleId: string, glossaryIds: string[]) => void;
  pendingGlossaries: IGlossary[];
}

function KeyGlossaryAssignments({
  directGlossaryIds,
  glossaryById,
  isLoadingDirectGlossaries,
  moduleId,
  onModuleGlossariesResolved,
  pendingGlossaries,
}: Readonly<KeyGlossaryAssignmentsProps>) {
  const { data: moduleGlossariesData, isLoading: isLoadingModuleGlossaries } =
    useGetModuleGlossaries(moduleId);

  useEffect(() => {
    if (!moduleGlossariesData?.items) return;
    onModuleGlossariesResolved(
      moduleId,
      moduleGlossariesData.items.map((glossary) => glossary.itemId),
    );
  }, [moduleGlossariesData?.items, moduleId, onModuleGlossariesResolved]);

  const assignments = useMemo(() => {
    const seen = new Set<string>();
    const result: { itemId: string; name: string; source: "key" | "module" | "pending" }[] = [];

    directGlossaryIds.forEach((glossaryId) => {
      seen.add(glossaryId);
      result.push({
        itemId: glossaryId,
        name: glossaryById.get(glossaryId)?.name ?? glossaryId,
        source: "key",
      });
    });

    (moduleGlossariesData?.items ?? []).forEach((glossary) => {
      if (seen.has(glossary.itemId)) return;
      seen.add(glossary.itemId);
      result.push({ itemId: glossary.itemId, name: glossary.name, source: "module" });
    });

    pendingGlossaries.forEach((glossary) => {
      if (seen.has(glossary.itemId)) return;
      seen.add(glossary.itemId);
      result.push({ itemId: glossary.itemId, name: glossary.name, source: "pending" });
    });

    return result;
  }, [directGlossaryIds, glossaryById, moduleGlossariesData?.items, pendingGlossaries]);

  const isLoading = isLoadingDirectGlossaries || isLoadingModuleGlossaries;

  if (assignments.length === 0) {
    return (
      <span className="text-sm text-low-emphasis">
        {isLoading ? "Loading glossaries..." : "No glossary assigned"}
      </span>
    );
  }

  return (
    <>
      {assignments.map((glossary) => {
        const glossaryTitle =
          glossary.source === "pending"
            ? "Will be assigned when saved"
            : glossary.source === "module"
              ? "Assigned through this key's module"
              : "Assigned directly to this key";

        return (
          <Badge
            key={glossary.itemId}
            variant={glossary.source === "pending" ? "secondary" : "outline"}
            className="font-normal"
            title={glossaryTitle}
          >
            {glossary.name}
          </Badge>
        );
      })}
      {isLoading && <span className="text-xs text-low-emphasis">Loading glossaries...</span>}
    </>
  );
}

export function BulkEditKeysDialog({
  keys,
  languages,
  onCancel,
  onSaved,
}: Readonly<BulkEditKeysDialogProps>) {
  const [translationValue, setTranslationValue] = useState("");
  const [searchText, setSearchText] = useState("");
  const [isGlossaryPickerOpen, setIsGlossaryPickerOpen] = useState(false);
  const [glossariesToApply, setGlossariesToApply] = useState<IGlossary[]>([]);
  const [moduleGlossaryIdsByModule, setModuleGlossaryIdsByModule] = useState<
    Record<string, string[]>
  >({});
  const { data: glossaryData, isLoading: isLoadingGlossaries } = useGetGlossaries(0, 100);
  const { data: searchResults } = useSearchGlossaries(searchText, isGlossaryPickerOpen);
  const { isPending, mutateAsync } = useSaveBlocksLanguageKeys();

  const glossaryById = useMemo(() => {
    const glossaries = [...(glossaryData?.items ?? []), ...glossariesToApply];
    return new Map(glossaries.map((glossary) => [glossary.itemId, glossary]));
  }, [glossaryData?.items, glossariesToApply]);

  const selectedGlossaryIds = useMemo(
    () => new Set(glossariesToApply.map((glossary) => glossary.itemId)),
    [glossariesToApply],
  );
  const availableGlossaries = (searchResults?.items ?? []).filter(
    (glossary) => !selectedGlossaryIds.has(glossary.itemId),
  );
  const trimmedTranslation = translationValue.trim();
  const overwriteCount = keys.length * languages.length;
  const pendingPayload = useMemo(
    () =>
      buildBulkEditPayload(
        keys,
        languages,
        trimmedTranslation,
        glossariesToApply.map((glossary) => glossary.itemId),
        moduleGlossaryIdsByModule,
      ),
    [glossariesToApply, keys, languages, moduleGlossaryIdsByModule, trimmedTranslation],
  );
  const saveButtonLabel = `Save ${pendingPayload.length} ${pendingPayload.length === 1 ? "key" : "keys"}`;

  const handleModuleGlossariesResolved = useCallback((moduleId: string, glossaryIds: string[]) => {
    setModuleGlossaryIdsByModule((current) => {
      const existingIds = current[moduleId] ?? [];
      if (
        existingIds.length === glossaryIds.length &&
        existingIds.every((glossaryId, index) => glossaryId === glossaryIds[index])
      ) {
        return current;
      }
      return { ...current, [moduleId]: glossaryIds };
    });
  }, []);

  const addGlossary = (glossary: IGlossary) => {
    setGlossariesToApply((current) =>
      current.some((item) => item.itemId === glossary.itemId) ? current : [...current, glossary],
    );
    setSearchText("");
    setIsGlossaryPickerOpen(false);
  };

  const removeGlossary = (glossaryId: string) => {
    setGlossariesToApply((current) => current.filter((glossary) => glossary.itemId !== glossaryId));
  };

  const handleSave = async () => {
    if (pendingPayload.length === 0) return;

    try {
      const response = await mutateAsync(pendingPayload);

      if (!response?.success) {
        toast({
          variant: "destructive",
          title: "Bulk edit failed",
          description: response?.errorMessage || getErrorMessage(response),
        });
        return;
      }

      toast({
        variant: "success",
        title: "Bulk edit complete",
        description: `${pendingPayload.length} ${pendingPayload.length === 1 ? "key was" : "keys were"} updated successfully.`,
      });
      onSaved();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Bulk edit failed",
        description: getErrorMessage(error),
      });
    }
  };

  return (
    <DialogContent className="h-[calc(100dvh-1rem)] max-h-[52rem] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:h-[90dvh] sm:max-w-2xl">
      <DialogHeader className="border-b px-6 pb-5 pt-6 pr-12">
        <DialogTitle className="text-xl">
          Bulk edit {keys.length} {keys.length === 1 ? "key" : "keys"}
        </DialogTitle>
        <DialogDescription>
          Set one translation value and optionally apply glossaries to every selected key.
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="min-h-0">
        <div className="space-y-6 px-6 py-5">
          <section aria-labelledby="bulk-translation-heading" className="space-y-3">
            <div>
              <h3
                id="bulk-translation-heading"
                className="text-sm font-semibold text-high-emphasis"
              >
                Translation value (optional)
              </h3>
              <p className="mt-1 text-sm text-medium-emphasis">
                Enter a value to replace all configured languages, or leave it empty to keep current
                translations.
              </p>
            </div>
            <Textarea
              aria-label="Translation value for all selected keys"
              autoFocus
              className="min-h-28 resize-y shadow-none"
              disabled={isPending}
              maxLength={5000}
              placeholder="Enter the shared translation value"
              value={translationValue}
              onChange={(event) => setTranslationValue(event.target.value)}
            />
            {trimmedTranslation && (
              <div className="flex items-start gap-2 rounded-md bg-warning-100 px-3 py-2.5 text-sm text-high-emphasis">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-icon-warning" />
                <p>
                  Saving will overwrite {overwriteCount} translation{" "}
                  {overwriteCount === 1 ? "value" : "values"}
                  {languages.length > 0
                    ? ` across ${languages.map((language) => language.languageName).join(", ")}`
                    : ""}
                  .
                </p>
              </div>
            )}
          </section>

          <section aria-labelledby="bulk-glossary-heading" className="space-y-3 border-t pt-5">
            <div>
              <h3 id="bulk-glossary-heading" className="text-sm font-semibold text-high-emphasis">
                Apply glossaries to all keys
              </h3>
              <p className="mt-1 text-sm text-medium-emphasis">
                Existing assignments are preserved. Glossaries selected here are added to every key.
              </p>
            </div>

            {glossariesToApply.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Glossaries to apply">
                {glossariesToApply.map((glossary) => (
                  <Badge key={glossary.itemId} variant="secondary" className="gap-1 pr-1">
                    {glossary.name}
                    <button
                      type="button"
                      className="rounded-sm p-0.5 hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Remove ${glossary.name}`}
                      disabled={isPending}
                      onClick={() => removeGlossary(glossary.itemId)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <Popover open={isGlossaryPickerOpen} onOpenChange={setIsGlossaryPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-label="Search and add glossaries"
                  aria-expanded={isGlossaryPickerOpen}
                  className="w-full justify-between font-normal"
                  disabled={isPending}
                >
                  <span className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Search and add glossaries
                  </span>
                  <ChevronsUpDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
                portalled={false}
              >
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search glossaries..."
                    value={searchText}
                    onValueChange={setSearchText}
                  />
                  <CommandList>
                    <CommandEmpty>No glossary found.</CommandEmpty>
                    <CommandGroup>
                      {availableGlossaries.map((glossary) => (
                        <CommandItem
                          key={glossary.itemId}
                          value={glossary.itemId}
                          onSelect={() => addGlossary(glossary)}
                        >
                          <span className="flex-1 truncate">{glossary.name}</span>
                          {glossary.type && (
                            <span className="mr-2 text-xs text-muted-foreground">
                              {glossary.type}
                            </span>
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </section>

          <section aria-labelledby="selected-keys-heading" className="space-y-3 border-t pt-5">
            <div>
              <h3 id="selected-keys-heading" className="text-sm font-semibold text-high-emphasis">
                Selected keys and current glossaries
              </h3>
              <p className="mt-1 text-sm text-medium-emphasis">
                Review the assignments that each key already has.
              </p>
            </div>
            <div className="divide-y rounded-md border">
              {keys.map((key) => (
                <div
                  key={key.itemId}
                  className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,180px)_1fr] sm:items-start"
                >
                  <span
                    className="truncate text-sm font-medium text-high-emphasis"
                    title={key.keyName}
                  >
                    {key.keyName}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <KeyGlossaryAssignments
                      directGlossaryIds={key.glossaryIds ?? []}
                      glossaryById={glossaryById}
                      isLoadingDirectGlossaries={isLoadingGlossaries}
                      moduleId={key.moduleId}
                      onModuleGlossariesResolved={handleModuleGlossariesResolved}
                      pendingGlossaries={glossariesToApply}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </ScrollArea>

      <DialogFooter className="z-10 border-t bg-background px-6 py-4 sm:gap-2">
        <Button type="button" variant="outline" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={pendingPayload.length === 0 || isPending}
          onClick={() => void handleSave()}
        >
          {isPending ? "Saving changes..." : saveButtonLabel}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
