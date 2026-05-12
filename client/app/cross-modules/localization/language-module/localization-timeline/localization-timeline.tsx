
import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui-kits/card/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  useGetLocalizationTimeline,
  useGetTimelineByOperationId,
} from "@blocks-localization/hooks/use-language-manager";
import {
  IGetLocalizationTimelineResponse,
  IBlocksLanguageKey,
} from "@blocks-localization/models/language";
import useIsMobile from "@/hooks/use-is-mobile";
import { Badge } from "@/components/ui-kits/badge/badge";

function getOperationDescription(logFrom: string, userName: string): string {
  switch (logFrom) {
    case "TranslateAll":
      return `Translate all by ${userName}`;
    case "TranslateKey":
      return `Auto-translated by ${userName}`;
    case "KeyController.Save":
      return `Updated manually by ${userName}`;
    case "KeyController.BulkSave":
      return `Bulk updated by ${userName}`;
    case "KeyController.Create":
      return `Key created by ${userName}`;
    case "KeyController.BulkCreate":
      return `Bulk created by ${userName}`;
    case "UilmImport.Update":
      return `Updated by import by ${userName}`;
    case "UilmImport.Insert":
      return `Inserted by import by ${userName}`;
    case "KeyController.Delete":
      return `Key deleted by ${userName}`;
    case "Rollback":
      return `Rolled back by ${userName}`;
    case "Published":
      return `Published by ${userName}`;
    case "PublishFailed":
      return `Publish failed`;
    case "EnvironmentDataMigration":
      return `Environment data migration by ${userName}`;
    default:
      return `A translation action occurred`;
  }
}

