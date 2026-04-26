import {
  ExportHistoryFilters,
  type ExportHistoryFilterState,
} from "@/features/uilm/components/export-history-filters";
import { LanguageSubpageChrome } from "@/features/uilm/components/language-subpage-chrome";
import { useUilmExportHistory, useUilmProjectKey } from "@/features/uilm/hooks/use-uilm-queries";
import type { ExportHistoryFilters as ApiExportHistoryFilters } from "@/features/uilm/types/language";
import { storageFileService } from "@/platform/storage/storage-file.service";
import { Button } from "@/platform/ui/components/button/button";
import { Card } from "@/platform/ui/components/card/card";
import { Pagination } from "@/platform/ui/components/pagination/pagination";
import { ScrollArea } from "@/platform/ui/components/scroll-area/scroll-area";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/ui/components/table/table";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { ArrowLeft, Download } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const PAGE_SIZE = 10;
const COLUMNS = ["File Name", "Date", "Download"] as const;

/** Matches `localization/language-module/export-history/export-history.tsx` API shaping. */
function toApiFilters(state: ExportHistoryFilterState): ApiExportHistoryFilters {
  const formattedStartDate = state.startDate ? state.startDate : "";
  const formattedEndDate = state.endDate
    ? `${state.endDate.split("T")[0]}T23:59:59.999Z`
    : state.startDate
      ? `${state.startDate.split("T")[0]}T23:59:59.999Z`
      : "";
  return {
    searchText: state.searchText.trim() || undefined,
    startDate: formattedStartDate || undefined,
    endDate: formattedEndDate || undefined,
  };
}

export function ExportHistoryPage() {
  const navigate = useNavigate();
  const projectKey = useUilmProjectKey();
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<ExportHistoryFilterState>({
    searchText: "",
    startDate: "",
    endDate: "",
  });

  const apiFilters = useMemo(() => toApiFilters(filters), [filters]);

  const { data, isLoading } = useUilmExportHistory(page, PAGE_SIZE, apiFilters);

  const onFiltersChange = useCallback((next: ExportHistoryFilterState) => {
    setFilters(next);
    setPage(0);
  }, []);

  const downloadFile = useCallback(
    async (fileId: string) => {
      if (!projectKey) return;
      try {
        const result = await storageFileService.getFileByFileId({
          itemId: fileId,
          projectKey,
        });
        const url = result?.url;
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.download = result?.name ?? "";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          showErrorToast({ errors: "Download URL not available" });
        }
      } catch (e) {
        showErrorToast({ errors: e instanceof Error ? e.message : String(e) });
      }
    },
    [projectKey],
  );

  if (!projectKey) {
    return (
      <LanguageSubpageChrome title="Export history" description="Previously generated UILM export files.">
        <Card className="p-4 text-sm text-muted-foreground">
          <p>No UILM project is configured.</p>
          <p className="mt-2">
            Pick a project in the console header, set{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_UILM_PROJECT_KEY</code>, or{" "}
            <Link to="/services/language/configure" className="font-medium text-primary hover:underline">
              open Configure
            </Link>{" "}
            and enter the tenant id.
          </p>
        </Card>
      </LanguageSubpageChrome>
    );
  }

  const files = data?.uilmExportedFiles ?? [];
  const totalCount = data?.totalCount ?? 0;

  return (
    <LanguageSubpageChrome
      title="Export History"
      description=""
      leading={
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      }
    >
      <Card className="overflow-hidden p-6 shadow-sm">
        <ExportHistoryFilters value={filters} onChange={onFiltersChange} />

        <ScrollArea className="h-[calc(100vh-370px)] pr-2">
          <Table className="text-sm">
            {(isLoading || totalCount > 0) && (
              <TableHeader>
                <TableRow>
                  {COLUMNS.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            )}
            <TableBody>
              {isLoading ? (
                Array.from({ length: PAGE_SIZE }).map((_, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {COLUMNS.map((_, colIdx) => (
                      <TableCell key={colIdx}>
                        <Skeleton className="h-6 w-full rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : totalCount === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={COLUMNS.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No Data Found
                  </TableCell>
                </TableRow>
              ) : (
                files.map((item) => (
                  <TableRow key={item.fileId}>
                    <TableCell>{item.fileName || "--"}</TableCell>
                    <TableCell>
                      {item.createDate
                        ? new Date(item.createDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "--"}
                    </TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="inline-flex rounded-sm text-primary hover:opacity-80"
                        onClick={() => void downloadFile(item.fileId)}
                        aria-label={`Download ${item.fileName ?? "file"}`}
                      >
                        <Download className="h-4 w-4 cursor-pointer" />
                      </button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        <div className="mt-4 flex items-center justify-end">
          {!isLoading && data && totalCount > PAGE_SIZE ? (
            <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onChange={setPage} />
          ) : null}
        </div>
      </Card>
    </LanguageSubpageChrome>
  );
}
