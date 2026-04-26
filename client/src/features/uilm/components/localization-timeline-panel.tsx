import {
  useUilmLocalizationTimeline,
  useUilmTimelineByOperationId,
} from "@/features/uilm/hooks/use-uilm-queries";
import type { IBlocksLanguageKey } from "@/features/uilm/types/language";
import { Badge } from "@/platform/ui/components/badge/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import { Pagination } from "@/platform/ui/components/pagination/pagination";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/platform/ui/components/table/table";
import { useEffect, useState } from "react";

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
      return "Publish failed";
    case "EnvironmentDataMigration":
      return `Environment data migration by ${userName}`;
    default:
      return "A translation action occurred";
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

const asArray = <T,>(x?: T | T[]): T[] => (Array.isArray(x) ? x : x ? [x] : []);

function getCultures(
  prev?: IBlocksLanguageKey | IBlocksLanguageKey[],
  curr?: IBlocksLanguageKey | IBlocksLanguageKey[],
): string[] {
  const prevCultures = asArray(prev).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  const currCultures = asArray(curr).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  return Array.from(new Set([...prevCultures, ...currCultures]));
}

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

  const { data, isLoading } = useUilmTimelineByOperationId(operationId, detailPage, detailPageSize);

  useEffect(() => {
    setDetailPage(0);
  }, [operationId]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {data && data.timelines.length > 0
              ? getOperationDescription(data.timelines[0].logFrom, data.timelines[0].userName)
              : "Operation details"}
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
        ) : data.timelines[0]?.logFrom === "Published" &&
          !data.timelines[0]?.currentData &&
          !data.timelines[0]?.previousData ? (
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
                    timeline.currentData?.keyName ?? timeline.previousData?.keyName ?? "—";
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
                                  .find((r) => r.culture === culture)?.value ?? "—";
                              const currVal =
                                asArray(timeline.currentData)
                                  .flatMap((d) => d.resources ?? [])
                                  .find((r) => r.culture === culture)?.value ?? "—";

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
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {data.totalCount > detailPageSize ? (
              <div className="mt-4 flex items-center justify-end">
                <Pagination
                  page={detailPage}
                  pageSize={detailPageSize}
                  totalCount={data.totalCount}
                  onChange={setDetailPage}
                />
              </div>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

const TIMELINE_EXCLUDES = [
  "KeyController.Create",
  "KeyController.Save",
  "KeyController.Delete",
  "TranslateKey",
  "Rollback",
] as const;

export function LocalizationTimelinePanel() {
  const [page, setPage] = useState(0);
  const pageSize = 10;
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);

  const { data, isLoading } = useUilmLocalizationTimeline(page, pageSize, {
    excludeLogFromValues: [...TIMELINE_EXCLUDES],
  });

  const timelineData = data;

  return (
    <>
      <Card className="mt-0 h-min rounded-sm border border-border px-4 py-3 shadow-none">
        <CardHeader className="mb-0 pb-2 pt-0">
          <CardTitle className="text-base font-semibold text-high-emphasis">History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-0 pb-0 pt-0">
          <div className="max-h-[min(60vh,520px)] overflow-y-auto pr-2">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !timelineData || timelineData.operations.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">No history found.</div>
            ) : (
              <div className="mt-2 flex flex-col items-start">
                {timelineData.operations.map((entry, index) => {
                  const { date, time } = formatDate(entry.createDate);
                  const description = getOperationDescription(entry.logFrom, entry.userName);

                  return (
                    <button
                      key={entry.operationId + index}
                      type="button"
                      className="flex min-h-[52px] w-full cursor-pointer rounded-md text-left transition-colors hover:bg-muted/50"
                      onClick={() => setSelectedOperationId(entry.operationId)}
                    >
                      <div className="w-[16%] flex-shrink-0 pr-2 pt-0.5 text-right md:pr-3">
                        <p className="text-[10px] font-medium leading-4 text-muted-foreground xl:text-xs xl:leading-5">
                          {time}
                        </p>
                        <p className="text-[10px] font-medium leading-4 text-muted-foreground xl:text-xs xl:leading-5">
                          {date}
                        </p>
                      </div>
                      <div className="relative flex-shrink-0">
                        {index !== timelineData.operations.length - 1 ? (
                          <div className="absolute left-[37%] h-full w-1 bg-border" />
                        ) : null}
                        <div className="relative z-10 mt-0.5 h-4 w-4 rounded-full bg-primary" />
                      </div>
                      <div className="w-full pl-4 pt-0.5 md:pl-5">
                        <div className="flex w-full flex-row items-start justify-between gap-2">
                          <p className="w-[65%] text-xs font-medium leading-5 text-muted-foreground md:text-sm md:leading-6">
                            {description}
                          </p>
                          <div className="flex items-center gap-2">
                            {entry.affectedKeysCount > 1 ? (
                              <Badge variant="secondary" className="text-xs">
                                {entry.affectedKeysCount} keys
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!isLoading && timelineData && timelineData.totalCount > pageSize ? (
            <div className="flex items-center justify-end">
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={timelineData.totalCount}
                onChange={setPage}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      {selectedOperationId ? (
        <OperationDetailModal
          operationId={selectedOperationId}
          open={!!selectedOperationId}
          onClose={() => setSelectedOperationId(null)}
        />
      ) : null}
    </>
  );
}
