import {
  useUilmDeleteLanguageKey,
  useUilmLanguageKeys,
  useUilmLanguageModules,
  useUilmLanguages,
  useUilmProjectKey,
} from "@/features/uilm/hooks/use-uilm-queries";
import {
  LanguageTableToolbar,
  type DateRangeState,
} from "@/features/uilm/components/language-table-toolbar";
import { LanguageViewMenu } from "@/features/uilm/components/language-view-menu";
import { useLanguageViewStore } from "@/features/uilm/state/language-view-store";
import type { IBlocksLanguageKey } from "@/features/uilm/types/language";
import { Button } from "@/platform/ui/components/button/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/platform/ui/components/card/card";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/platform/ui/components/tooltip/tooltip";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import {
  type ColumnDef,
  type Row,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlignLeft,
  ArrowDown,
  ArrowUp,
  EllipsisVertical,
  Loader2,
  Search,
  Trash,
  X,
} from "lucide-react";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";

// ---------------------------------------------------------------------------
// Inline helper: debounced search input matching FilterControls.SearchInput
// ---------------------------------------------------------------------------

function useDebouncedCallback(fn: (value: string) => void, delay: number) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const debounced = useCallback(
    (value: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(value), delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return debounced;
}

const DebouncedSearchInput = React.memo(
  ({
    value,
    onChange,
    placeholder = "Search...",
    className = "",
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
  }) => {
    const [localValue, setLocalValue] = useState(value);
    const debounced = useDebouncedCallback(onChange, 300);

    // Sync external value → local (e.g. on reset)
    useEffect(() => {
      setLocalValue(value);
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      const v = e.target.value;
      setLocalValue(v);
      debounced(v);
    };

    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setLocalValue("");
      onChange("");
    };

    return (
      <div className="flex items-center rounded-sm border px-2">
        <Search className="mr-2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={localValue}
          onChange={handleChange}
          className={`h-8 w-52 border-none p-0 focus-visible:ring-0 focus-visible:ring-offset-0 ${className}`}
        />
        <button
          type="button"
          className={`h-full p-1 pr-0 hover:bg-transparent ${!localValue ? "invisible" : ""}`}
          onClick={handleClear}
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    );
  },
);
DebouncedSearchInput.displayName = "DebouncedSearchInput";

// ---------------------------------------------------------------------------
// Inline helper: sort header matching FilterControls.SortHeader
// ---------------------------------------------------------------------------

type SortValue = { property: string; isDescending: boolean };

const SortHeader = React.memo(
  ({
    label,
    id,
    value,
    onChange,
  }: {
    label: string;
    id: string;
    value: SortValue;
    onChange: (params: SortValue) => void;
  }) => {
    const Icon = value.isDescending ? ArrowDown : ArrowUp;
    const isActive = id === value.property;

    const onClickHandler = (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange({
        property: id,
        isDescending: id !== value.property ? false : !value.isDescending,
      });
    };

    return (
      <div
        className="flex cursor-pointer items-center"
        onClick={onClickHandler}
      >
        <span className="font-bold text-medium-emphasis">{label}</span>
        <Icon
          className={`ml-2 h-4 w-4 ${isActive ? "text-high-emphasis" : "text-medium-emphasis opacity-50"}`}
        />
      </div>
    );
  },
);
SortHeader.displayName = "SortHeader";

// ---------------------------------------------------------------------------
// Stable memoized cell components — prevents Radix Popper onAnchorChange loop
// ---------------------------------------------------------------------------

const KeyNameCell = React.memo(({ keyName }: { keyName: string }) => {
  const CHAR_WIDTH = 7.5;
  const PADDING = 8;
  const CONTAINER = 150;
  const shouldShowTooltip = keyName.length * CHAR_WIDTH + PADDING > CONTAINER;

  return (
    <TooltipProvider key={keyName}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="ml-2 w-[150px] truncate sm:ml-0 md:w-[200px]">
            {keyName}
          </div>
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
  ({
    onView,
    onDelete,
  }: {
    onView: () => void;
    onDelete: () => void;
  }) => (
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
          className="cursor-pointer text-destructive focus:text-destructive"
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function moduleNameMap(
  modules: { itemId: string; moduleName: string }[] | undefined,
): Map<string, string> {
  const m = new Map<string, string>();
  const list = Array.isArray(modules) ? modules : [];
  for (const mod of list) m.set(mod.itemId, mod.moduleName);
  return m;
}

function toApiDateRange(
  range: DateRangeState,
): { startDate: string; endDate: string } | undefined {
  if (!range.from && !range.to) return undefined;
  return {
    startDate: range.from ?? "",
    endDate: range.to
      ? new Date(new Date(range.to).getTime() + 86400000).toISOString()
      : "",
  };
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function LanguageKeysPanel() {
  const navigate = useNavigate();
  const projectKey = useUilmProjectKey();

  // ---- Search state (debounced) ----
  const [keySearch, setKeySearch] = useState("");
  const keySearchRef = useRef(keySearch);
  keySearchRef.current = keySearch;

  const updateKeySearch = useCallback((value: string) => {
    setKeySearch(value);
    setPage(0);
  }, []);
  const updateKeySearchRef = useRef(updateKeySearch);
  updateKeySearchRef.current = updateKeySearch;

  const [resourceSearchMap, setResourceSearchMap] = useState<
    Record<string, string>
  >({});
  const resourceSearchMapRef = useRef(resourceSearchMap);
  resourceSearchMapRef.current = resourceSearchMap;

  const updateResourceSearch = useCallback(
    (culture: string, searchText: string) => {
      setResourceSearchMap((prev) => {
        const updated = { ...prev, [culture]: searchText };
        Object.keys(updated).forEach((key) => {
          if (!updated[key]) delete updated[key];
        });
        return updated;
      });
      setPage(0);
    },
    [],
  );
  const updateResourceSearchRef = useRef(updateResourceSearch);
  updateResourceSearchRef.current = updateResourceSearch;

  // ---- Pagination ----
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);

  // ---- Filters ----
  const [moduleIds, setModuleIds] = useState<string[]>([]);
  const [createRange, setCreateRange] = useState<DateRangeState>({});
  const [lastUpdateRange, setLastUpdateRange] = useState<DateRangeState>({});

  // ---- Sort ----
  const [sortQueryParams, setSortQueryParams] = useState<SortValue>({
    property: "KeyName",
    isDescending: false,
  });

  const setSortQueryParamsAndResetPage = useCallback((next: SortValue) => {
    setSortQueryParams(next);
    setPage(0);
  }, []);

  // ---- Delete ----
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ---- Data queries ----
  const { data: languages } = useUilmLanguages();
  const { data: modules, isLoading: isModulesLoading } =
    useUilmLanguageModules();

  const safeLanguages = useMemo(
    () => (Array.isArray(languages) ? languages : []),
    [languages],
  );
  const safeModules = useMemo(
    () => (Array.isArray(modules) ? modules : []),
    [modules],
  );
  const {
    selectedLanguages,
    setSelectedLanguages,
    selectedOptionalColumns,
  } = useLanguageViewStore();
  const selectedLanguagesRef = useRef(selectedLanguages);
  selectedLanguagesRef.current = selectedLanguages;

  const modMap = useMemo(() => moduleNameMap(safeModules), [safeModules]);

  const createApi = useMemo(() => toApiDateRange(createRange), [createRange]);
  const lastUpdateApi = useMemo(
    () => toApiDateRange(lastUpdateRange),
    [lastUpdateRange],
  );

  const resourceSearchFilters = useMemo(() => {
    return Object.entries(resourceSearchMap)
      .filter(([, text]) => text.trim() !== "")
      .map(([culture, searchText]) => ({ culture, searchText: searchText.trim() }));
  }, [resourceSearchMap]);

  const { data: blocksLanguageKeyData, isLoading } = useUilmLanguageKeys(
    page,
    pageSize,
    keySearch,
    moduleIds,
    false,
    /** UILM API expects `KeyName` for the key column (mapping to `"Key"` breaks server-side sort). */
    sortQueryParams.property,
    sortQueryParams.isDescending,
    resourceSearchFilters.length > 0 ? resourceSearchFilters : undefined,
    createApi,
    lastUpdateApi,
  );

  const deleteMutation = useUilmDeleteLanguageKey();

  // ---- Sync selected languages when language list loads ----
  useEffect(() => {
    if (!safeLanguages.length) return;
    const current = selectedLanguagesRef.current;
    if (current.length === 0) {
      const defaults = safeLanguages
        .filter((l) => l.isDefault)
        .map((l) => l.languageCode);
      setSelectedLanguages(
        defaults.length ? defaults : [safeLanguages[0].languageCode],
      );
    } else {
      const codes = new Set(safeLanguages.map((l) => l.languageCode));
      const next = current.filter((c) => codes.has(c));
      if (next.length !== current.length) setSelectedLanguages(next);
    }
  }, [safeLanguages, setSelectedLanguages]);

  // ---- Navigation ----
  const handleRowClick = useCallback(
    (keyId: string) => {
      navigate(
        `/services/language/translations/${encodeURIComponent(keyId)}`,
      );
    },
    [navigate],
  );

  // ---- Delete handler ----
  const onDeleteClick = useCallback((itemId: string) => {
    setDeleteId(itemId);
  }, []);

  const onConfirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await deleteMutation.mutateAsync(deleteId);
      if (res?.isSuccess) {
        showSuccessToast({ description: "Deleted successfully" });
        setDeleteId(null);
      } else {
        showErrorToast({ errors: res?.errors ?? "Delete failed" });
      }
    } catch (e) {
      showErrorToast({
        errors: e instanceof Error ? e.message : String(e),
      });
    }
  };

  // ---- Module toggle ----
  const toggleModule = useCallback(
    (id: string, checked: boolean) => {
      setModuleIds((prev) => {
        if (checked) return [...prev, id];
        return prev.filter((x) => x !== id);
      });
      setPage(0);
    },
    [],
  );

  const resetTranslationFilters = useCallback(() => {
    setModuleIds([]);
    setCreateRange({});
    setLastUpdateRange({});
    setPage(0);
  }, []);

  // ---- Column definitions (stable via refs) ----
  const columns = useMemo<ColumnDef<IBlocksLanguageKey>[]>(
    () => [
      {
        accessorKey: "keyName",
        header: () => (
          <div className="w-[300px] pb-2 md:w-[200px]">
            <SortHeader
              label="Key"
              id="KeyName"
              value={sortQueryParams}
              onChange={setSortQueryParamsAndResetPage}
            />
            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
              <DebouncedSearchInput
                value={keySearchRef.current}
                onChange={(value) => updateKeySearchRef.current(value)}
                placeholder="Search..."
                className="h-7 w-full text-xs"
              />
            </div>
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
          const moduleName =
            modMap.get(row.getValue("moduleId") as string) ?? null;
          if (!moduleName) return null;
          return (
            <div className="ml-2 truncate sm:ml-0 sm:w-[150px]">
              <span>{moduleName}</span>
            </div>
          );
        },
      },
      ...(selectedOptionalColumns.includes("completeness")
        ? [
            {
              accessorKey: "resources",
              header: () => <span>Completeness</span>,
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => {
                const resources = row.original.resources;
                if (!resources || resources.length === 0)
                  return "No translation";
                const translatedLanguages = resources.map(
                  (resource) => resource.culture,
                );
                const allLanguages = safeLanguages.map((lang) => lang.languageCode);
                const isComplete = allLanguages.every((lang) =>
                  translatedLanguages.includes(lang),
                );
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
              {safeLanguages.find(
                (language) => language.languageCode === lang,
              )?.languageName ?? lang}{" "}
              {safeLanguages.find(
                (language) => language.languageCode === lang,
              )?.isDefault
                ? "(Default)"
                : null}
            </div>
            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
              <DebouncedSearchInput
                value={resourceSearchMapRef.current[lang] ?? ""}
                onChange={(value) =>
                  updateResourceSearchRef.current(lang, value)
                }
                placeholder="Search..."
                className="h-7 w-full text-xs"
              />
            </div>
          </div>
        ),
        cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => {
          const resource = row.original.resources?.find(
            (res) => res.culture === lang,
          );
          return (
            <div className="ml-2 line-clamp-4 sm:ml-0">
              {resource?.value ?? ""}
            </div>
          );
        },
      })),
      ...(selectedOptionalColumns.includes("createDate")
        ? [
            {
              accessorKey: "createDate",
              header: () => <span>Created Date</span>,
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => {
                const dateValue = row.original.createDate;
                if (!dateValue)
                  return (
                    <div className="ml-2 sm:ml-0 sm:w-[150px]">—</div>
                  );
                const formatted = new Date(dateValue).toLocaleDateString();
                return (
                  <div className="ml-2 sm:ml-0 sm:w-[150px]">
                    {formatted}
                  </div>
                );
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
                if (!dateValue)
                  return (
                    <div className="ml-2 sm:ml-0 sm:w-[150px]">—</div>
                  );
                const formatted = new Date(dateValue).toLocaleDateString();
                return (
                  <div className="ml-2 sm:ml-0 sm:w-[150px]">
                    {formatted}
                  </div>
                );
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
      safeLanguages,
      modMap,
      selectedLanguages,
      selectedOptionalColumns,
      sortQueryParams,
      onDeleteClick,
    ],
  );

  const tableData = useMemo(() => {
    const keys = blocksLanguageKeyData?.keys;
    return Array.isArray(keys) ? keys : [];
  }, [blocksLanguageKeyData]);

  const table = useReactTable({
    data: tableData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  // ---- No project key guard ----
  if (!projectKey) {
    return (
      <Card className="rounded shadow-none">
        <CardHeader>
          <CardTitle className="text-xl text-high-emphasis">
            Translations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>No UILM project is configured.</p>
          <p>
            Pick a project in the console header, set{" "}
            <code className="rounded bg-muted px-1">
              NEXT_PUBLIC_UILM_PROJECT_KEY
            </code>
            , or{" "}
            <Link
              to="/services/language/configure"
              className="font-medium text-primary hover:underline"
            >
              open Configure
            </Link>{" "}
            and enter the tenant id.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="rounded shadow-none">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-xl text-high-emphasis">
            Translations
            {safeLanguages.length > 0 && (
              <LanguageViewMenu languages={safeLanguages} />
            )}
          </CardTitle>
        </CardHeader>
        <div className="mb-4">
          {isModulesLoading ? (
            <Skeleton className="h-12 w-full rounded" />
          ) : (
            <LanguageTableToolbar
              modules={safeModules}
              moduleIds={moduleIds}
              onToggleModule={toggleModule}
              createRange={createRange}
              onCreateRangeChange={(r) => {
                setCreateRange(r);
                setPage(0);
              }}
              lastUpdateRange={lastUpdateRange}
              onLastUpdateRangeChange={(r) => {
                setLastUpdateRange(r);
                setPage(0);
              }}
              onResetFilters={resetTranslationFilters}
            />
          )}
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
                        className="align-top font-bold text-medium-emphasis"
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
                      data-state={row.getIsSelected() && "selected"}
                      onClick={() =>
                        handleRowClick(row.original.itemId)
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
          {!isLoading &&
            blocksLanguageKeyData &&
            blocksLanguageKeyData.totalCount > pageSize && (
              <div className="mt-5 flex items-center md:justify-end">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  totalCount={blocksLanguageKeyData?.totalCount || 0}
                  pageSizeOptions={[10]}
                  onChange={setPage}
                />
              </div>
            )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteId !== null}
        onOpenChange={(o) => !o && setDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete language key?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this language key?
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={onConfirmDelete}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
