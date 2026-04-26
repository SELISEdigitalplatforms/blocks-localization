import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Badge } from "@/components/ui-kits/badge/badge";
import { checkValidDate, formatFullDate, parseDateString } from "@/lib/utils";
import { BookOpen, Pencil, RouteIcon } from "lucide-react";
import { useMemo, useState } from "react";
import {
  useGetLanguageModules,
  useGetLanguages,
  useGetGlossaries,
  useGetSuggestedGlossaries,
} from "../../hooks/use-language-manager";
import { IBlocksLanguageKey } from "../../models/language";
import EditRoute from "../modals/edit-route/edit-route";
import EditTranslation from "../modals/edit-translation/edit-translation";
import EditKeyGlossary from "../modals/edit-key-glossary/edit-key-glossary";

const ViewDetails = ({ keyDetails }: { keyDetails: IBlocksLanguageKey }) => {
  const { data: languageModules } = useGetLanguageModules();
  const {
    isLoading: isLanguageListLoading,
    isFetching: isLanguageListLoadingFetching,
    data: languageListData,
  } = useGetLanguages();
  const [isEditRoutesDialogOpen, setIsEditRoutesDialogOpen] = useState(false);
  const [isEditGlossaryDialogOpen, setIsEditGlossaryDialogOpen] = useState(false);

  const hasGlossaryIds = (keyDetails.glossaryIds?.length ?? 0) > 0;

  const { data: allGlossariesData } = useGetGlossaries(0, 100);
  const { data: suggestedGlossariesData } = useGetSuggestedGlossaries(
    keyDetails.itemId,
    !hasGlossaryIds,
  );

  const resolvedGlossaries = useMemo(() => {
    if (!hasGlossaryIds || !allGlossariesData?.items) return [];
    return allGlossariesData.items.filter((g) => keyDetails.glossaryIds?.includes(g.itemId));
  }, [hasGlossaryIds, allGlossariesData, keyDetails.glossaryIds]);

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
              <Dialog>
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
                  <Dialog>
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
            <div className="grid gap-10">
              <div className="grid gap-1">
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
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Default Language</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {languageListData[0].languageName}
                </p>
              </div>
              {/* <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Created on</h3>
                <p className="text-base font-normal text-high-emphasis">{keyDetails.createDate}</p>
              </div> */}
            </div>
            <div>
              <div className="grid gap-10">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Created on</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {!keyDetails || !keyDetails.createDate || !checkValidDate(keyDetails.createDate)
                      ? "-"
                      : formatFullDate(parseDateString(keyDetails.createDate))}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Last modified</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {!keyDetails ||
                    !keyDetails.lastUpdateDate ||
                    !checkValidDate(keyDetails.lastUpdateDate)
                      ? "-"
                      : formatFullDate(parseDateString(keyDetails.lastUpdateDate))}
                  </p>
                </div>
                {/* <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Created by</h3>
                  <p className="text-base font-normal text-high-emphasis">Martin Bator</p>
                </div> */}
              </div>
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
                  <EditRoute keyDetails={keyDetails} onClose={() => setIsEditRoutesDialogOpen(false)} />
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm font-normal text-primary">
            {keyDetails.routes?.map((route, index) => <div className="break-all" key={index}>{route}</div>)}
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
              <div className="flex flex-wrap gap-2">
                {resolvedGlossaries.map((glossary) => (
                  <Badge key={glossary.itemId} variant="secondary">
                    {glossary.name}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">No glossary added.</p>
                {suggestedGlossariesData?.suggestedGlossaries &&
                  suggestedGlossariesData.suggestedGlossaries.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Suggested glossaries
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {suggestedGlossariesData.suggestedGlossaries.map((glossary) => (
                          <Badge key={glossary.itemId} variant="outline">
                            {glossary.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ViewDetails;
