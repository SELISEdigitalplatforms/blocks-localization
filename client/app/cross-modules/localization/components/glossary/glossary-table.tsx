import { ReactNode, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useScopedPath } from "@seliseblocks/genesis-os";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  EllipsisVertical,
  Plus,
  Pencil,
  Settings2,
  Trash,
  X,
} from "lucide-react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  Row,
  useReactTable,
  VisibilityState,
} from "@tanstack/react-table";
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
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { FilterControls } from "@/components/filter-toolbar";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import useIsMobile from "@/hooks/use-is-mobile";
import { useGetGlossaries, useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import {
  GLOSSARY_STATUSES,
  GLOSSARY_TYPE_OPTIONS,
  GlossaryRuleDto,
  GlossaryScopeFilter,
  GlossarySortBy,
  GlossaryStatus,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { GLOSSARY_RULES } from "@blocks-localization/models/glossary-meta";
import GlossaryEditorSheet from "@blocks-localization/components/modals/glossary/glossary-editor-sheet";
import GlossaryRuleBadge, {
  GLOSSARY_RULE_LABELS,
} from "@blocks-localization/components/glossary/glossary-rule-badge";
import GlossaryStatusBadge, {
  GLOSSARY_STATUS_LABELS,
} from "@blocks-localization/components/glossary/glossary-status-badge";
import GlossaryTranslationChips from "@blocks-localization/components/glossary/glossary-translation-chips";
import GlossarySummaryStrip from "@blocks-localization/components/glossary/glossary-summary-strip";
import GlossaryBulkActions from "@blocks-localization/components/glossary/glossary-bulk-actions";
import GlossaryMobileList from "@blocks-localization/components/glossary/glossary-mobile-list";
import {
  getGlossaryStatus,
  isUnsupportedGlossaryNote,
  toGlossaryMeta,
} from "@blocks-localization/utils/glossary-display";
import { stripRuleMarker } from "@blocks-localization/utils/glossary-rule-marker";
import DeleteGlossary from "@blocks-localization/components/modals/glossary/delete-glossary";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
/** Select value for "no filter"; Radix Select items can't have an empty value. */
const ALL_FILTER = "all";
const getOptionalCellText = (value?: string | null) => value?.trim() || "-";

export const GLOSSARY_COLUMNS_STORAGE_KEY = "glossary-table-columns";
const DEFAULT_COLUMN_VISIBILITY: VisibilityState = { createDate: false };

const HIDEABLE_COLUMNS: { id: string; label: string }[] = [
  { id: "rule", label: "Rule" },
  { id: "status", label: "Status" },
  { id: "translations", label: "Translations" },
  { id: "language", label: "Language" },
  { id: "type", label: "Type" },
  { id: "context", label: "Definition" },
  { id: "createDate", label: "Created" },
  { id: "lastUpdateDate", label: "Last updated" },
];

const readColumnVisibility = (): VisibilityState => {
  try {
    const stored = globalThis.localStorage?.getItem(GLOSSARY_COLUMNS_STORAGE_KEY);
    if (!stored) return DEFAULT_COLUMN_VISIBILITY;
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return DEFAULT_COLUMN_VISIBILITY;
    }
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([id, visible]) =>
          HIDEABLE_COLUMNS.some((column) => column.id === id) && typeof visible === "boolean",
      ),
    );
  } catch {
    return DEFAULT_COLUMN_VISIBILITY;
  }
};

const writeColumnVisibility = (visibility: VisibilityState) => {
  try {
    globalThis.localStorage?.setItem(GLOSSARY_COLUMNS_STORAGE_KEY, JSON.stringify(visibility));
  } catch {
    // Storage unavailable (private mode, blocked): the choice lasts for this page only.
  }
};

interface GlossarySort {
  sortBy: GlossarySortBy;
  descending: boolean;
}

/** Today's order; sent as no parameters, so the server keeps its default (C18). */
const DEFAULT_SORT: GlossarySort = { sortBy: "createDate", descending: true };

const SORTABLE_COLUMNS: Record<string, GlossarySortBy | undefined> = {
  name: "name",
  createDate: "createDate",
  lastUpdateDate: "lastUpdateDate",
};

const defaultDescending = (sortBy: GlossarySortBy) => sortBy !== "name";

const HeaderLabel = ({ children }: Readonly<{ children: string }>) => (
  <div className="flex items-center">
    <span className="font-bold text-medium-emphasis">{children}</span>
  </div>
);

