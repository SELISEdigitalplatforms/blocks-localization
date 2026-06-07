import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { EllipsisVertical, Plus, Pencil, Trash } from "lucide-react";
import { useGetGlossaries } from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import AddEditGlossary from "@blocks-localization/components/modals/glossary/add-edit-glossary";
import DeleteGlossary from "@blocks-localization/components/modals/glossary/delete-glossary";
import { langConfigureData } from "@blocks-localization/constants/language-dummy-data";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const GlossaryTable: React.FC = () => {
  const navigate = useNavigate();
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editGlossary, setEditGlossary] = useState<IGlossary | undefined>(
    undefined,
  );
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteGlossary, setDeleteGlossary] = useState<IGlossary | undefined>(
    undefined,
  );
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchText(value);
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPageNumber(0);
    }, 400);
  }, []);

  const { data, isLoading } = useGetGlossaries(
    pageNumber,
    pageSize,
    debouncedSearch,
  );

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
              {langConfigureData.find(
                (lang) => lang.languageCode === row.original.language,
              )?.languageName ?? "-"}
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
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">
              Context
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <div className="max-w-[200px] truncate" title={row.original.context}>
            {row.original.context ?? "-"}
          </div>
        ),
      },
      {
        accessorKey: "additionalNote",
        header: () => (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">
              Additional Note
            </span>
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="max-w-[200px] truncate"
            title={row.original.additionalNote}
          >
            {row.original.additionalNote ?? "-"}
          </div>
        ),
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
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <EllipsisVertical width={20} height={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditClick(row.original);
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                <span>Edit</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="cursor-pointer text-error"
                onClick={(e) => {
                  e.stopPropagation();
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
        <div className="mb-4 px-5">
          <Input
            placeholder="Search glossary..."
            value={searchText}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 w-[300px] text-sm"
          />
        </div>
        <CardContent>
          <div className="w-full overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow
                    key={headerGroup.id}
                    className="px-4 py-3 hover:bg-transparent"
                  >
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        className="font-bold text-medium-emphasis"
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
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
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      className="cursor-pointer font-normal text-medium-emphasis"
                      onClick={() =>
                        navigate(`/services/glossary/${row.original.itemId}`)
                      }
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
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
