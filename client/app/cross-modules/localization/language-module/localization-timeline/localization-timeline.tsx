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
  IGetTimelineByOperationIdResponse,
  IBlocksLanguageKey,
  ILocalizationTimelineEntry,
} from "@blocks-localization/models/language";
import useIsMobile from "@/hooks/use-is-mobile";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Clock, FileX, History } from "lucide-react";

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

const createSkeletonKeys = (count: number) =>
  Array.from({ length: count }, () => crypto.randomUUID());

const OPERATION_DETAIL_SKELETON_KEYS = createSkeletonKeys(3);
const TIMELINE_SKELETON_KEYS = createSkeletonKeys(5);

// Cultures from both sides for diff table
const asArray = <T,>(x?: T | T[]): T[] => {
  if (Array.isArray(x)) return x;
  if (!x) return [];
  return [x];
};
const getCultures = (
  prev?: IBlocksLanguageKey | IBlocksLanguageKey[],
  curr?: IBlocksLanguageKey | IBlocksLanguageKey[],
) => {
  const prevCultures = asArray(prev).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  const currCultures = asArray(curr).flatMap((d) => d.resources?.map((r) => r.culture) ?? []);
  return Array.from(new Set([...prevCultures, ...currCultures]));
};

const getResourceValue = (
  data: IBlocksLanguageKey | IBlocksLanguageKey[] | undefined,
  culture: string,
) =>
  asArray(data)
    .flatMap((item) => item.resources ?? [])
    .find((resource) => resource.culture === culture)?.value ?? "-";

type OperationDetailEntry = IGetTimelineByOperationIdResponse["timelines"][number];

function CultureChanges({ timeline }: Readonly<{ timeline: OperationDetailEntry }>) {
  const cultures = getCultures(timeline.previousData, timeline.currentData);

  if (cultures.length === 0) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="space-y-1">
      {cultures.map((culture) => {
        const previousValue = getResourceValue(timeline.previousData, culture);
        const currentValue = getResourceValue(timeline.currentData, culture);

        if (previousValue === currentValue) return null;

        return (
          <div key={culture} className="text-xs">
            <span className="font-medium">{culture}:</span>{" "}
            <span className="text-destructive line-through">{previousValue}</span>
            {" → "}
            <span className="text-green-600">{currentValue}</span>
          </div>
        );
      })}
    </div>
  );
}

function OperationDetailRow({ timeline }: Readonly<{ timeline: OperationDetailEntry }>) {
  const { date, time } = formatDate(timeline.createDate);
  const keyName = timeline.currentData?.keyName ?? timeline.previousData?.keyName ?? "-";

  return (
    <TableRow>
      <TableCell className="font-medium">{keyName}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {date} {time}
      </TableCell>
      <TableCell>
        <CultureChanges timeline={timeline} />
      </TableCell>
    </TableRow>
  );
}

type OperationDetailsContentProps = {
  data: IGetTimelineByOperationIdResponse | undefined;
  isLoading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

function OperationDetailsContent({
  data,
  isLoading,
  page,
  pageSize,
  onPageChange,
}: Readonly<OperationDetailsContentProps>) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {OPERATION_DETAIL_SKELETON_KEYS.map((skeletonKey) => (
          <Skeleton key={skeletonKey} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.timelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <FileX className="mb-2 h-10 w-10 text-low-emphasis" strokeWidth={1.5} />
        <p className="text-sm font-medium text-medium-emphasis">No details found</p>
        <p className="text-xs">No details available for this operation.</p>
      </div>
    );
  }

  const firstTimeline = data.timelines[0];
  const isPublishedWithNoChanges =
    firstTimeline.logFrom === "Published" &&
    !firstTimeline.currentData &&
    !firstTimeline.previousData;

  if (isPublishedWithNoChanges) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Clock className="mb-2 h-10 w-10 text-low-emphasis" strokeWidth={1.5} />
        <p className="text-sm font-medium text-medium-emphasis">No changes published</p>
        <p className="text-xs">This publish operation had no changes.</p>
      </div>
    );
  }

  return (
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
          {data.timelines.map((timeline) => (
            <OperationDetailRow key={timeline.itemId} timeline={timeline} />
          ))}
        </TableBody>
      </Table>

      {data.totalCount > pageSize && (
        <div className="mt-4 flex items-center justify-end">
          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={data.totalCount}
            onChange={onPageChange}
          />
        </div>
      )}
    </>
  );
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

  const { data, isLoading } = useGetTimelineByOperationId(
    operationId,
    detailPage + 1,
    detailPageSize,
  );

  const dialogTitle =
    data && data.timelines.length > 0
      ? getOperationDescription(data.timelines[0].logFrom, data.timelines[0].userName)
      : "Operation Details";

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <OperationDetailsContent
          data={data}
          isLoading={isLoading}
          page={detailPage}
          pageSize={detailPageSize}
          onPageChange={setDetailPage}
        />
      </DialogContent>
    </Dialog>
  );
}

type TimelineEntryProps = {
  entry: ILocalizationTimelineEntry;
  index: number;
  entryCount: number;
  isMobile: boolean;
  onSelect: (operationId: string) => void;
};

function TimelineEntry({
  entry,
  index,
  entryCount,
  isMobile,
  onSelect,
}: Readonly<TimelineEntryProps>) {
  const { date, time } = formatDate(entry.createDate);
  const description = getOperationDescription(entry.logFrom, entry.userName);
  const selectEntry = () => onSelect(entry.operationId);

  return (
    <button
      type="button"
      className="flex min-h-[66px] w-full cursor-pointer appearance-none rounded-md border-0 bg-transparent p-0 text-left hover:bg-muted/50"
      onClick={selectEntry}
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
        {index !== entryCount - 1 && (
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
    </button>
  );
}

type TimelineContentProps = {
  data: IGetLocalizationTimelineResponse | undefined;
  isLoading: boolean;
  isMobile: boolean;
  onSelect: (operationId: string) => void;
};

function TimelineContent({ data, isLoading, isMobile, onSelect }: Readonly<TimelineContentProps>) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {TIMELINE_SKELETON_KEYS.map((skeletonKey) => (
          <Skeleton key={skeletonKey} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!data || data.operations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <History className="mb-3 h-12 w-12 text-low-emphasis" strokeWidth={1.5} />
        <p className="mb-1 text-base font-medium text-medium-emphasis">No history found</p>
        <p className="text-sm">Your localization activity will appear here.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col items-start">
      {data.operations.map((entry, index) => (
        <TimelineEntry
          key={entry.operationId}
          entry={entry}
          index={index}
          entryCount={data.operations.length}
          isMobile={isMobile}
          onSelect={onSelect}
        />
      ))}
    </div>
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
            <TimelineContent
              data={timelineData}
              isLoading={isLoading}
              isMobile={isMobile}
              onSelect={setSelectedOperationId}
            />
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
