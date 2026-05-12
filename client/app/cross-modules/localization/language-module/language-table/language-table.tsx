
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import {
  LanguageTableToolbar,
  useKeysFilterQueryParams,
  useKeysSortQueryParams,
} from "@blocks-localization/components/language-table-toolbar/language-table-toolbar";
import AutoTranslate from "@blocks-localization/components/modals/auto-translate/auto-translate";
import ExportKey from "@blocks-localization/components/modals/export-key/export-key";
import {
  useDeleteLanguageKey,
  useGenerateUilmFile,
  useGetBlocksLanguageKey,
  useGetLanguageModules,
  useGetLanguages,
} from "@blocks-localization/hooks/use-language-manager";
import { IBlocksLanguageKey } from "@blocks-localization/models/language";
import { useLanguageViewStore } from "@blocks-localization/store/use-language-view-store";
import { ColumnDef, Row, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import {
  AlignLeft,
  EllipsisVertical,
  FolderInput,
  FolderOutput,
  History,
  Plus,
  Rocket,
  Settings2,
  Trash,
  Wand,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryState } from "nuqs";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import ImportFileModal from "../../components/import-language-file/import-file-modal";
import LocalizationTimeline from "../localization-timeline/localization-timeline";
import { useProjectStore } from "@/store/useProjectStore";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { toast } from "@/hooks/use-toast";
import { FilterControls } from "@/components/filter-toolbar";

// Stable memoized components to avoid Radix Popper onAnchorChange infinite loop
const KeyNameCell = React.memo(({ keyName }: { keyName: string }) => {
  const CHAR_WIDTH = 7.5;
  const PADDING = 8;
  const CONTAINER = 150;
  const shouldShowTooltip = keyName.length * CHAR_WIDTH + PADDING > CONTAINER;

  return (
    <TooltipProvider key={keyName}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="ml-2 w-[150px] truncate sm:ml-0 md:w-[200px]">{keyName}</div>
        </TooltipTrigger>
        {shouldShowTooltip && (
          <TooltipContent side="top">
            <p>{keyName}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
});
KeyNameCell.displayName = "KeyNameCell";

const RowActionsCell = React.memo(
  ({ onView, onDelete }: { onView: () => void; onDelete: () => void }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-5 w-5 p-0">
          <EllipsisVertical width={20} height={20} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem className="cursor-pointer" onClick={onView}>
          <AlignLeft className="mr-2 h-4 w-4" />
          <span>View details</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer text-error"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash className="mr-2 h-4 w-4" />
          <span>Delete key</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ),
);
RowActionsCell.displayName = "RowActionsCell";

export function LanguageTable() {
  const {
    selectedLanguages,
    setSelectedLanguages,
    toggleLanguage: toggleLanguageInStore,
    selectedOptionalColumns,
    toggleOptionalColumn,
    resetSelectedLanguages,
    isHydrated,
  } = useLanguageViewStore();
  const { queryParams, setQueryParams } = useKeysFilterQueryParams();
  const { sortQueryParams, setSortQueryParams, reset: sortReset } = useKeysSortQueryParams();

  const selectedLanguagesRef = useRef(selectedLanguages);
  selectedLanguagesRef.current = selectedLanguages;

  const resourceSearchMap: Record<string, string> = useMemo(() => {
    if (!queryParams.resourceSearch) return {};
    try {
      return JSON.parse(queryParams.resourceSearch);
    } catch {
      return {};
    }
  }, [queryParams.resourceSearch]);

  const resourceSearchFilters = useMemo(() => {
    return Object.entries(resourceSearchMap)
      .filter(([, searchText]) => searchText.trim() !== "")
      .map(([culture, searchText]) => ({ culture, searchText }));
  }, [resourceSearchMap]);

  const updateResourceSearch = useCallback(
    (culture: string, searchText: string) => {
      setQueryParams((prev) => {
        let current: Record<string, string> = {};
        try {
          current = prev.resourceSearch ? JSON.parse(prev.resourceSearch) : {};
        } catch {
          current = {};
        }
        const updated = { ...current, [culture]: searchText };
        // Remove empty entries
        Object.keys(updated).forEach((key) => {
          if (!updated[key]) delete updated[key];
        });
        return {
          ...prev,
          resourceSearch: Object.keys(updated).length > 0 ? JSON.stringify(updated) : "",
          pageNumber: 0,
        };
      });
    },
    [setQueryParams],
  );

  const keySearch = queryParams.search || "";

  const updateKeySearch = useCallback(
    (value: string) => {
      setQueryParams((prev) => ({
        ...prev,
        search: value,
        pageNumber: 0,
      }));
    },
    [setQueryParams],
  );

  const { isLoading, data: blocksLanguageKeyData } = useGetBlocksLanguageKey(
    queryParams.pageNumber ?? 0,
    queryParams.pageSize ?? 10,
    queryParams.search ?? "",
    queryParams.moduleIds ?? [],
    false,
    sortQueryParams.property
      ? sortQueryParams.property === "keyName"
        ? "Key"
        : sortQueryParams.property
      : "",
    sortQueryParams.isDescending,
    queryParams.createStartDate || queryParams.createEndDate
      ? {
          startDate: queryParams.createStartDate || "",
          endDate: queryParams.createEndDate
            ? new Date(
                new Date(queryParams.createEndDate as string).getTime() + 86400000,
              ).toISOString()
            : "",
        }
      : undefined,
    queryParams.lastUpdateStartDate || queryParams.lastUpdateEndDate
      ? {
          startDate: queryParams.lastUpdateStartDate || "",
          endDate: queryParams.lastUpdateEndDate
            ? new Date(
                new Date(queryParams.lastUpdateEndDate as string).getTime() + 86400000,
              ).toISOString()
            : "",
        }
      : undefined,
    resourceSearchFilters.length > 0 ? resourceSearchFilters : undefined,
    queryParams.missingLanguages ?? [],
  );

  const { isLoading: isLanguageModulesLoading, data: languageModules } = useGetLanguageModules();
  const { data: languageListData } = useGetLanguages();

  const navigate = useNavigate();
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isAutoTranslateDialogOpen, setIsAutoTranslateDialogOpen] = useState(false);
  const [tabId, setTabId] = useQueryState("languageActivity", { defaultValue: "keys" });
  const { isPending, mutateAsync } = useGenerateUilmFile();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isPublishChangesDialogOpen, setIsPublishChangesDialogOpen] = useState(false);
  const [selectedLanguageKeyId, setSelectedLanguageKeyId] = useState<string | null>(null);
  const { isPending: isDeleteLanguageKeyPending, mutateAsync: deleteAsync } =
    useDeleteLanguageKey();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  // Reset all filters and view state when the project changes
  // Only reset if this is NOT the initial mount and store is hydrated
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    // Skip reset on initial mount or if store is not yet hydrated
    if (isInitialMountRef.current || !isHydrated) {
      isInitialMountRef.current = false;
      return;
    }
    // Only reset if tenantId actually has a value
    if (tenantId) {
      setQueryParams(null);
      resetSelectedLanguages();
      sortReset();
    }
  }, [tenantId, isHydrated, setQueryParams, resetSelectedLanguages, sortReset]);

  const deleteLanguageKeyModalData = {
    dialogTitle: "Delete language key?",
    dialogSubtitle: "Are you sure you want to delete this language key?",
    confirmButton: "Delete",
    cancelButton: "Cancel",
  };

  const publishChangesModalData = {
    dialogTitle: "Publish changes?",
    dialogSubtitle: "Are you sure you want to publish the changes?",
    confirmButton: "Publish",
    cancelButton: "Cancel",
  };

  const onDeleteClick = (itemId: string) => {
    setIsDeleteDialogOpen(true);
    setSelectedLanguageKeyId(itemId);
  };

  const onPublishChangesClick = () => {
    setIsPublishChangesDialogOpen(true);
  };

  const onConfirmDelete = async () => {
    try {
      const payload = {
        projectKey: tenantId,
        itemId: selectedLanguageKeyId ?? "",
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

  // Track if this is the initial load to preserve user-persisted selections
  const isInitialLoadRef = useRef(true);

  // Sync selectedLanguages with the available languages for the current project.
  // Also runs on tenantId change to reset stale language codes from the previous project.
  // Only resets to defaults on initial load if user has no persisted selection.
  // Wait for store to hydrate from localStorage before applying any logic.
  useEffect(() => {
    if (!languageListData || !isHydrated) return;

    const current = selectedLanguagesRef.current;
    const availableLanguageCodes = languageListData.map((lang) => lang.languageCode);
    const validSelectedLanguages = current.filter((langCode) =>
      availableLanguageCodes.includes(langCode),
    );

    // Only reset to defaults if:
    // 1. This is initial load with no selection (current.length === 0) - user hasn't set preferences yet
    // 2. OR there are invalid language codes from a different project (stale codes)
    // Do NOT reset if user has explicitly deselected all languages (valid empty selection)
    if (
      (isInitialLoadRef.current && current.length === 0) ||
      validSelectedLanguages.length !== current.length
    ) {
      const defaultLanguages = languageListData
        .filter((lang) => lang.isDefault)
        .map((lang) => lang.languageCode);
      setSelectedLanguages(defaultLanguages.length > 0 ? defaultLanguages : availableLanguageCodes);
    }

    // After first run, mark that initial load is complete so we don't override user preferences
    isInitialLoadRef.current = false;
  }, [languageListData, setSelectedLanguages, tenantId, isHydrated]);

  const handleRowClick = useCallback(
    (keyId: number | string) => {
      navigate(`/services/language/translations/${keyId}`);
    },
    [navigate],
  );

  const onPageChangeHandler = (pageNumber: number) => {
    setQueryParams((prev) => ({
      ...prev,
      pageNumber,
    }));
  };

  const columns = useMemo<ColumnDef<IBlocksLanguageKey>[]>(
    () => [
      {
        accessorKey: "keyName",
        header: () => (
          <div className="w-[300px] md:w-[200px]">
            <FilterControls.SortHeader
              label="Key"
              id="KeyName"
              value={sortQueryParams}
              onChange={setSortQueryParams}
            />
          </div>
        ),
        cell: ({ row }) => {
          const keyName = row.getValue("keyName") as string;
          return <KeyNameCell keyName={keyName} />;
        },
      },
      {
        accessorKey: "moduleId",
        header: "Module",
        cell: ({ row }) => {
          const keyModule = languageModules?.find(
            (module) => module.itemId === row.getValue("moduleId"),
          );

          if (!keyModule) {
            return null;
          }
          return (
            <div className="ml-2 truncate sm:ml-0 sm:w-[150px]">
              <span>{keyModule.moduleName}</span>
            </div>
          );
        },
        filterFn: (row, id, filterValue: { text?: string; types?: string[] }) => {
          return filterValue.types ? filterValue.types.includes(row.getValue(id)) : true;
        },
      },
      ...(selectedOptionalColumns.includes("completeness")
        ? [
            {
              accessorKey: "resources",
              header: () => <span>Completeness</span>,
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => {
                const resources = row.original.resources;
                if (!resources || resources.length === 0) return "No translation";
                const translatedLanguages = resources.map((resource) => resource.culture);
                const allLanguages = languageListData?.map((lang) => lang.languageCode) || [];
                const isComplete = allLanguages.every((lang) => translatedLanguages.includes(lang));
                return isComplete ? "Complete" : "Partial";
              },
              enableHiding: true,
            } as ColumnDef<IBlocksLanguageKey>,
          ]
        : []),
      ...selectedLanguages.map((lang) => ({
        accessorKey: `resources.${lang}`,
        header: () => (
          <div className="w-[300px] md:w-[200px]">
            <div className="font-bold text-medium-emphasis">
              {languageListData?.find((language) => language.languageCode === lang)?.languageName ??
                lang}{" "}
              {languageListData?.find((language) => language.languageCode === lang)?.isDefault
                ? "(Default)"
                : null}
            </div>
          </div>
        ),
        cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => {
          const resource = row.original.resources?.find((res) => res.culture === lang);
          return <div className="ml-2 line-clamp-4 sm:ml-0">{resource?.value ?? ""}</div>;
        },
      })),

      ...(selectedOptionalColumns.includes("createDate")
        ? [
            {
              accessorKey: "createDate",
              header: () => <span>Created Date</span>,
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => {
                const dateValue = row.original.createDate;
                if (!dateValue) return <div className="ml-2 sm:ml-0 sm:w-[150px]">—</div>;
                const formatted = new Date(dateValue).toLocaleDateString();
                return <div className="ml-2 sm:ml-0 sm:w-[150px]">{formatted}</div>;
              },
              enableHiding: true,
            } as ColumnDef<IBlocksLanguageKey>,
          ]
        : []),
      ...(selectedOptionalColumns.includes("lastUpdateDate")
        ? [
            {
              accessorKey: "lastUpdateDate",
              header: () => <span>Last Updated Date</span>,
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => {
                const dateValue = row.original.lastUpdateDate;
                if (!dateValue) return <div className="ml-2 sm:ml-0 sm:w-[150px]">—</div>;
                const formatted = new Date(dateValue).toLocaleDateString();
                return <div className="ml-2 sm:ml-0 sm:w-[150px]">{formatted}</div>;
              },
              enableHiding: true,
            } as ColumnDef<IBlocksLanguageKey>,
          ]
        : []),
      {
        id: "actions",
        enableHiding: false,
        cell: ({ row }) => {
          return (
            <RowActionsCell
              onView={() => handleRowClick(row.original.itemId)}
              onDelete={() => onDeleteClick(row.original.itemId)}
            />
          );
        },
      },
    ],
    [
      handleRowClick,
      languageListData,
      languageModules,
      selectedLanguages,
      selectedOptionalColumns,
      sortQueryParams,
      setSortQueryParams,
    ],
  );

  const tableData = useMemo(() => {
    return blocksLanguageKeyData?.keys || [];
  }, [blocksLanguageKeyData]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleExportClick = () => {
    setIsExportDialogOpen(true);
  };

  const handleImportClick = () => {
    setIsImportDialogOpen(true);
  };

  const toggleLanguage = (language: string) => {
    toggleLanguageInStore(language);
  };

  const handleAutoTranslateClick = () => {
    setIsAutoTranslateDialogOpen(true);
  };

  useEffect(() => {
    if (tabId === "history") {
      setQueryParams(null);
      sortReset();
    }
  }, [tabId, setQueryParams, sortReset]);

  const selectAll = () => {
    setSelectedLanguages(
      selectedLanguages.length === languageListData?.length
        ? []
        : languageListData?.map((lang) => lang.languageCode) || [],
    );
  };

  async function generateUilmFiles() {
    try {
      const res = await mutateAsync({ guid: uuidv4(), projectKey: tenantId });

      if (res?.isSuccess) {
        toast({
          variant: "success",
          title: "Success",
          description: "File generation is in progress.",
        });
        setIsPublishChangesDialogOpen(false);
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
  }

  return (
    <main className="flex flex-col">
      <div className="flex w-full flex-col">
        <div className="flex w-full justify-between text-high-emphasis">
          <div className="item-center flex gap-2">
            <h3 className="text-2xl font-bold tracking-tight">Configure keys</h3>
          </div>
        </div>
        <Tabs value={tabId} className="mt-[18px] flex w-full flex-col md:mt-[24px]">
          <div className="mb-5 flex items-center text-base">
            <TabsList className="h-[42px] bg-blocks-primary-shades-300">
              <TabsTrigger onClick={() => setTabId("keys")} value="keys" className="h-8">
                Translation Keys
              </TabsTrigger>
              <TabsTrigger onClick={() => setTabId("history")} value="history" className="h-8">
                History
              </TabsTrigger>
            </TabsList>
            {tabId === "keys" ? (
              <div className="ml-auto flex items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-10 p-0">
                      <EllipsisVertical width={20} height={20} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="cursor-pointer" onSelect={handleImportClick}>
                      <FolderInput className="mr-2 h-4 w-4" />
                      <span>Import keys</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onSelect={handleExportClick}>
                      <FolderOutput className="mr-2 h-4 w-4" />
                      <span>Export keys</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onSelect={() => navigate("/services/language/export-history")}
                    >
                      <History className="mr-2 h-4 w-4" />
                      <span>Export History</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                  <ImportFileModal
                    dialogTitle="Import Keys"
                    data={[]}
                    projectKey={tenantId}
                    onClose={() => setIsImportDialogOpen(false)}
                  />
                </Dialog>
                <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                  <ExportKey onClose={() => setIsExportDialogOpen(false)} />
                </Dialog>
                <Button
                  onClick={onPublishChangesClick}
                  size="default"
                  variant="outline"
                  className="shadow-none"
                >
                  <Rocket className="h-5 w-5 lg:mr-2" />
                  <span className="sr-only lg:not-sr-only">Publish Changes</span>
                </Button>
                <Button
                  size="default"
                  variant="default"
                  className="bg-primary text-primary-foreground shadow-none"
                  onClick={() => navigate("/services/language/translations/new-key")}
                >
                  <Plus className="h-5 w-5 lg:mr-2" />
                  <span className="sr-only lg:not-sr-only">New Key</span>
                </Button>
              </div>
            ) : (
              <div className="ml-auto flex items-center gap-2"></div>
            )}
          </div>
          <TabsContent value="keys">
            <Card className="rounded shadow-none">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl text-high-emphasis">
                  Translations
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="default"
                    variant="default"
                    onClick={handleAutoTranslateClick}
                  >
                    <Wand className="h-5 w-5 lg:mr-2" />
                    <span className="sr-only lg:not-sr-only">Auto-translate all</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline">
                        <Settings2 className="h-4 w-4 lg:mr-2" />
                        <span className="sr-only lg:not-sr-only">View</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="terms"
                            checked={selectedLanguages.length === languageListData?.length}
                            onCheckedChange={selectAll}
                          />
                          <label htmlFor="terms">Languages</label>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuSeparator />
                      {languageListData?.map((language) => (
                        <DropdownMenuCheckboxItem
                          key={language.languageCode}
                          checked={selectedLanguages.includes(language.languageCode)}
                          onCheckedChange={() => toggleLanguage(language.languageCode)}
                        >
                          {language.languageName}
                        </DropdownMenuCheckboxItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuCheckboxItem
                        checked={selectedOptionalColumns.includes("completeness")}
                        onCheckedChange={() => toggleOptionalColumn("completeness")}
                      >
                        Completeness
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={selectedOptionalColumns.includes("createDate")}
                        onCheckedChange={() => toggleOptionalColumn("createDate")}
                      >
                        Created Date
                      </DropdownMenuCheckboxItem>
                      <DropdownMenuCheckboxItem
                        checked={selectedOptionalColumns.includes("lastUpdateDate")}
                        onCheckedChange={() => toggleOptionalColumn("lastUpdateDate")}
                      >
                        Last Updated Date
                      </DropdownMenuCheckboxItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <div className="mb-4">
                {isLanguageModulesLoading ? (
                  <Skeleton className="h-12 w-full rounded" />
                ) : (
                  <LanguageTableToolbar languageModulesData={languageModules || []} languagesData={languageListData || []} />
                )}
              </div>
              <CardContent>
                <div className="w-full overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id} className="border-none hover:bg-transparent">
                          {headerGroup.headers.map((header) => (
                            <TableHead
                              key={header.id}
                              className="h-0 align-top font-bold text-medium-emphasis"
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </TableHead>
                          ))}
                        </TableRow>
                      ))}

                      <TableRow className="hover:bg-transparent">
                        {table.getAllColumns().map((column) => {
                          if (column.id === "keyName") {
                            return (
                              <TableHead
                                key={column.id}
                                className="py-1 font-bold text-medium-emphasis"
                              >
                                <div className="w-[300px] md:w-[200px]">
                                  <FilterControls.SearchInput
                                    value={keySearch}
                                    onChange={updateKeySearch}
                                    placeholder="Search..."
                                    className="h-7 w-full text-xs"
                                  />
                                </div>
                              </TableHead>
                            );
                          }

                          if (column.id.includes("resources_")) {
                            const lang = column.id.replace("resources_", "");
                            return (
                              <TableHead
                                key={column.id}
                                className="py-1 font-bold text-medium-emphasis"
                              >
                                <div className="w-[300px] md:w-[200px]">
                                  <FilterControls.SearchInput
                                    value={resourceSearchMap[lang] ?? ""}
                                    onChange={(value) => updateResourceSearch(lang, value)}
                                    placeholder="Search..."
                                    className="h-7 w-full text-xs"
                                  />
                                </div>
                              </TableHead>
                            );
                          }

                          // Empty cell for columns with no filter (moduleId, actions, optional columns)
                          return <TableHead key={column.id} />;
                        })}
                      </TableRow>
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
                            data-state={row.getIsSelected() && "selected"}
                            onClick={() => handleRowClick(row.original.itemId)}
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
                </div>
              </CardContent>
              {!isLoading &&
                blocksLanguageKeyData &&
                blocksLanguageKeyData.totalCount > queryParams.pageSize && (
                  <div className="mt-5 flex items-center md:justify-end">
                    <Pagination
                      page={queryParams.pageNumber}
                      pageSize={queryParams.pageSize}
                      totalCount={blocksLanguageKeyData?.totalCount || 0}
                      pageSizeOptions={[10]}
                      onChange={onPageChangeHandler}
                    />
                  </div>
                )}
            </Card>
            <Dialog
              open={isAutoTranslateDialogOpen}
              onOpenChange={setIsAutoTranslateDialogOpen}
            >
              <AutoTranslate />
            </Dialog>
          </TabsContent>
          <TabsContent value="history">
            <LocalizationTimeline />
          </TabsContent>
          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <ConfirmationModal
              onCancel={() => {}}
              onConfirm={onConfirmDelete}
              data={deleteLanguageKeyModalData}
              buttonState={{ confirm: { disable: isDeleteLanguageKeyPending } }}
            />
          </Dialog>
          <Dialog open={isPublishChangesDialogOpen} onOpenChange={setIsPublishChangesDialogOpen}>
            <ConfirmationModal
              onCancel={() => {}}
              onConfirm={generateUilmFiles}
              data={publishChangesModalData}
              buttonState={{ confirm: { disable: isPending } }}
            />
          </Dialog>
        </Tabs>
      </div>
    </main>
  );
}
