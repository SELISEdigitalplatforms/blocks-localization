import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { checkValidDate, formatFullDate, parseDateString } from "@/lib/utils";
import { BookOpen, Pencil, RouteIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useGetLanguageModules,
  useGetLanguages,
  useGetGlossaries,
  useGetGlossariesByIds,
  useGetGlobalGlossaries,
  useGetModuleGlossaries,
  useGetSuggestedGlossaries,
  useSaveBlocksLanguageKey,
} from "../../hooks/use-language-manager";
import { IBlocksLanguageKey } from "../../models/language";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import EditRoute from "../modals/edit-route/edit-route";
import EditTranslation from "../modals/edit-translation/edit-translation";
import EditKeyGlossary from "../modals/edit-key-glossary/edit-key-glossary";
import GlossaryTermCard, {
  mergeSourcedGlossaries,
} from "@blocks-localization/components/glossary/glossary-term-card";
import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";

const MAX_SHOWN_SUGGESTIONS = 10;

const ViewDetails = ({ keyDetails }: { keyDetails: IBlocksLanguageKey }) => {
  const { mutateAsync: saveKey } = useSaveBlocksLanguageKey();
  const { data: languageModules } = useGetLanguageModules();
  const {
    isLoading: isLanguageListLoading,
    isFetching: isLanguageListLoadingFetching,
    data: languageListData,
  } = useGetLanguages();
  const [isEditRoutesDialogOpen, setIsEditRoutesDialogOpen] = useState(false);
  const [isEditGlossaryDialogOpen, setIsEditGlossaryDialogOpen] = useState(false);
  const [editTranslationLangCode, setEditTranslationLangCode] = useState<string | null>(null);

  const [isTagging, setIsTagging] = useState(false);
  // Tags added here whose key refetch has not landed yet (M1); merged into the next save.
  const [addedGlossaryIds, setAddedGlossaryIds] = useState<string[]>([]);
  const [seenKeyGlossaryIds, setSeenKeyGlossaryIds] = useState(keyDetails.glossaryIds);
  if (seenKeyGlossaryIds !== keyDetails.glossaryIds) {
    setSeenKeyGlossaryIds(keyDetails.glossaryIds);
    const keyIds = new Set(keyDetails.glossaryIds ?? []);
    setAddedGlossaryIds((ids) => ids.filter((id) => !keyIds.has(id)));
  }

  const hasGlossaryIds = (keyDetails.glossaryIds?.length ?? 0) > 0;

  const { data: allGlossariesData } = useGetGlossaries(0, 100);
  // Server matcher over every glossary; shown whether or not the key has tags (H9).
  const { data: suggestedGlossariesData } = useGetSuggestedGlossaries(keyDetails.itemId, true);
  const { data: globalGlossariesData } = useGetGlobalGlossaries();
  const { data: moduleGlossariesData } = useGetModuleGlossaries(keyDetails.moduleId ?? "");

  const missingGlossaryIds = useMemo(() => {
    if (!hasGlossaryIds || !allGlossariesData?.items) return [];
    const loadedIds = new Set(allGlossariesData.items.map((g) => g.itemId));
    return (keyDetails.glossaryIds ?? []).filter((id) => !loadedIds.has(id));
  }, [hasGlossaryIds, allGlossariesData, keyDetails.glossaryIds]);
  const missingGlossaries = useGetGlossariesByIds(
    missingGlossaryIds,
    missingGlossaryIds.length > 0,
  );

  const resolvedGlossaries = useMemo(() => {
    if (!hasGlossaryIds || !allGlossariesData?.items) return [];
    const fromFirstPage = allGlossariesData.items.filter((g) =>
      keyDetails.glossaryIds?.includes(g.itemId),
    );
    const fetchedById = missingGlossaries.filter((g) => missingGlossaryIds.includes(g.itemId));
    return [...fromFirstPage, ...fetchedById];
  }, [
    hasGlossaryIds,
    allGlossariesData,
    keyDetails.glossaryIds,
    missingGlossaries,
    missingGlossaryIds,
  ]);

  // Untagged, non-global terms of other modules found in the default-language text: the server
  // excludes tagged, global, module-linked and Deprecated terms; tags added here are hidden.
  const glossarySuggestions = useMemo(() => {
    const added = new Set(addedGlossaryIds);
    return (suggestedGlossariesData?.suggestedGlossaries ?? []).filter(
      (glossary) =>
        !added.has(glossary.itemId) && !keyDetails.glossaryIds?.includes(glossary.itemId),
    );
  }, [suggestedGlossariesData, addedGlossaryIds, keyDetails.glossaryIds]);

  // One list: Tagged, Module, Global, Suggested; a term shows once, under its first source (H12).
  const shownSuggestions = glossarySuggestions.slice(0, MAX_SHOWN_SUGGESTIONS);
  const hiddenSuggestionCount = glossarySuggestions.length - shownSuggestions.length;
  const termCards = mergeSourcedGlossaries({
    tagged: resolvedGlossaries,
    module: moduleGlossariesData?.items,
    global: globalGlossariesData?.items,
    suggested: shownSuggestions,
  });
  const suggestedCount = termCards.filter((card) => card.source === "suggested").length;

  // Saves the full key without the glossary; context, routes and resources stay as they are (C20).
  const untagGlossary = async (glossaryId: string) => {
    setIsTagging(true);
    try {
      const res = await saveKey({
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources: keyDetails.resources ?? [],
        routes: keyDetails.routes ?? [],
        context: keyDetails.context,
        glossaryIds: [...new Set([...(keyDetails.glossaryIds ?? []), ...addedGlossaryIds])].filter(
          (id) => id !== glossaryId,
        ),
        isPartiallyTranslated: keyDetails.isPartiallyTranslated ?? false,
      });
      if (res?.success) {
        setAddedGlossaryIds((ids) => ids.filter((id) => id !== glossaryId));
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatErrorMessage(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: formatErrorMessage(error) });
    } finally {
      setIsTagging(false);
    }
  };

  // Saves the full current key with the glossaries added, keeping context and routes (H11).
  const tagGlossaries = async (glossaryIds: string[]) => {
    setIsTagging(true);
    try {
      const res = await saveKey({
        itemId: keyDetails.itemId,
        keyName: keyDetails.keyName,
        moduleId: keyDetails.moduleId,
        resources: keyDetails.resources ?? [],
        routes: keyDetails.routes ?? [],
        context: keyDetails.context,
        glossaryIds: [
          ...new Set([...(keyDetails.glossaryIds ?? []), ...addedGlossaryIds, ...glossaryIds]),
        ],
        isPartiallyTranslated: keyDetails.isPartiallyTranslated ?? false,
      });
      if (res?.success) {
        setAddedGlossaryIds((ids) => [...new Set([...ids, ...glossaryIds])]);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: formatErrorMessage(res?.errorMessage),
        });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: formatErrorMessage(error) });
    } finally {
      setIsTagging(false);
    }
  };

  if (isLanguageListLoading || isLanguageListLoadingFetching || !languageListData) {
    return (
      <div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  languageListData.sort((a, b) => (a.isDefault && !b.isDefault ? -1 : 1));

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="h-min rounded-sm shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{languageListData[0].languageName}</CardTitle>
              <Dialog
                open={editTranslationLangCode === languageListData[0].languageCode}
                onOpenChange={(open) =>
                  setEditTranslationLangCode(open ? languageListData[0].languageCode : null)
                }
              >
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 gap-2 px-4 py-1">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
                  </Button>
                </DialogTrigger>
                <EditTranslation
                  dialogTitle="Edit translation"
                  keyDetails={keyDetails}
                  destinationLanguageCode={languageListData[0].languageCode}
                  languageListData={languageListData}
                  onClose={() => setEditTranslationLangCode(null)}
                />
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="text-base">
            {keyDetails.resources?.find(
              (resource) => resource.culture === languageListData[0].languageCode,
            )?.value || "No translation available"}
          </CardContent>
        </Card>
        <Card className="mb-6 mt-6 h-min rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Translations</CardTitle>
          </CardHeader>
          <CardContent className="text-base">
            {languageListData.slice(1).map((language, index) => (
              <div
                key={language.languageCode}
                className={` ${index !== 0 ? "py-4" : "pb-4"} ${index !== languageListData.slice(1).length - 1 ? "border-b" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{language.languageName}</span>
                  <Dialog
                    open={editTranslationLangCode === language.languageCode}
                    onOpenChange={(open) =>
                      setEditTranslationLangCode(open ? language.languageCode : null)
                    }
                  >
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" className="h-9 gap-2 px-4 py-1">
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
                      </Button>
                    </DialogTrigger>
                    <EditTranslation
                      dialogTitle="Edit translation"
                      keyDetails={keyDetails}
                      destinationLanguageCode={language.languageCode}
                      languageListData={languageListData}
                      onClose={() => setEditTranslationLangCode(null)}
                    />
                  </Dialog>
                </div>
                <div className="mt-4">
                  {keyDetails.resources?.find(
                    (resource) => resource.culture === language.languageCode,
                  )?.value || "No translation available"}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">About</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="col-span-2 grid grid-cols-2 gap-x-4 gap-y-10">
              <div className="grid content-start gap-1">
                {/* <h3 className="text-sm font-medium text-low-emphasis">Type</h3>
                <p className="text-base font-normal text-high-emphasis">Text box</p> */}
                <h3 className="text-sm font-medium text-low-emphasis">Module</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {
                    languageModules?.find((module) => module.itemId === keyDetails.moduleId)
                      ?.moduleName
                  }
                </p>
              </div>
              <div className="grid content-start gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Created on</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {!keyDetails || !keyDetails.createDate || !checkValidDate(keyDetails.createDate)
                    ? "-"
                    : formatFullDate(parseDateString(keyDetails.createDate))}
                </p>
              </div>
              <div className="grid content-start gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Default Language</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {languageListData[0].languageName}
                </p>
              </div>
              <div className="grid content-start gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Last modified</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {!keyDetails ||
                  !keyDetails.lastUpdateDate ||
                  !checkValidDate(keyDetails.lastUpdateDate)
                    ? "-"
                    : formatFullDate(parseDateString(keyDetails.lastUpdateDate))}
                </p>
              </div>
            </div>
            <div className="col-span-2 mt-4 border-t pt-4">
              <h3 className="mb-1 text-sm font-medium text-low-emphasis">Context</h3>
              <p className="whitespace-pre-wrap text-base text-high-emphasis">
                {keyDetails.context || "No context provided."}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6 rounded-sm shadow-none">
          <CardHeader>
            <div className="grid w-full grid-cols-2">
              <h3 className="text-xl font-semibold">Routes</h3>
              <div className="flex justify-end">
                <Dialog open={isEditRoutesDialogOpen} onOpenChange={setIsEditRoutesDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <RouteIcon className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Edit Routes
                      </span>
                    </Button>
                  </DialogTrigger>
                  <EditRoute
                    keyDetails={keyDetails}
                    isOpen={isEditRoutesDialogOpen}
                    onClose={() => setIsEditRoutesDialogOpen(false)}
                  />
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm font-normal text-primary">
            {keyDetails.routes?.map((route, index) => (
              <div className="break-all" key={index}>
                {route}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mt-6 rounded-sm shadow-none">
          <CardHeader>
            <div className="grid w-full grid-cols-2">
              <h3 className="text-xl font-semibold">Glossary</h3>
              <div className="flex justify-end">
                <Dialog open={isEditGlossaryDialogOpen} onOpenChange={setIsEditGlossaryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      <BookOpen className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                        Tag Glossary
                      </span>
                    </Button>
                  </DialogTrigger>
                  <EditKeyGlossary
                    keyDetails={keyDetails}
                    resolvedGlossaries={resolvedGlossaries}
                    onClose={() => setIsEditGlossaryDialogOpen(false)}
                  />
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <TooltipProvider delayDuration={200}>
              {termCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No glossary added.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    These terms are applied when translating this key.
                  </p>
                  {suggestedCount > 0 && (
                    <div className="flex items-center justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2"
                        disabled={isTagging}
                        onClick={() =>
                          void tagGlossaries(glossarySuggestions.map((g) => g.itemId))
                        }
                      >
                        Add all suggested
                      </Button>
                    </div>
                  )}
                  <ul className="space-y-2" aria-label="Glossary terms for this key">
                    {termCards.map(({ glossary, source }) => (
                      <li key={glossary.itemId}>
                        <GlossaryTermCard
                          glossary={glossary}
                          source={source}
                          languages={languageListData}
                          disabled={isTagging}
                          onRemove={
                            source === "tagged" ? () => void untagGlossary(glossary.itemId) : undefined
                          }
                          onAdd={
                            source === "suggested"
                              ? () => void tagGlossaries([glossary.itemId])
                              : undefined
                          }
                        />
                      </li>
                    ))}
                  </ul>
                  {hiddenSuggestionCount > 0 && (
                    <span className="text-xs text-muted-foreground">
                      +{hiddenSuggestionCount} more suggested
                    </span>
                  )}
                </div>
              )}
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ViewDetails;
