
import React, { useRef, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { EllipsisVertical, Trash, Wand } from "lucide-react";
import { useEffect, useState } from "react";
import { useQueryState } from "nuqs";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Label } from "@/components/ui-kits/label/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import {
  IBlocksLanguageKey,
  IGetTimelineResponse,
  TimelineEvents,
} from "@blocks-localization/models/language";
import ViewDetails from "@blocks-localization/components/view-details/view-details";
import {
  useGetBlocksLanguageKeyById,
  useGetLanguageKeysTimeline,
  useTranslateKey,
} from "@blocks-localization/hooks/use-language-manager";
import DeleteLanguageKey from "@blocks-localization/components/modals/delete-language-key/delete-language-key";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import Timeline from "../timeline/timeline";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import GptPrompt from "@blocks-localization/components/modals/gpt-prompt/gpt-prompt";
import { useProjectStore } from "@/store/useProjectStore";
import { toast } from "@/hooks/use-toast";
import { shortGuidGenerator } from "@/components/create-project/utils";
import { useParams } from "react-router-dom";

const KeyDetails = () => {
  const { keyId } = useParams<{ keyId: string }>();
  const id = keyId ?? "";
  const { data: blocksLanguageKeyData } = useGetBlocksLanguageKeyById(id);
  // const { data: keyTimelineData } = useGetLanguageKeysTimeline(1, 20, id);
  const [keyDetails, setKeyDetails] = useState<IBlocksLanguageKey | null>(null);
  const [events, setEvents] = useState<TimelineEvents[]>([]);
  const [tabId, setTabId] = useQueryState("translationActivity", { defaultValue: "details" });
  const [deleteModalOpen, setDeleteModalOpen] = useState<boolean>(false);
  const [openGptPromt, setGptPromt] = useState<boolean>(false);
  const [autoTranslateModalOpen, setAutoTranslateModalOpen] = useState<boolean>(false);

  // Hooks for translation
  const { isPending: isTranslating, mutateAsync: translateKeyAsync } = useTranslateKey();
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  // Pagination/filter state
  const [filter, setFilter] = useState({ page: 0, pageSize: 10 });

  // Fetch timeline with current pagination
  const { data: keyTimelineData, isLoading } = useGetLanguageKeysTimeline(
    filter.page + 1,
    filter.pageSize,
    id,
  ) as {
    data?: IGetTimelineResponse;
    isLoading: boolean;
  };

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
    if (id) {
      setKeyDetails(blocksLanguageKeyData || null);
    }
  }, [id, blocksLanguageKeyData]);

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
        toast({
          variant: "success",
          title: "Processing Translation",
          description: "Key translation in progress.",
        });
        setAutoTranslateModalOpen(false);
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: JSON.stringify(res?.errors),
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  // Scroll to top of the timeline when page changes
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [filter.page]);

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

  BREADCRUMB_CUSTOM_TITLES["/services/language/translations"] = "Language Translation Keys";
  BREADCRUMB_CUSTOM_TITLES["/services/language/translations/" + keyDetails?.itemId] =
    keyDetails.keyName;

  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={3} />
      </div>
      <h1 className="mt-5 text-2xl font-semibold">{keyDetails.keyName}</h1>
      <Tabs defaultValue={tabId} className="mt-5">
        <div className="mb-5 flex justify-between text-base">
          <TabsList className="h-[42px] bg-blocks-primary-shades-300">
            <TabsTrigger onClick={() => setTabId("details")} value="details" className="h-8">
              Details
            </TabsTrigger>
            <TabsTrigger onClick={() => setTabId("history")} value="history" className="h-8">
              History
            </TabsTrigger>
          </TabsList>
          {
            tabId === "details" ? (
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
                        onClick={() => {
                          setAutoTranslateModalOpen(true);
                        }}
                      >
                        <Wand className="h-3.5 w-3.5" />
                        <p className="hover gap-2 border-none pl-0">Auto-translate</p>
                      </DropdownMenuRadioItem>
                      {/* <DropdownMenuRadioItem
                        value="autoTranslate"
                        className="gap-2 py-2 pl-2 text-high-emphasis"
                        onClick={() => {
                          setGptPromt(true);
                        }}
                      >
                        <Bolt className="h-3.5 w-3.5" />
                        <p className="hover gap-2 border-none pl-0">Configure auto-translation</p>
                      </DropdownMenuRadioItem> */}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                  <Dialog open={openGptPromt} onOpenChange={setGptPromt}>
                    <GptPrompt defaultValue={keyDetails.context} keyDetails={keyDetails} />
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
                      <DialogTrigger asChild>
                        <Button
                          disabled={isTranslating}
                          variant="secondary"
                          className="min-w-[80px]"
                        >
                          Cancel
                        </Button>
                      </DialogTrigger>
                      <DialogTrigger asChild>
                        <Button
                          disabled={isTranslating}
                          className="min-w-[80px]"
                          onClick={handleTranslate}
                        >
                          Yes
                        </Button>
                      </DialogTrigger>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                {/* <Dialog>
                <DialogTrigger asChild>
                  <Button size="default" variant="outline" className="gap-2">
                    <Trash className="h-4 w-4 text-error" />
                    <span className="sr-only text-error sm:not-sr-only sm:whitespace-nowrap">
                      Delete
                    </span>
                  </Button>
                </DialogTrigger>
              </Dialog> */}
                <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
                  <DialogTrigger asChild>
                    <Button size="default" variant="outline" className="gap-2">
                      <Trash className="h-4 w-4 text-error" />
                      <span className="sr-only text-error sm:not-sr-only sm:whitespace-nowrap">
                        Delete
                      </span>
                    </Button>
                  </DialogTrigger>
                  <DeleteLanguageKey
                    itemId={keyDetails.itemId}
                    onClose={() => setDeleteModalOpen(false)}
                  />
                </Dialog>
                {/* <Button
                size="default"
                className="gap-2"
                disabled
                onClick={() => {
                  router.push("/new-language-key");
                }}
              >
                <Pencil className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
              </Button> */}
              </div>
            ) : null
            // <div className="flex gap-2">
            //   <Button variant="outline" className="h-10 w-10 p-0">
            //     <Filter width={20} height={20} />
            //   </Button>
            // </div>
          }
        </div>
        <TabsContent value="details">
          <ViewDetails keyDetails={keyDetails} />
        </TabsContent>
        <TabsContent value="history">
          <Card className="mt-6 h-min rounded-sm shadow-none">
            {/* <ComingSoonPage message="Coming Soon" /> */}
            <CardHeader>
              <CardTitle className="text-xl">Activity</CardTitle>
              <CardDescription>View language value change timeline.</CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Scrollable timeline area */}
              <ScrollArea className="h-[calc(100vh-420px)] pr-2" ref={scrollRef as never}>
                {isLoading ? (
                  <div className="py-10 text-sm text-muted-foreground">Loading timeline…</div>
                ) : events.length === 0 ? (
                  <div className="py-10 text-sm text-muted-foreground">
                    No changes found for this page.
                  </div>
                ) : (
                  <Timeline events={events} />
                )}
              </ScrollArea>

              {/* Pagination */}
              <div className="flex items-center justify-end">
                {!isLoading && keyTimelineData && keyTimelineData.totalCount > filter.pageSize && (
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
};

export { KeyDetails };