function formatDate(dateStr: string): { date: string; time: string } {
  const dateObj = new Date(dateStr);
  return {
    date: dateObj.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    time: dateObj.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

const DEFAULT_TIMELINE_EXCLUDES = [
  "KeyController.Create",
  "KeyController.Save",
  "KeyController.Delete",
  "TranslateKey",
  "Rollback",
] as const;

// Cultures from both sides for diff table
const asArray = <T,>(x?: T | T[]): T[] => (Array.isArray(x) ? x : x ? [x] : []);
const getCultures = (
  prev?: IBlocksLanguageKey | IBlocksLanguageKey[],
  curr?: IBlocksLanguageKey | IBlocksLanguageKey[],
) => {
  const prevCultures = asArray(prev).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  const currCultures = asArray(curr).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  return Array.from(new Set([...prevCultures, ...currCultures]));
};

function OperationDetailModal({
  operationId,
  open,
  onClose,
}: {
  operationId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [detailPage, setDetailPage] = useState(0);
  const detailPageSize = 10;

  const { data, isLoading } = useGetTimelineByOperationId(
    operationId,
    detailPage + 1,
    detailPageSize,
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data && data.timelines.length > 0
              ? getOperationDescription(data.timelines[0].logFrom, data.timelines[0].userName)
              : "Operation Details"}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.timelines.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No details found for this operation.</p>
        ) : data.timelines[0]?.logFrom === "Published" && !data.timelines[0]?.currentData && !data.timelines[0]?.previousData ? (
          <p className="py-4 text-sm text-muted-foreground">No changes published.</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Changes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.timelines.map((timeline) => {
                  const { date, time } = formatDate(timeline.createDate);
                  const keyName =
                    timeline.currentData?.keyName ?? timeline.previousData?.keyName ?? "-";

                  const cultures = getCultures(timeline.previousData, timeline.currentData);

                  return (
                    <TableRow key={timeline.itemId}>
                      <TableCell className="font-medium">{keyName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {date} {time}
                      </TableCell>
                      <TableCell>
                        {cultures.length > 0 ? (
                          <div className="space-y-1">
                            {cultures.map((culture) => {
                              const prevVal =
                                asArray(timeline.previousData)
                                  .flatMap((d) => d.resources ?? [])
                                  .find((r) => r.culture === culture)?.value ?? "-";
                              const currVal =
                                asArray(timeline.currentData)
                                  .flatMap((d) => d.resources ?? [])
                                  .find((r) => r.culture === culture)?.value ?? "-";

                              if (prevVal === currVal) return null;

                              return (
                                <div key={culture} className="text-xs">
                                  <span className="font-medium">{culture}:</span>{" "}
                                  <span className="text-destructive line-through">{prevVal}</span>
                                  {" → "}
                                  <span className="text-green-600">{currVal}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {data.totalCount > detailPageSize && (
              <div className="mt-4 flex items-center justify-end">
                <Pagination
                  page={detailPage}
                  pageSize={detailPageSize}
                  totalCount={data.totalCount}
                  onChange={(page: number) => setDetailPage(page)}
                />
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type LocalizationTimelineProps = {
  /**
   * When omitted, some high-volume per-key event types are hidden (used on the keys “History” tab).
   * Pass `{}` for the full localization timeline (e.g. dedicated Activity log page).
   */
  timelineQuery?: {
    userId?: string;
    logFrom?: string;
    logFromValues?: string[];
    excludeLogFromValues?: string[];
    createDateRange?: { startDate?: string; endDate?: string };
  };
  cardTitle?: string;
  cardDescription?: string;
};

export default function LocalizationTimeline({
  timelineQuery,
  cardTitle = "History",
  cardDescription = "View all localization changes.",
}: LocalizationTimelineProps = {}) {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);

  const { data, isLoading } = useGetLocalizationTimeline(
    page + 1,
    pageSize,
    timelineQuery === undefined
      ? { excludeLogFromValues: [...DEFAULT_TIMELINE_EXCLUDES] }
      : timelineQuery,
  );

  const timelineData = data as IGetLocalizationTimelineResponse | undefined;

  return (
    <>
      <Card className="mt-6 h-min rounded-sm shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">{cardTitle}</CardTitle>
          <CardDescription>{cardDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-[calc(100vh-420px)] overflow-y-auto pr-2">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !timelineData || timelineData.operations.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                No history found.
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-start">
                {timelineData.operations.map((entry, index) => {
                  const { date, time } = formatDate(entry.createDate);
                  const description = getOperationDescription(entry.logFrom, entry.userName);

                  return (
                    <div
                      key={entry.operationId + index}
                      className="flex min-h-[66px] w-full cursor-pointer rounded-md hover:bg-muted/50"
                      onClick={() => setSelectedOperationId(entry.operationId)}
                    >
                      {/* Left: time/date */}
                      <div
                        className={`${isMobile ? "w-[30%]" : "w-[16%]"} flex-shrink-0 pr-[6px] pt-[2px] text-right md:pr-[8px] lg:pr-[10px] xl:pr-[18px]`}
                      >
                        <p className="text-[10px] font-medium leading-[16px] text-medium-emphasis xl:text-[12px] xl:leading-[20px]">
                          {time}
                        </p>
                        <p className="text-[10px] font-medium leading-[16px] text-medium-emphasis xl:text-[12px] xl:leading-[20px]">
                          {date}
                        </p>
                      </div>

                      {/* Center: dot + line */}
                      <div className="relative flex-shrink-0">
                        {index !== timelineData.operations.length - 1 && (
                          <div className="absolute left-[37%] h-full w-[4px] bg-[#D9D9D9]" />
                        )}
                        <div className="relative z-10 mt-[2px] h-[16px] w-[16px] rounded-full bg-primary" />
                      </div>

                      {/* Right: description + badge */}
                      <div className="w-full pl-[18px] pt-[2px] md:pl-[20px]">
                        <div className="flex w-full flex-row items-start justify-between gap-2">
                          <p className="w-[65%] text-[12px] font-medium leading-[20px] text-medium-emphasis md:text-[14px] md:leading-[24px]">
                            {description}
                          </p>
                          <div className="flex items-center gap-2">
                            {entry.affectedKeysCount > 1 && (
                              <Badge variant="secondary" className="text-xs">
                                {entry.affectedKeysCount} keys
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {!isLoading && timelineData && timelineData.totalCount > pageSize && (
            <div className="flex items-center justify-end">
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={timelineData.totalCount}
                onChange={(p: number) => setPage(p)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {selectedOperationId && (
        <OperationDetailModal
          operationId={selectedOperationId}
          open={!!selectedOperationId}
          onClose={() => setSelectedOperationId(null)}
        />
      )}
    </>
  );
}
