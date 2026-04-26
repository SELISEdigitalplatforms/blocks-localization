
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import NewLanguage from "@blocks-localization/components/modals/new-language/new-language";
import {
  useDeleteLanguage,
  useGetLanguages,
  useSetDefaultLanguage,
} from "@blocks-localization/hooks/use-language-manager";
import { ILanguageConfig } from "@blocks-localization/models/language";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { EllipsisVertical, Plus, Star, Trash } from "lucide-react";
import { useState } from "react";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@/store/useProjectStore";

const LoadingSkelton = () => (
  <div className="grid w-full gap-2">
    {Array.from({ length: 10 }).map((_, index) => (
      <Skeleton key={index} className="h-12 w-full rounded-lg" />
    ))}
  </div>
);

function Configure() {
  const [isNewLanguageDialogOpen, setIsNewLanguageDialogOpen] = useState(false);
  const [isMakeDefaultDialogOpen, setIsMakeDefaultDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedLanguageData, setSelectedLanguageData] = useState<string | null>(null);
  const { isLoading: isLanguageListLoading, data: languageListData } = useGetLanguages();
  const { isPending: isDeleteLanguagePending, mutateAsync: deleteAsync } = useDeleteLanguage();
  const { isPending: isSetDefaultPending, mutateAsync: setDefaultAsync } = useSetDefaultLanguage();

  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const makeDefaultModalData = {
    dialogTitle: "Make default language",
    dialogSubtitle: "Are you sure you want to set this language as default?",
    confirmButton: "Save",
    cancelButton: "Cancel",
  };

  const deleteLanguageModalData = {
    dialogTitle: "Delete language",
    dialogSubtitle: "Are you sure you want to delete this language?",
    confirmButton: "Delete",
    cancelButton: "Cancel",
  };

  const onMakeDefaultClick = (languageName: string) => {
    setIsMakeDefaultDialogOpen(true);
    setSelectedLanguageData(languageName);
  };

  const onDeleteLanguageClick = (languageName: string) => {
    setIsDeleteDialogOpen(true);
    setSelectedLanguageData(languageName);
  };

  const onConfirmDelete = async () => {
    try {
      const payload = {
        projectKey: tenantId,
        languageName: selectedLanguageData ?? "",
      };
      const res = await deleteAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Deleted successfully",
        });
        setIsDeleteDialogOpen(false);
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

  const onConfirmMakeDefault = async () => {
    try {
      const payload = {
        projectKey: tenantId,
        languageName: selectedLanguageData ?? "",
      };
      const res = await setDefaultAsync(payload);
      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "Make default successful",
        });
        setIsMakeDefaultDialogOpen(false);
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

  const columns: ColumnDef<ILanguageConfig>[] = [
    // {
    //   accessorKey: "itemId",
    //   header: () => {
    //     return (
    //       <div className="flex items-center">
    //         <span className="font-bold text-medium-emphasis">#</span>
    //       </div>
    //     );
    //   },
    //   cell: ({ row }) => {
    //     return (
    //       <div className="flex w-[120px] items-center">
    //         <span>{row.getValue("itemId")}</span>
    //       </div>
    //     );
    //   },
    // },
    {
      accessorKey: "languageName",
      header: () => {
        return (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Language</span>
          </div>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="flex w-[150px] items-center">
            <span>{row.getValue("languageName")}</span>
            {row.original.isDefault && (
              <Badge color="bg-blocks-primary-500" className="ml-2 w-[100px] rounded-xl">
                Default
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "languageCode",
      header: () => {
        return (
          <div className="flex items-center">
            <span className="font-bold text-medium-emphasis">Language Code</span>
          </div>
        );
      },
      cell: ({ row }) => {
        return (
          <div className="flex w-[180px] items-center">
            <span>{row.getValue("languageCode")}</span>
          </div>
        );
      },
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => {
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-5 w-5 p-0" aria-label="Actions">
                <EllipsisVertical width={20} height={20} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onMakeDefaultClick(row.getValue("languageName"));
                }}
              >
                <Star className="mr-2 h-4 w-4" />
                <span>Make default language</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                className="cursor-pointer text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteLanguageClick(row.getValue("languageName"));
                }}
              >
                <Trash className="mr-2 h-4 w-4" />
                <span>Delete language</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];
  const table = useReactTable({
    data: languageListData || [],
    columns,
    enableRowSelection: false,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  if (isLanguageListLoading) return <LoadingSkelton />;

  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb breadcrumbIndex={2} />
      </div>
      <div className="flex items-end justify-between">
        <h1 className="mt-5 text-2xl font-semibold">Configure Language</h1>
        <Dialog open={isNewLanguageDialogOpen} onOpenChange={setIsNewLanguageDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="default"
              className="h-10 bg-primary text-sm text-primary-foreground"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span className="sr-only sm:not-sr-only">New Language</span>
            </Button>
          </DialogTrigger>
          <NewLanguage onClose={setIsNewLanguageDialogOpen} />
        </Dialog>
      </div>
      <Card className="mt-6 rounded-sm border border-border shadow-none">
        <CardHeader>
          <CardTitle>Languages</CardTitle>
        </CardHeader>
        <CardContent>
          <Table className="text-sm">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="px-4 py-3 hover:bg-transparent">
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id} className="font-bold text-medium-emphasis">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className="cursor-pointer font-normal text-medium-emphasis"
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
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isMakeDefaultDialogOpen} onOpenChange={setIsMakeDefaultDialogOpen}>
        <ConfirmationModal
          onCancel={() => {}}
          onConfirm={onConfirmMakeDefault}
          data={makeDefaultModalData}
          buttonState={{ confirm: { disable: isSetDefaultPending } }}
        />
      </Dialog>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <ConfirmationModal
          onCancel={() => {}}
          onConfirm={onConfirmDelete}
          data={deleteLanguageModalData}
          buttonState={{ confirm: { disable: isDeleteLanguagePending } }}
        />
      </Dialog>
    </div>
  );
}

export { Configure };
