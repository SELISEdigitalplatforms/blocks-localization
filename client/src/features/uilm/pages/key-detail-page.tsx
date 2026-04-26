import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  useUilmLanguageKeyById,
  useUilmLanguageModules,
  useUilmLanguages,
  useUilmProjectKey,
  useUilmTranslateKey,
  useUilmKeysTimeline,
  useUilmDeleteLanguageKey,
} from "@/features/uilm/hooks/use-uilm-queries";
import type {
  IBlocksLanguageKey,
  IGetTimelineResponse,
  TimelineEvents,
} from "@/features/uilm/types/language";
import { EditTranslationModal } from "@/features/uilm/components/edit-translation-modal";
import { EditRouteModal } from "@/features/uilm/components/edit-route-modal";
import { GptPromptModal } from "@/features/uilm/components/gpt-prompt-modal";
import { KeyTimeline } from "@/features/uilm/components/key-timeline";
import { Button } from "@/platform/ui/components/button/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/platform/ui/components/card/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/platform/ui/components/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import { Pagination } from "@/platform/ui/components/pagination/pagination";
import { ScrollArea } from "@/platform/ui/components/scroll-area/scroll-area";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import {
  segmentedTabsListClass,
  segmentedTabsTriggerClass,
} from "@/platform/ui/components/tabs/segmented-tabs-classes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/platform/ui/components/tabs/tabs";
import { Label } from "@/platform/ui/components/label/label";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { Bolt, EllipsisVertical, Loader2, Pencil, RouteIcon, Trash, Wand } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkValidDate(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortGuidGenerator(length: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(length)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, length);
}

function getDescription(logFrom: string, userName: string): string {
  switch (logFrom) {
    case "TranslateAll":
      return `Updated by translate all`;
    case "TranslateKey":
      return `Auto-translated by ${userName}`;
    case "KeyController.Save":
      return `Updated manually by ${userName}.`;
    case "UilmImport.Update":
      return `Updated by import by ${userName}.`;
    case "UilmImport.Insert":
      return `Inserted by import by ${userName}.`;
    case "KeyController.Delete":
      return `Key deleted by ${userName}.`;
    case "KeyController.Create":
      return `Key created by ${userName}.`;
    case "Rollback":
      return `Translate rolled back by ${userName}.`;
    case "Published":
      return `Key has been published by ${userName}.`;
    case "PublishFailed":
      return `Key failed to publish.`;
    case "EnvironmentDataMigration":
      return `Updated by environment data migration by ${userName}.`;
    default:
      return `A translation update action occurred.`;
  }
}

// ---------------------------------------------------------------------------
// ViewDetails sub-component
// ---------------------------------------------------------------------------