const SortHeader = ({
  label,
  sortBy,
  sort,
  onSort,
}: Readonly<{
  label: string;
  sortBy: GlossarySortBy;
  sort: GlossarySort;
  onSort: (sortBy: GlossarySortBy) => void;
}>) => {
  const isActive = sort.sortBy === sortBy;
  let Icon = ChevronsUpDown;
  if (isActive) Icon = sort.descending ? ChevronDown : ChevronUp;
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1 font-bold text-medium-emphasis"
      onClick={(event) => {
        event.stopPropagation();
        onSort(sortBy);
      }}
    >
      {label}
      <Icon className={`h-4 w-4 ${isActive ? "" : "opacity-50"}`} aria-hidden="true" />
    </Button>
  );
};

const TruncatedText = ({ text, className }: Readonly<{ text: string; className: string }>) => {
  if (text === "-") return <span>-</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={`block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
          onKeyDown={(event) => {
            // Only shows the tooltip: Enter and Space must not click through to the row and open the term.
            if (event.key === "Enter" || event.key === " ") event.preventDefault();
          }}
        >
          <span className="block truncate">{text}</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-80 whitespace-pre-wrap text-sm font-normal">
        {text}
      </TooltipContent>
    </Tooltip>
  );
};

function renderRuleCell(row: { original: IGlossary }) {
  return isUnsupportedGlossaryNote(row.original) ? (
    <span>—</span>
  ) : (
    <GlossaryRuleBadge rule={toGlossaryMeta(row.original).rule} />
  );
}

function renderTranslationsCell(
  row: { original: IGlossary },
  languages: ILanguageConfig[] | undefined,
) {
  return isUnsupportedGlossaryNote(row.original) ? (
    <span>—</span>
  ) : (
    <GlossaryTranslationChips meta={toGlossaryMeta(row.original)} languages={languages} />
  );
}

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : "-");

export const getGlossaryLanguageName = (
  code: string | undefined,
  languages: ILanguageConfig[] | undefined,
) => languages?.find((language) => language.languageCode === code)?.languageName ?? (code || "—");

const ROW_CLICK_IGNORE = "data-row-click-ignore";

type CheckedChange = (checked: boolean | "indeterminate") => void;

const SelectAllHeader = ({
  allSelected,
  someSelected,
  disabled,
  onCheckedChange,
}: Readonly<{
  allSelected: boolean;
  someSelected: boolean;
  disabled: boolean;
  onCheckedChange: CheckedChange;
}>) => (
  <Checkbox
    aria-label="Select all terms on this page"
    checked={allSelected || (someSelected && "indeterminate")}
    disabled={disabled}
    onCheckedChange={onCheckedChange}
  />
);

const SelectRowCell = ({
  glossary,
  checked,
  onToggle,
}: Readonly<{
  glossary: IGlossary;
  checked: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
}>) => (
  <div className="flex items-center" {...{ [ROW_CLICK_IGNORE]: true }}>
    <Checkbox
      aria-label={`Select ${glossary.name}`}
      checked={checked}
      disabled={isUnsupportedGlossaryNote(glossary)}
      onCheckedChange={(value) => onToggle(glossary.itemId, value === true)}
    />
  </div>
);

const GlossaryActionsCell = ({
  glossary,
  onEdit,
  onDelete,
}: Readonly<{
  glossary: IGlossary;
  onEdit: (glossary: IGlossary) => void;
  onDelete: (glossary: IGlossary) => void;
}>) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger
      asChild
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <Button variant="ghost" className="h-8 w-8 p-0" aria-label={`Actions for ${glossary.name}`}>
        <EllipsisVertical width={20} height={20} />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
      <DropdownMenuItem
        className="cursor-pointer"
        onClick={(e) => {
          e.preventDefault();
          onEdit(glossary);
        }}
      >
        <Pencil className="mr-2 h-4 w-4" />
        <span>Edit</span>
      </DropdownMenuItem>
      <DropdownMenuItem
        className="cursor-pointer text-error"
        onClick={(e) => {
          e.preventDefault();
          onDelete(glossary);
        }}
      >
        <Trash className="mr-2 h-4 w-4" />
        <span>Delete</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

interface GlossaryColumnsOptions {
  sort: GlossarySort;
  onSort: (sortBy: GlossarySortBy) => void;
  selectedIds: ReadonlySet<string>;
  allSelected: boolean;
  someSelected: boolean;
  selectAllDisabled: boolean;
  onSelectAll: CheckedChange;
  onToggleRow: (itemId: string, checked: boolean) => void;
  languages: ILanguageConfig[] | undefined;
  onEdit: (glossary: IGlossary) => void;
  onDelete: (glossary: IGlossary) => void;
}

const buildGlossaryColumns = ({
  sort,
  onSort,
  selectedIds,
  allSelected,
  someSelected,
  selectAllDisabled,
  onSelectAll,
  onToggleRow,
  languages,
  onEdit,
  onDelete,
}: GlossaryColumnsOptions): ColumnDef<IGlossary>[] => [
  {
    id: "select",
    enableHiding: false,
    header: () => (
      <SelectAllHeader
        allSelected={allSelected}
        someSelected={someSelected}
        disabled={selectAllDisabled}
        onCheckedChange={onSelectAll}
      />
    ),
    cell: ({ row }) => (
      <SelectRowCell
        glossary={row.original}
        checked={selectedIds.has(row.original.itemId)}
        onToggle={onToggleRow}
      />
    ),
  },
  {
    accessorKey: "name",
    enableHiding: false,
    header: () => <SortHeader label="Name" sortBy="name" sort={sort} onSort={onSort} />,
    cell: ({ row }) => (
      <div className="min-w-[150px] max-w-[240px] break-words font-medium text-high-emphasis">
        {row.original.name}
      </div>
    ),
  },
  {
    id: "rule",
    header: () => <HeaderLabel>Rule</HeaderLabel>,
    cell: ({ row }) => renderRuleCell(row),
  },
  {
    id: "status",
    header: () => <HeaderLabel>Status</HeaderLabel>,
    cell: ({ row }) => <GlossaryStatusBadge status={getGlossaryStatus(row.original)} />,
  },
  {
    id: "translations",
    header: () => <HeaderLabel>Translations</HeaderLabel>,
    cell: ({ row }) => renderTranslationsCell(row, languages),
  },
  {
    accessorKey: "language",
    header: () => <HeaderLabel>Language</HeaderLabel>,
    cell: ({ row }) => <span>{getGlossaryLanguageName(row.original.language, languages)}</span>,
  },
  {
    accessorKey: "type",
    header: () => <HeaderLabel>Type</HeaderLabel>,
    cell: ({ row }) => (
      <TruncatedText
        text={getOptionalCellText(row.original.type)}
        className="max-w-[120px] lg:max-w-[200px]"
      />
    ),
  },
  {
    accessorKey: "context",
    header: () => <HeaderLabel>Definition</HeaderLabel>,
    cell: ({ row }) => (
      <TruncatedText
        text={getOptionalCellText(stripRuleMarker(row.original.context))}
        className="max-w-[200px]"
      />
    ),
  },
  {
    accessorKey: "createDate",
    header: () => <SortHeader label="Created" sortBy="createDate" sort={sort} onSort={onSort} />,
    cell: ({ row }) => <span>{formatDate(row.original.createDate)}</span>,
  },
  {
    accessorKey: "lastUpdateDate",
    header: () => (
      <SortHeader label="Last updated" sortBy="lastUpdateDate" sort={sort} onSort={onSort} />
    ),
    cell: ({ row }) => <span>{formatDate(row.original.lastUpdateDate)}</span>,
  },
  {
    id: "actions",
    enableHiding: false,
    header: () => <HeaderLabel>Actions</HeaderLabel>,
    cell: ({ row }) => (
      <GlossaryActionsCell glossary={row.original} onEdit={onEdit} onDelete={onDelete} />
    ),
  },
];

function renderTableRows(
  tableRows: Row<IGlossary>[],
  columnCount: number,
  scoped: (path: string) => string,
  navigate: (path: string) => void,
  emptyState: ReactNode,
) {
  if (tableRows.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={columnCount} className="h-40 text-center">
          {emptyState}
        </TableCell>
      </TableRow>
    );
  }

  return tableRows.map((row) => {
    const openGlossary = () => navigate(scoped(`services/glossary/${row.original.itemId}`));
    return (
      <TableRow
        key={row.id}
        isHoverable
        tabIndex={0}
        data-state={row.getIsSelected() ? "selected" : undefined}
        className="font-normal text-medium-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={(event) => {
          // A click in the select cell only toggles its checkbox; it never opens the term.
          if (event.target instanceof Element && event.target.closest(`[${ROW_CLICK_IGNORE}]`))
            return;
          openGlossary();
        }}
        onKeyDown={(event) => {
          // Keys on the row's own controls (the actions menu) keep their behaviour (A10).
          if (event.target !== event.currentTarget || event.key !== "Enter") return;
          event.preventDefault();
          openGlossary();
        }}
      >
        {row.getVisibleCells().map((cell) => (
          <TableCell key={cell.id}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    );
  });
}

function GlossaryEmptyState({
  searchQuery,
  isFiltered,
  onCreate,
  onClearFilters,
}: Readonly<{
  searchQuery: string;
  isFiltered: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}>) {
  const clearButton = (
    <Button type="button" size="sm" variant="outline" className="mt-2" onClick={onClearFilters}>
      Clear filters
    </Button>
  );

  if (!searchQuery && isFiltered) {
    return (
      <output className="flex flex-col items-center gap-2 py-4">
        <p className="font-medium text-high-emphasis">No matching glossaries</p>
        <p className="text-muted-foreground">No glossaries match the selected filters.</p>
        {clearButton}
      </output>
    );
  }

  if (searchQuery) {
    return (
      <output className="flex flex-col items-center gap-2 py-4">
        <p className="font-medium text-high-emphasis">No matching glossaries</p>
        <p className="text-muted-foreground">
          No glossaries match &ldquo;{searchQuery}&rdquo;. Try a different search.
        </p>
        {clearButton}
      </output>
    );
  }

  return (
    <output className="flex flex-col items-center gap-2 py-4">
      <p className="font-medium text-high-emphasis">No glossaries yet</p>
      <p className="text-muted-foreground">
        Glossaries help keep terminology consistent across translations.
      </p>
      <Button type="button" size="sm" className="mt-2" onClick={onCreate}>
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        Create your first term
      </Button>
    </output>
  );
}

const GlossaryTable = () => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const isMobile = useIsMobile();
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [searchText, setSearchText] = useState("");
  const [ruleFilter, setRuleFilter] = useState<GlossaryRuleDto | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<GlossaryStatus | undefined>(undefined);
  const [languageFilter, setLanguageFilter] = useState<string | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [scopeFilter, setScopeFilter] = useState<GlossaryScopeFilter | undefined>(undefined);
  const [sort, setSort] = useState<GlossarySort>(DEFAULT_SORT);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(readColumnVisibility);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editGlossary, setEditGlossary] = useState<IGlossary | undefined>(undefined);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteGlossary, setDeleteGlossary] = useState<IGlossary | undefined>(undefined);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Filters, sort and paging restart at page 0 (except paging) and clear the selection (C10).
  const resetPaging = useCallback(() => {
    setPageNumber(0);
    setSelectedIds(new Set());
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchText(value.trim());
      resetPaging();
    },
    [resetPaging],
  );

  // Server-side filters (query parameters), not table column filters.
  const selectFilter =
    <T extends string>(setter: (value: T | undefined) => void) =>
    (value: string) => {
      setter(value === ALL_FILTER ? undefined : (value as T));
      resetPaging();
    };

  const handleStatusChange = useCallback(
    (status: GlossaryStatus | undefined) => {
      setStatusFilter(status);
      resetPaging();
    },
    [resetPaging],
  );

  const handleSort = useCallback(
    (sortBy: GlossarySortBy) => {
      setSort((current) =>
        current.sortBy === sortBy
          ? { sortBy, descending: !current.descending }
          : { sortBy, descending: defaultDescending(sortBy) },
      );
      resetPaging();
    },
    [resetPaging],
  );

  const clearFilters = useCallback(() => {
    setSearchText("");
    setRuleFilter(undefined);
    setStatusFilter(undefined);
    setLanguageFilter(undefined);
    setTypeFilter(undefined);
    setScopeFilter(undefined);
    resetPaging();
  }, [resetPaging]);

  const isFiltered =
    !!ruleFilter || !!statusFilter || !!languageFilter || !!typeFilter || !!scopeFilter;
  const isDefaultSort =
    sort.sortBy === DEFAULT_SORT.sortBy && sort.descending === DEFAULT_SORT.descending;

  const { data, isLoading, refetch } = useGetGlossaries(pageNumber, pageSize, searchText, {
    rule: ruleFilter,
    status: statusFilter,
    language: languageFilter,
    type: typeFilter,
    scope: scopeFilter,
    ...(!isDefaultSort && { sortBy: sort.sortBy, sortDescending: sort.descending }),
  });
  const { data: languageListData } = useGetLanguages();
  const pageItems = useMemo(() => data?.items ?? [], [data?.items]);
  // Terms saved by a newer version can't be edited here, so they can't be selected (C9).
  const selectableItems = useMemo(
    () => pageItems.filter((glossary) => !isUnsupportedGlossaryNote(glossary)),
    [pageItems],
  );
  const selectedGlossaries = useMemo(
    () => selectableItems.filter((glossary) => selectedIds.has(glossary.itemId)),
    [selectableItems, selectedIds],
  );

  const handleEditClick = useCallback((glossary: IGlossary) => {
    setEditGlossary(glossary);
    setEditModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((glossary: IGlossary) => {
    setDeleteGlossary(glossary);
    setDeleteModalOpen(true);
  }, []);

  const handleVisibilityChange = (id: string, visible: boolean) => {
    setColumnVisibility((current) => {
      const next = { ...current, [id]: visible };
      writeColumnVisibility(next);
      return next;
    });
  };

  const toggleRow = useCallback((itemId: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  const allSelected =
    selectableItems.length > 0 && selectedGlossaries.length === selectableItems.length;
  const someSelected = selectedGlossaries.length > 0 && !allSelected;

  const handleSelectAll = useCallback(
    (checked: boolean | "indeterminate") =>
      setSelectedIds(
        checked === true ? new Set(selectableItems.map((glossary) => glossary.itemId)) : new Set(),
      ),
    [selectableItems],
  );

  const selectAllDisabled = selectableItems.length === 0;

  const columns = useMemo(
    () =>
      buildGlossaryColumns({
        sort,
        onSort: handleSort,
        selectedIds,
        allSelected,
        someSelected,
        selectAllDisabled,
        onSelectAll: handleSelectAll,
        onToggleRow: toggleRow,
        languages: languageListData,
        onEdit: handleEditClick,
        onDelete: handleDeleteClick,
      }),
    [
      handleEditClick,
      handleDeleteClick,
      handleSort,
      toggleRow,
      handleSelectAll,
      languageListData,
      sort,
      selectedIds,
      selectAllDisabled,
      allSelected,
      someSelected,
    ],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table's useReactTable is the table API this component is built on.
  const table = useReactTable({
    data: pageItems,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.itemId,
    manualPagination: true,
    pageCount: Math.ceil((data?.totalCount ?? 0) / pageSize),
    state: {
      columnVisibility,
      rowSelection: Object.fromEntries([...selectedIds].map((id) => [id, true])),
    },
  });
  const isUnfilteredEmpty =
    !isLoading && searchText.length === 0 && !isFiltered && (data?.totalCount ?? 0) === 0;
  const tableRows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  const emptyState = (
    <GlossaryEmptyState
      searchQuery={searchText}
      isFiltered={isFiltered}
      onCreate={() => setAddModalOpen(true)}
      onClearFilters={clearFilters}
    />
  );

  const ariaSortFor = (sortBy: GlossarySortBy | undefined) => {
    if (!sortBy) return undefined;
    if (sort.sortBy !== sortBy) return "none" as const;
    return sort.descending ? ("descending" as const) : ("ascending" as const);
  };

  return (
    <div>
      <div className="flex items-end justify-between">
        <h1 className="text-2xl font-semibold">Glossary</h1>
        <GlossaryEditorSheet
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          trigger={
            <Button
              size="sm"
              variant="default"
              className="h-10 bg-primary text-sm text-primary-foreground"
            >
              <Plus className="mr-2 h-5 w-5" />
              <span className="sr-only sm:not-sr-only">New term</span>
            </Button>
          }
        />
      </div>

      <Card className="mt-6 rounded-sm border border-border shadow-none">
        <CardHeader className="gap-2">
          <CardTitle className="flex items-center justify-between text-xl text-high-emphasis">
            Terms
          </CardTitle>
          <GlossarySummaryStrip status={statusFilter} onStatusChange={handleStatusChange} />
        </CardHeader>
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
          <div className="col-span-2 sm:col-span-3 lg:w-[260px]">
            <FilterControls.SearchInput
              placeholder="Search glossary..."
              value={searchText}
              onChange={handleSearchChange}
              className="h-9 w-full"
              disabled={isUnfilteredEmpty}
            />
          </div>
          <Select
            value={ruleFilter ?? ALL_FILTER}
            onValueChange={selectFilter<GlossaryRuleDto>(setRuleFilter)}
          >
            <SelectTrigger aria-label="Rule" className="h-9 w-full lg:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All rules</SelectItem>
              {GLOSSARY_RULES.map((rule) => (
                <SelectItem key={rule} value={rule}>
                  {GLOSSARY_RULE_LABELS[rule]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter ?? ALL_FILTER}
            onValueChange={selectFilter<GlossaryStatus>(setStatusFilter)}
          >
            <SelectTrigger aria-label="Status" className="h-9 w-full lg:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
              {GLOSSARY_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {GLOSSARY_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={languageFilter ?? ALL_FILTER}
            onValueChange={selectFilter<string>(setLanguageFilter)}
          >
            <SelectTrigger aria-label="Language" className="h-9 w-full lg:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All languages</SelectItem>
              {languageListData?.map((language) => (
                <SelectItem key={language.languageCode} value={language.languageCode}>
                  {language.languageName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={typeFilter ?? ALL_FILTER}
            onValueChange={selectFilter<string>(setTypeFilter)}
          >
            <SelectTrigger aria-label="Type" className="h-9 w-full lg:w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All types</SelectItem>
              {GLOSSARY_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={scopeFilter ?? ALL_FILTER}
            onValueChange={selectFilter<GlossaryScopeFilter>(setScopeFilter)}
          >
            <SelectTrigger aria-label="Scope" className="h-9 w-full lg:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_FILTER}>All scopes</SelectItem>
              <SelectItem value="project">Whole project</SelectItem>
              <SelectItem value="modules">Specific modules</SelectItem>
            </SelectContent>
          </Select>
          {(isFiltered || !!searchText) && (
            <Button
              type="button"
              variant="ghost"
              className="h-9 gap-1 text-medium-emphasis"
              onClick={clearFilters}
            >
              Reset
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {!isMobile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 lg:ml-auto">
                  <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  Columns
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {HIDEABLE_COLUMNS.map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={columnVisibility[column.id] !== false}
                    onCheckedChange={(checked) => handleVisibilityChange(column.id, checked)}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {column.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <CardContent>
          <GlossaryBulkActions
            selected={selectedGlossaries}
            onClearSelection={() => setSelectedIds(new Set())}
            onReload={() => void refetch()}
          />
          {isMobile ? (
            <GlossaryMobileList
              glossaries={pageItems}
              languages={languageListData}
              isLoading={isLoading}
              emptyState={emptyState}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
            />
          ) : (
            <TooltipProvider delayDuration={200}>
              <div className="w-full overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <TableRow key={headerGroup.id} className="px-4 py-3 hover:bg-transparent">
                        {headerGroup.headers.map((header) => (
                          <TableHead
                            key={header.id}
                            className="font-bold text-medium-emphasis"
                            aria-sort={ariaSortFor(SORTABLE_COLUMNS[header.column.id])}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                          </TableHead>
                        ))}
                      </TableRow>
                    ))}
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 10 }).map((_, index) => (
                          <TableRow key={index}>
                            {Array.from({ length: visibleColumnCount }).map((_, colIndex) => (
                              <TableCell key={colIndex}>
                                <Skeleton className="h-6 w-full rounded" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : renderTableRows(tableRows, visibleColumnCount, scoped, navigate, emptyState)}
                  </TableBody>
                </Table>
              </div>
            </TooltipProvider>
          )}
        </CardContent>
        {!isLoading && (data?.totalCount ?? 0) > pageSize && (
          <div className="mt-5 flex items-center md:justify-end">
            <Pagination
              page={pageNumber}
              pageSize={pageSize}
              totalCount={data?.totalCount ?? 0}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onChange={(page) => {
                setPageNumber(page);
                setSelectedIds(new Set());
              }}
              onPageSizeChange={(size) => {
                setPageSize(size);
                resetPaging();
              }}
            />
          </div>
        )}
      </Card>

      <GlossaryEditorSheet
        open={editModalOpen && !!editGlossary}
        glossary={editGlossary}
        onOpenChange={(open) => {
          setEditModalOpen(open);
          if (!open) setEditGlossary(undefined);
        }}
      />

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        {deleteModalOpen && deleteGlossary && (
          <DeleteGlossary
            itemId={deleteGlossary.itemId}
            glossaryName={deleteGlossary.name}
            glossary={deleteGlossary}
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
