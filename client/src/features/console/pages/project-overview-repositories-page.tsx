import { mainAppPath } from "@/features/console/lib/main-app-url";
import { useIdentifierAssets } from "@/features/console/hooks/use-identifier-assets";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import type { IResource } from "@/features/console/model/resource";
import { Button } from "@/platform/ui/components/button/button";
import { Card, CardContent, CardHeader } from "@/platform/ui/components/card/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import { Input } from "@/platform/ui/components/input/input";
import { Pagination } from "@/platform/ui/components/pagination/pagination";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/ui/components/table/table";
import { PageMeta } from "@/seo/page-meta";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Github, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export function ProjectOverviewRepositoriesPage() {
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const [page, setPage] = useState(0);
  const pageSize = 12;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search), 500);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  const { data: resourcesResponse, isLoading, isFetching } = useIdentifierAssets(
    groupId,
    page,
    pageSize,
    debouncedSearch,
  );

  const columns = useMemo<ColumnDef<IResource>[]>(
    () => [
      {
        id: "name",
        accessorFn: (row) => row.name.trim(),
        header: () => (
          <span className="text-xs font-bold uppercase tracking-wide text-medium-emphasis">Name</span>
        ),
        cell: (ctx) => <div className="truncate font-medium">{ctx.row.original.name}</div>,
      },
      {
        id: "link",
        accessorFn: (row) => row.link.trim(),
        header: () => (
          <span className="text-xs font-bold uppercase tracking-wide text-medium-emphasis">Repo Link</span>
        ),
        cell: (ctx) => (
          <button
            type="button"
            className="max-w-md truncate text-left text-primary hover:underline"
            onClick={() => window.open(ctx.row.original.link, "_blank", "noopener,noreferrer")}
          >
            {ctx.row.original.link}
          </button>
        ),
      },
      {
        id: "source",
        header: () => (
          <span className="text-xs font-bold uppercase tracking-wide text-medium-emphasis">Source</span>
        ),
        cell: () => (
          <div className="flex flex-row items-center gap-2">
            <Github className="h-4 w-4 shrink-0" />
            <span>Github</span>
          </div>
        ),
      },
    ],
    [],
  );

  const rows = resourcesResponse?.assets?.resources ?? [];
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const totalCount = resourcesResponse?.totalCount ?? 0;
  const showPagination = !isLoading && totalCount > pageSize;
  const loadingRows = isFetching;

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 p-6 md:gap-6">
      <PageMeta title="Repositories" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold md:text-xl">Repositories</h1>
        <Button
          size="sm"
          variant="default"
          className="h-10 text-sm text-primary-foreground"
          type="button"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add
        </Button>
      </div>

      <Card className="border border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-10 pl-9"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search repositories"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {table.getHeaderGroups().map((hg) =>
                  hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  )),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingRows
                ? Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {columns.map((_, colIndex) => (
                        <TableCell key={colIndex}>
                          <Skeleton className={`h-6 ${colIndex === 2 ? "w-24" : "w-full"}`} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : !rows.length
                  ? (
                      <TableRow>
                        <TableCell
                          colSpan={columns.length}
                          className="h-24 text-center text-sm text-muted-foreground md:text-base"
                        >
                          No repositories found. Add a repository to get started.
                        </TableCell>
                      </TableRow>
                    )
                  : table.getRowModel().rows.map((row) => (
                      <TableRow key={row.id} className="text-sm">
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
            </TableBody>
          </Table>
          {showPagination ? (
            <div className="mt-5 flex flex-col items-center gap-4 md:flex-row md:justify-end">
              <Pagination
                page={page}
                onChange={setPage}
                totalCount={totalCount}
                pageSize={pageSize}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Connect a repository</DialogTitle>
            <DialogDescription>
              GitHub authorization and repository selection run in the main Blocks app. Continue there to add a repo.
            </DialogDescription>
          </DialogHeader>
          <Button asChild className="w-full sm:w-auto">
            <a href={mainAppPath("/project-overview/repositories")} target="_blank" rel="noreferrer">
              Open in Blocks
            </a>
          </Button>
        </DialogContent>
      </Dialog>
    </main>
  );
}
