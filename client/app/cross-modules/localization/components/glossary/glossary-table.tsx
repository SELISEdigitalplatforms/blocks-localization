import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os/hooks";
import { EllipsisVertical, Plus, Pencil, Trash } from "lucide-react";
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Button } from "@/components/ui-kits/button/button";
import { FilterControls } from "@/components/filter-toolbar";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useGetGlossaries } from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import AddEditGlossary from "@blocks-localization/components/modals/glossary/add-edit-glossary";
import DeleteGlossary from "@blocks-localization/components/modals/glossary/delete-glossary";
import { langConfigureData } from "@blocks-localization/constants/language-dummy-data";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const getOptionalCellText = (value?: string | null) => value?.trim() || "-";

const ContextHeader = () => (
  <div className="flex items-center">
    <span className="font-bold text-medium-emphasis">Context</span>
  </div>
);

const AdditionalNoteHeader = () => (
  <div className="flex items-center">
    <span className="font-bold text-medium-emphasis">Additional Note</span>
  </div>
);

const ActionsHeader = () => (
  <div className="flex items-center">
    <span className="font-bold text-medium-emphasis">Actions</span>
  </div>
);

function renderContextCell(row: { original: IGlossary }) {
  const context = getOptionalCellText(row.original.context);
  return (
    <div className="max-w-[200px] truncate" title={context === "-" ? undefined : context}>
      {context}
    </div>
  );
}

function renderAdditionalNoteCell(row: { original: IGlossary }) {
  const additionalNote = getOptionalCellText(row.original.additionalNote);
  return (
    <div
      className="max-w-[200px] truncate"
      title={additionalNote === "-" ? undefined : additionalNote}
    >
      {additionalNote}
    </div>
  );
}

function GlossaryEmptyState({ searchQuery }: Readonly<{ searchQuery: string }>) {
  if (searchQuery) {
    return (
      <output className="flex flex-col items-center gap-2 py-4">
        <p className="font-medium text-high-emphasis">No matching glossaries</p>
        <p className="text-muted-foreground">
          No glossaries match &ldquo;{searchQuery}&rdquo;. Try a different search.
        </p>
      </output>
    );
  }

  return (
    <output className="flex flex-col items-center gap-2 py-4">
      <p className="font-medium text-high-emphasis">No glossaries yet</p>
      <p className="text-muted-foreground">
        Glossaries help keep terminology consistent across translations.
      </p>
    </output>
  );
}

const GlossaryTable = () => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editGlossary, setEditGlossary] = useState<IGlossary | undefined>(undefined);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteGlossary, setDeleteGlossary] = useState<IGlossary | undefined>(undefined);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value.trim());
    setPageNumber(0);
  }, []);

  const { data, isLoading } = useGetGlossaries(pageNumber, pageSize, searchText);

  const handleEditClick = useCallback((glossary: IGlossary) => {
    setEditGlossary(glossary);
    setEditModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((glossary: IGlossary) => {
    setDeleteGlossary(glossary);
    setDeleteModalOpen(true);
  }, []);

  const columns = useMemo<ColumnDef<IGlossary>[]>(
    () => [
      {
        accessorKey: "name",
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Name</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex w-[150px] items-center">
            <span>{row.original.name}</span>
          </div>
        ),
      },
      {
        accessorKey: "language",
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Language</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span>
              {langConfigureData.find((lang) => lang.languageCode === row.original.language)
                ?.languageName ?? "-"}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "type",
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Type</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span>{row.original.type ?? "-"}</span>
          </div>
        ),
      },
      {
        accessorKey: "context",
        header: ContextHeader,
        cell: ({ row }) => renderContextCell(row),
      },
      {
        accessorKey: "additionalNote",
        header: AdditionalNoteHeader,
        cell: ({ row }) => renderAdditionalNoteCell(row),
      },
      {
        accessorKey: "createDate",
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Created</span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="flex items-center">
            <span>
              {row.original.createDate
                ? new Date(row.original.createDate).toLocaleDateString()
                : "-"}
            </span>
          </div>
        ),
      },
      {
        id: "actions",
        enableHiding: false,
        header: ActionsHeader,
        cell: ({ row }) => (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              asChild
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Button variant="ghost" className="h-8 w-8 p-0">
                <EllipsisVertical width={20} height={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                  e.preventDefault();
                  handleEditClick(row.original);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-error"
                onClick={(e) => {
                  e.preventDefault();
                  handleDeleteClick(row.original);
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                <span>Delete</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [handleEditClick, handleDeleteClick],
  );

  const table = useReactTable({
    data: data?.items ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: Math.ceil((data?.totalCount ?? 0) / pageSize),
  });
  const isUnfilteredEmpty = !isLoading && searchText.length === 0 && (data?.totalCount ?? 0) === 0;
  const tableRows = table.getRowModel().rows;
  const hasTableRows = tableRows.length > 0;

  return (
    <div>
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Glossary Management</h1>
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="default"
              className="h-10 bg-primary text-sm text-primary-foreground"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span className="sr-only sm:not-sr-only">New Glossary</span>
            </Button>
          </DialogTrigger>
          <AddEditGlossary onClose={() => setAddModalOpen(false)} isOpen={addModalOpen} />
        </Dialog>
      </div>

      <Card className="mt-6 rounded-sm border border-border shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-xl text-high-emphasis">
            Glossary
          </CardTitle>
        </CardHeader>
        {!isUnfilteredEmpty && (
          <div className="mb-4 w-full sm:w-[300px]">
            <FilterControls.SearchInput
              placeholder="Search glossary..."
              value={searchText}
              onChange={handleSearchChange}
              className="h-9 w-full"
            />
          </div>
        )}
        <CardContent>
          {isUnfilteredEmpty ? (
            <div className="flex h-40 items-center justify-center text-center">
              <GlossaryEmptyState searchQuery="" />
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id} className="px-4 py-3 hover:bg-transparent">
                      {headerGroup.headers.map((header) => (
                        <TableHead key={header.id} className="font-bold text-medium-emphasis">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 10 }).map((_, index) => (
                      <TableRow key={index}>
                        {columns.map((_, colIndex) => (
                          <TableCell key={colIndex}>
                            <Skeleton className="h-6 w-full rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : hasTableRows ? (
                    tableRows.map((row) => (
                      <TableRow
                        key={row.id}
                        isHoverable
                        className="font-normal text-medium-emphasis"
                        onClick={() => navigate(scoped(`services/glossary/${row.original.itemId}`))}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="h-40 text-center">
                        <GlossaryEmptyState searchQuery={searchText} />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {!isLoading && (data?.totalCount ?? 0) > pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              page={pageNumber}
              pageSize={pageSize}
              totalCount={data?.totalCount ?? 0}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onChange={setPageNumber}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPageNumber(0);
              }}
            />
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        {editModalOpen && editGlossary && (
          <AddEditGlossary
            glossary={editGlossary}
            onClose={() => {
              setEditModalOpen(false);
              setEditGlossary(undefined);
            }}
          />
        )}
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        {deleteModalOpen && deleteGlossary && (
          <DeleteGlossary
            itemId={deleteGlossary.itemId}
            glossaryName={deleteGlossary.name}
            onClose={() => {
              setDeleteModalOpen(false);
              setDeleteGlossary(undefined);
            }}
          />
        )}
      </Dialog>
    </div>
  );
};

export default GlossaryTable;
