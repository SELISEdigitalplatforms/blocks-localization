import { LanguageSubpageChrome } from "@/features/uilm/components/language-subpage-chrome";
import { NewLanguageModal } from "@/features/uilm/components/new-language-modal";
import {
  useUilmDeleteLanguage,
  useUilmLanguages,
  useUilmProjectKey,
  useUilmSetDefaultLanguage,
} from "@/features/uilm/hooks/use-uilm-queries";
import { Badge } from "@/platform/ui/components/badge/badge";
import { Button } from "@/platform/ui/components/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/platform/ui/components/dropdown-menu/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/platform/ui/components/table/table";
import type { ILanguageConfig } from "@/features/uilm/types/language";
import { type ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { EllipsisVertical, Loader2, Plus, Star, Trash } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

export function ConfigurePage() {
  const projectKey = useUilmProjectKey();
  const { data: langs, isLoading } = useUilmLanguages();
  const delLang = useUilmDeleteLanguage();
  const setDef = useUilmSetDefaultLanguage();

  const [isNewLangOpen, setIsNewLangOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDefaultOpen, setIsDefaultOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);

  const onDeleteClick = (languageName: string) => {
    setSelectedLang(languageName);
    setIsDeleteOpen(true);
  };

  const onMakeDefaultClick = (languageName: string) => {
    setSelectedLang(languageName);
    setIsDefaultOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedLang || !projectKey) return;
    try {
      const res = await delLang.mutateAsync({ languageName: selectedLang, projectKey });
      if (res?.isSuccess) {
        setIsDeleteOpen(false);
        setSelectedLang(null);
      }
    } catch {
      // Error handled by hook
    }
  };

  const confirmMakeDefault = async () => {
    if (!selectedLang || !projectKey) return;
    try {
      const res = await setDef.mutateAsync({ languageName: selectedLang, projectKey });
      if (res?.isSuccess) {
        setIsDefaultOpen(false);
        setSelectedLang(null);
      }
    } catch {
      // Error handled by hook
    }
  };

  const columns = useMemo<ColumnDef<ILanguageConfig>[]>(
    () => [
      {
        accessorKey: "languageName",
        header: () => <span className="font-bold text-high-emphasis">Language</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span>{row.getValue("languageName")}</span>
            {row.original.isDefault && (
              <Badge className="bg-primary text-primary-foreground hover:bg-primary">Default</Badge>
            )}
          </div>
        ),
      },
      {
        accessorKey: "languageCode",
        header: () => <span className="font-bold text-high-emphasis">Language Code</span>,
        cell: ({ row }) => <span>{row.getValue("languageCode")}</span>,
      },
      {
        id: "actions",
        header: () => null,
        cell: ({ row }) => {
          const languageName = row.getValue("languageName") as string;
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Actions">
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMakeDefaultClick(languageName);
                    }}
                  >
                    <Star className="mr-2 h-4 w-4" />
                    <span>Make default language</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteClick(languageName);
                    }}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    <span>Delete language</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: langs ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (!projectKey) {
    return (
      <LanguageSubpageChrome title="Configure" description="Configure Language">
        <div className="rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
          <p className="mb-2">No UILM project is configured.</p>
          <p>
            Pick a project in the console header, set{" "}
            <code className="rounded bg-muted px-1">NEXT_PUBLIC_UILM_PROJECT_KEY</code>, or{" "}
            <Link to="/services/language/configure" className="font-medium text-primary hover:underline">
              open Configure
            </Link>{" "}
            and enter the tenant id.
          </p>
        </div>
      </LanguageSubpageChrome>
    );
  }

  return (
    <LanguageSubpageChrome title="Configure" description="Configure Language">
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-high-emphasis">Configure Language</h1>
        <Button size="sm" onClick={() => setIsNewLangOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Language
        </Button>
      </div>

      <Card className="mt-4 rounded-sm border border-border shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">Languages</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id} className="hover:bg-transparent">
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="font-bold text-high-emphasis">
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} className="text-medium-emphasis">
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <NewLanguageModal
        open={isNewLangOpen}
        onOpenChange={setIsNewLangOpen}
        projectKey={projectKey}
        existingLanguageCodes={langs?.map((l) => l.languageCode) ?? []}
      />

      {/* Make Default Confirmation */}
      <Dialog open={isDefaultOpen} onOpenChange={setIsDefaultOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make default language</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to set <strong>{selectedLang}</strong> as default?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDefaultOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmMakeDefault} disabled={setDef.isPending}>
              {setDef.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete language</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete <strong>{selectedLang}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={delLang.isPending}>
              {delLang.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LanguageSubpageChrome>
  );
}
