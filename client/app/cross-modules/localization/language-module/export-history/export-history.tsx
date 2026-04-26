
import React, { useState } from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { useProjectStore } from "@/store/useProjectStore";
import { useGetExportHistory } from "@blocks-localization/hooks/use-language-manager";
import { IExportFileDetails } from "@blocks-localization/models/language";
import { ArrowLeft, Download } from "lucide-react";
import { ExportHistoryFilters } from "./export-history-filters";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { useGetFilesDownload } from "@blocks-storage/hooks/use-storage-file";
import { flushSync } from "react-dom";

export const ExportHistory: React.FC = () => {
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";

  // Filters
  const [filters, setFilters] = useState<{
    searchText?: string;
    startDate?: string;
    endDate?: string;
  }>({ searchText: "", startDate: "", endDate: "" });

  // Pagination
  const [pageNumber, setPageNumber] = useState<number>(0);
  const [pageSize] = useState<number>(10);

  // Format dates properly for API
  const formattedStartDate = filters.startDate ? filters.startDate : "";

  const formattedEndDate = filters.endDate
    ? (() => {        const dateStr = filters.endDate.split("T")[0];
        return `${dateStr}T23:59:59.999Z`;
      })()
    : filters.startDate
    ? (() => {
        const dateStr = filters.startDate.split("T")[0];
        return `${dateStr}T23:59:59.999Z`;
      })()
    : "";

  const { data: exportHistoryData, isLoading: isLoadingExportHistory } = useGetExportHistory(
    pageNumber,
    pageSize,
    projectKey,
    {
      searchText: filters.searchText,
      startDate: formattedStartDate,
      endDate: formattedEndDate,
    },
  );

  const [downloadMeta, setDownloadMeta] = useState<{ fileId: string; projectKey: string }>({
    fileId: "",
    projectKey,
  });

  const { refetch } = useGetFilesDownload(downloadMeta, { enabled: false });

  const downloadSelectedFile = async (fileId: string) => {
    // force React to apply the new meta immediately
    flushSync(() => {
      setDownloadMeta({ fileId, projectKey });
    });

    // now refetch uses the updated meta inside the hook
    const { data: result } = await refetch();

    const url = result?.url;
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.download = result?.name || "";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const columns = ["File Name", "Date", "Download"];
  const totalCount = exportHistoryData?.totalCount ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <PageBreadcrumb breadcrumbIndex={2} />

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="h-8 p-0" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Export History</h1>
      </div>

      <Card>
        {/* Filters */}
        <ExportHistoryFilters
          onChange={(next) => {
            setFilters({
              searchText: next.search ?? "",
              startDate: next.startDate ?? "",
              endDate: next.endDate ?? "",
            });
            setPageNumber(0);
          }}
        />

        {/* Table */}
        <ScrollArea className="h-[calc(100vh-370px)] pr-2">
          <Table className="text-sm">
            {/* Show header when loading or when there is data; hide if empty */}
            {(isLoadingExportHistory || totalCount > 0) && (
              <TableHeader>
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c}>{c}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
            )}

            <TableBody>
              {isLoadingExportHistory ? (
                // Loading: skeleton rows, one cell per column
                Array.from({ length: pageSize }).map((_, rowIdx) => (
                  <TableRow key={rowIdx}>
                    {columns.map((_, colIdx) => (
                      <TableCell key={colIdx}>
                        <Skeleton className="h-6 w-full rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : totalCount === 0 ? (
                // Empty
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No Data Found
                  </TableCell>
                </TableRow>
              ) : (
                // Data
                exportHistoryData?.uilmExportedFiles?.map((item: IExportFileDetails) => (
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
                      <Download
                        className="cursor-pointer"
                        onClick={() => downloadSelectedFile(item.fileId)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {/* Pagination Footer */}
        <div className="mt-4 flex items-center justify-end">
          {!isLoadingExportHistory && exportHistoryData && totalCount > pageSize && (
            <Pagination
              page={pageNumber}
              pageSize={pageSize}
              totalCount={totalCount}
              onChange={(page: number) => setPageNumber(page)}
            />
          )}
        </div>
      </Card>
    </div>
  );
};