function ViewDetails({ keyDetails }: { keyDetails: IBlocksLanguageKey }) {
  const { data: languageModules } = useUilmLanguageModules();
  const {
    isLoading: isLanguageListLoading,
    isFetching: isLanguageListLoadingFetching,
    data: languageListData,
  } = useUilmLanguages();
  const [isEditRoutesDialogOpen, setIsEditRoutesDialogOpen] = useState(false);

  if (
    isLanguageListLoading ||
    isLanguageListLoadingFetching ||
    !Array.isArray(languageListData) ||
    languageListData.length === 0
  ) {
    return (
      <div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const sortedLanguages = [...languageListData].sort((a, b) =>
    a.isDefault && !b.isDefault ? -1 : 1,
  );

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card className="h-min rounded-sm shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{sortedLanguages[0].languageName}</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="h-9 gap-2 px-4 py-1">
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
                  </Button>
                </DialogTrigger>
                <EditTranslationModal
                  dialogTitle="Edit translation"
                  keyDetails={keyDetails}
                  destinationLanguageCode={sortedLanguages[0].languageCode}
                  languageListData={sortedLanguages}
                />
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="text-base">
            {keyDetails.resources?.find(
              (resource) => resource.culture === sortedLanguages[0].languageCode,
            )?.value || "No translation available"}
          </CardContent>
        </Card>
        <Card className="mb-6 mt-6 h-min rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Translations</CardTitle>
          </CardHeader>
          <CardContent className="text-base">
            {sortedLanguages.slice(1).map((language, index) => (
              <div
                key={language.languageCode}
                className={` ${index !== 0 ? "py-4" : "pb-4"} ${index !== sortedLanguages.slice(1).length - 1 ? "border-b" : ""}`}
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
                    <EditTranslationModal
                      dialogTitle="Edit translation"
                      keyDetails={keyDetails}
                      destinationLanguageCode={language.languageCode}
                      languageListData={sortedLanguages}
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
                <h3 className="text-sm font-medium text-low-emphasis">Module</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {Array.isArray(languageModules)
                    ? languageModules.find((module) => module.itemId === keyDetails.moduleId)
                        ?.moduleName
                    : undefined}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Default Language</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {sortedLanguages[0].languageName}
                </p>
              </div>
            </div>
            <div>
              <div className="grid gap-10">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Created on</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {!keyDetails || !keyDetails.createDate || !checkValidDate(keyDetails.createDate)
                      ? "-"
                      : formatFullDate(new Date(keyDetails.createDate))}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Last modified</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {!keyDetails ||
                    !keyDetails.lastUpdateDate ||
                    !checkValidDate(keyDetails.lastUpdateDate)
                      ? "-"
                      : formatFullDate(new Date(keyDetails.lastUpdateDate))}
                  </p>
                </div>
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
                  <EditRouteModal
                    keyDetails={keyDetails}
                    onClose={() => setIsEditRoutesDialogOpen(false)}
                  />
                </Dialog>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm font-normal text-primary">
            {keyDetails.routes?.map((route, index) => <div key={index}>{route}</div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function KeyDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const projectKey = useUilmProjectKey();
  const itemId = id ? decodeURIComponent(id) : "";
  const { data: blocksLanguageKeyData } = useUilmLanguageKeyById(itemId);

  const [keyDetails, setKeyDetails] = useState<IBlocksLanguageKey | null>(null);
  const [events, setEvents] = useState<TimelineEvents[]>([]);
  const [tabId, setTabId] = useState("details");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [openGptPrompt, setGptPrompt] = useState(false);
  const [autoTranslateModalOpen, setAutoTranslateModalOpen] = useState(false);

  const { isPending: isTranslating, mutateAsync: translateKeyAsync } = useUilmTranslateKey();
  const deleteMutation = useUilmDeleteLanguageKey();

  // Pagination/filter state for timeline
  const [filter, setFilter] = useState({ page: 0, pageSize: 10 });
  const { data: keyTimelineData, isLoading } = useUilmKeysTimeline(
    filter.page + 1,
    filter.pageSize,
    itemId,
  );

  const mapTimelineEvents = useCallback((response: IGetTimelineResponse): TimelineEvents[] => {
    if (!response || !response.timelines) return [];

    return response.timelines.map((e) => {
      const dateObj = new Date(e.createDate);
      return {
        id: e.itemId,
        date: dateObj.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        time: dateObj.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
        description: getDescription(e.logFrom, e.userName),
        previousData: e.previousData,
        currentData: e.currentData,
        logFrom: e.logFrom,
        userId: e.userId,
      };
    });
  }, []);

  useEffect(() => {
    if (itemId) {
      setKeyDetails(blocksLanguageKeyData || null);
    }
  }, [itemId, blocksLanguageKeyData]);

  useEffect(() => {
    if (tabId === "history" && keyTimelineData) {
      const timelineData = mapTimelineEvents(keyTimelineData);
      setEvents(timelineData);
    }
  }, [tabId, keyTimelineData, mapTimelineEvents]);

  // Handle auto-translate
  const handleTranslate = async () => {
    if (!projectKey || !keyDetails) return;

    const payload = {
      keyId: keyDetails.itemId,
      projectKey: projectKey,
      messageCoRelationId: shortGuidGenerator(8),
      defaultLanguage: "en-US",
    };

    try {
      const res = await translateKeyAsync(payload);
      if (res?.isSuccess) {
        showSuccessToast({ description: "Key translation in progress." });
        setAutoTranslateModalOpen(false);
      } else {
        showErrorToast({ errors: JSON.stringify(res?.errors) });
      }
    } catch (error) {
      showErrorToast({
        errors: error instanceof Error ? error.message : JSON.stringify(error),
      });
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!keyDetails) return;
    try {
      const res = await deleteMutation.mutateAsync(keyDetails.itemId);
      if (res?.isSuccess) {
        showSuccessToast({ description: "Key deleted" });
        navigate("/services/language", { replace: true });
      } else {
        showErrorToast({ errors: JSON.stringify(res?.errors) });
      }
    } catch (error) {
      showErrorToast({
        errors: error instanceof Error ? error.message : JSON.stringify(error),
      });
    }
  };

  // Scroll to top of timeline when page changes
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [filter.page]);

  if (!projectKey) {
    return (
      <div>
        <Card className="rounded shadow-none">
          <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>No UILM project is configured.</p>
            <p>
              Pick a project in the console header, set{" "}
              <code className="rounded bg-muted px-1">NEXT_PUBLIC_UILM_PROJECT_KEY</code>, or{" "}
              <Link
                to="/services/language/configure"
                className="font-medium text-primary hover:underline"
              >
                open Configure
              </Link>{" "}
              and enter the tenant id.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!keyDetails) {
    return (
      <div>
        <div className="hidden md:flex">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="ml-4 h-6 w-64" />
        </div>
        <Skeleton className="mt-5 h-8 w-48" />
        <div className="mt-5">
          <div className="mb-5 flex justify-between text-base">
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-24" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-10" />
              <Skeleton className="h-10 w-10" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden md:flex">
        <Link
          to="/services/language"
          className="text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          Language Translation Keys
        </Link>
        <span className="mx-2 text-sm text-muted-foreground">&gt;</span>
        <span className="text-sm text-high-emphasis">{keyDetails.keyName}</span>
      </div>
      <h1 className="mt-5 text-2xl font-semibold">{keyDetails.keyName}</h1>
      <Tabs defaultValue={tabId} className="mt-5">
        <div className="mb-5 flex justify-between text-base">
          <TabsList className={segmentedTabsListClass}>
            <TabsTrigger
              onClick={() => setTabId("details")}
              value="details"
              className={segmentedTabsTriggerClass}
            >
              Details
            </TabsTrigger>
            <TabsTrigger
              onClick={() => setTabId("history")}
              value="history"
              className={segmentedTabsTriggerClass}
            >
              History
            </TabsTrigger>
          </TabsList>
          {tabId === "details" ? (
            <div className="flex gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="default" variant="outline" className="px-2">
                    <EllipsisVertical className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuRadioGroup value="options">
                    <DropdownMenuRadioItem
                      value="autoTranslate"
                      className="gap-2 py-2 pl-2 text-high-emphasis"
                      onClick={() => setAutoTranslateModalOpen(true)}
                    >
                      <Wand className="h-3.5 w-3.5" />
                      <p className="hover gap-2 border-none pl-0">Auto-translate</p>
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem
                      value="configureAutoTranslation"
                      className="gap-2 py-2 pl-2 text-high-emphasis"
                      onClick={() => setGptPrompt(true)}
                    >
                      <Bolt className="h-3.5 w-3.5" />
                      <p className="hover gap-2 border-none pl-0">Configure auto-translation</p>
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
                <Dialog open={openGptPrompt} onOpenChange={setGptPrompt}>
                  <GptPromptModal defaultValue={keyDetails.context} keyDetails={keyDetails} />
                </Dialog>
              </DropdownMenu>
              <Dialog open={autoTranslateModalOpen} onOpenChange={setAutoTranslateModalOpen}>
                <DialogContent>
                  <DialogHeader className="mb-4">
                    <DialogTitle>Auto-translate this key</DialogTitle>
                    <Label className="!mt-[12px] font-normal text-medium-emphasis">
                      Are you sure you want to automatically translate this key?
                    </Label>
                  </DialogHeader>
                  <DialogFooter className="mt-6">
                    <Button
                      disabled={isTranslating}
                      variant="secondary"
                      className="min-w-[80px]"
                      onClick={() => setAutoTranslateModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      disabled={isTranslating}
                      className="min-w-[80px]"
                      onClick={handleTranslate}
                    >
                      {isTranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                <DialogTrigger asChild>
                  <Button size="default" variant="outline" className="gap-2">
                    <Trash className="h-4 w-4 text-error" />
                    <span className="sr-only text-error sm:not-sr-only sm:whitespace-nowrap">
                      Delete
                    </span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-md sm:max-w-[450px]">
                  <DialogHeader>
                    <DialogTitle className="text-left">Delete Key</DialogTitle>
                    <p className="mt-4 text-left text-sm text-muted-foreground">
                      Are you sure you&apos;d like to delete this key?
                    </p>
                  </DialogHeader>
                  <DialogFooter className="flex flex-row gap-2">
                    <Button
                      variant="outline"
                      size="default"
                      onClick={() => setDeleteModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="default"
                      className="bg-error"
                      onClick={handleDelete}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Delete Key"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null}
        </div>
        <TabsContent value="details">
          <ViewDetails keyDetails={keyDetails} />
        </TabsContent>
        <TabsContent value="history">
          <Card className="mt-6 h-min rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="text-xl">Activity</CardTitle>
              <CardDescription>View language value change timeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-[calc(100vh-420px)] pr-2" ref={scrollRef as never}>
                {isLoading ? (
                  <div className="py-10 text-sm text-muted-foreground">Loading timeline…</div>
                ) : events.length === 0 ? (
                  <div className="py-10 text-sm text-muted-foreground">
                    No changes found for this page.
                  </div>
                ) : (
                  <KeyTimeline events={events} />
                )}
              </ScrollArea>
              <div className="flex items-center justify-end">
                {!isLoading &&
                  keyTimelineData &&
                  keyTimelineData.totalCount > filter.pageSize && (
                    <Pagination
                      page={filter.page}
                      pageSize={filter.pageSize}
                      totalCount={keyTimelineData.totalCount}
                      onChange={(page: number) => setFilter((prev) => ({ ...prev, page }))}
                    />
                  )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
