import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Badge } from "@/components/ui-kits/badge/badge";
import { checkValidDate, formatFullDate, parseDateString } from "@/lib/utils";
import { BookOpen, Pencil, Plus, RouteIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useGetLanguageModules,
  useGetLanguages,
  useGetGlossaries,
  useGetGlossariesByIds,
  useGetGlobalGlossaries,
  useGetModuleGlossaries,
  useSaveBlocksLanguageKey,
} from "../../hooks/use-language-manager";
import {
  useGetAllGlossaries,
  useLoadAllGlossaries,
} from "../../hooks/use-glossary-aware-suggestion";
import { IBlocksLanguageKey, IGlossary } from "../../models/language";
import { buildGlossaryMatcher } from "../../utils/glossary-matcher";
import { getDefaultLanguage } from "../../utils/glossary-rule-marker";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import EditRoute from "../modals/edit-route/edit-route";
import EditTranslation from "../modals/edit-translation/edit-translation";
import EditKeyGlossary from "../modals/edit-key-glossary/edit-key-glossary";

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
  // The full glossary, loaded once: View Details suggestions and Edit translation.
  const { data: allTerms } = useGetAllGlossaries();
  const loadGlossaries = useLoadAllGlossaries();
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

  const contextGlossaries = useMemo(() => {
    const taggedIds = new Set(keyDetails.glossaryIds ?? []);
    const seen = new Set<string>();
    const result: ((typeof resolvedGlossaries)[number] & {
      source: "global" | "module";
    })[] = [];
    for (const g of globalGlossariesData?.items ?? []) {
      if (!taggedIds.has(g.itemId) && !seen.has(g.itemId)) {
        seen.add(g.itemId);
        result.push({ ...g, source: "global" });
      }
    }
    for (const g of moduleGlossariesData?.items ?? []) {
      if (!taggedIds.has(g.itemId) && !seen.has(g.itemId)) {
        seen.add(g.itemId);
        result.push({ ...g, source: "module" });
      }
    }
    return result;
  }, [globalGlossariesData, moduleGlossariesData, keyDetails.glossaryIds]);

  // Untagged, non-global terms of other modules found in the default-language text (H10).
  const glossarySuggestions = useMemo(() => {
    if (!allTerms?.length) return [];
    const defaultLanguage = getDefaultLanguage(languageListData);
    const source = keyDetails.resources?.find(
      (resource) => resource.culture === defaultLanguage?.languageCode,
    )?.value;
    if (!defaultLanguage || !source?.trim()) return [];
    const matches = buildGlossaryMatcher(allTerms).match(source, {
      scopeMode: "all",
      sourceCulture: defaultLanguage.languageCode,
      keyGlossaryIds: keyDetails.glossaryIds,
      moduleId: keyDetails.moduleId,
    });
    const seen = new Set<string>(addedGlossaryIds);
    const result: IGlossary[] = [];
    for (const match of matches) {
      if (match.scope !== "other" || seen.has(match.glossary.itemId)) continue;
      seen.add(match.glossary.itemId);
      result.push(match.glossary);
    }
    return result;
  }, [
    allTerms,
    languageListData,
    keyDetails.resources,
    keyDetails.glossaryIds,
    keyDetails.moduleId,
    addedGlossaryIds,
  ]);

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
                  loadGlossaries={loadGlossaries}
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
                      loadGlossaries={loadGlossaries}
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
            {hasGlossaryIds ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {resolvedGlossaries.map((glossary) => (
                    <Badge key={glossary.itemId} variant="secondary">
                      {glossary.name}
                    </Badge>
                  ))}
                </div>
                {contextGlossaries.length > 0 && (
                  <div className="space-y-2 border-t pt-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Global &amp; module glossaries
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {contextGlossaries.map((glossary) => (
                        <Badge
                          key={glossary.itemId}
                          variant="outline"
                          title={
                            glossary.source === "global" ? "Global glossary" : "Module glossary"
                          }
                        >
                          {glossary.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No glossary added.</p>
                {contextGlossaries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Global & module glossaries
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {contextGlossaries.map((glossary) => (
                        <Badge
                          key={glossary.itemId}
                          variant="outline"
                          title={
                            glossary.source === "global" ? "Global glossary" : "Module glossary"
                          }
                        >
                          {glossary.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            {glossarySuggestions.length > 0 && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Suggested glossaries</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    disabled={isTagging}
                    onClick={() => void tagGlossaries(glossarySuggestions.map((g) => g.itemId))}
                  >
                    Add all
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {glossarySuggestions.slice(0, MAX_SHOWN_SUGGESTIONS).map((glossary) => (
                    <Badge key={glossary.itemId} variant="outline" className="gap-1">
                      {glossary.name}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0"
                        aria-label={`Tag ${glossary.name} to key`}
                        disabled={isTagging}
                        onClick={() => void tagGlossaries([glossary.itemId])}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </Badge>
                  ))}
                  {glossarySuggestions.length > MAX_SHOWN_SUGGESTIONS && (
                    <span className="text-xs text-muted-foreground">
                      +{glossarySuggestions.length - MAX_SHOWN_SUGGESTIONS} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ViewDetails;
