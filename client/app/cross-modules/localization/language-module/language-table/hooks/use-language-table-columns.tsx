import { memo, useMemo } from "react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { CopyableTableValue } from "@/components/copyable-table-value/copyable-table-value";
import { FilterControls, type SortValue } from "@/components/filter-toolbar";
import type {
  IBlocksLanguageKey,
  ILanguageConfig,
  IModuleGets,
} from "@blocks-localization/models/language";

const KeyNameCell = memo(({ keyName }: { keyName: string | null | undefined }) => {
  const characterWidth = 7.5;
  const horizontalPadding = 8;
  const containerWidth = 150;
  const displayValue = keyName ?? "(Unnamed Key)";
  const shouldShowFullValue =
    displayValue.length * characterWidth + horizontalPadding > containerWidth;

  return (
    <CopyableTableValue
      value={keyName}
      displayValue={displayValue}
      label="key"
      className="ml-2 w-full sm:ml-0"
      valueClassName="max-w-full truncate"
      valueTooltip={shouldShowFullValue ? displayValue : undefined}
    />
  );
});
KeyNameCell.displayName = "KeyNameCell";

const DateCell = ({ value }: { value: string | null | undefined }) => (
  <div className="ml-2 sm:ml-0 sm:w-[150px]">
    {value ? new Date(value).toLocaleDateString() : "—"}
  </div>
);

export const hasNonEmptyValue = (resource: IBlocksLanguageKey["resources"][number] | undefined): boolean =>
  resource?.value !== null && resource?.value !== undefined && resource.value.trim() !== "";

export const isKeyComplete = (
  resources: IBlocksLanguageKey["resources"],
  languageCodes: string[],
): boolean =>
  languageCodes.every((languageCode) => {
    const resource = resources.find((candidate) => candidate.culture === languageCode);
    return hasNonEmptyValue(resource);
  });

export const getCompletenessCellValue = (
  resources: IBlocksLanguageKey["resources"],
  languageListData?: ILanguageConfig[],
): string => {
  if (!languageListData || languageListData.length === 0) return "No translation";
  if (!resources || resources.length === 0) return "No translation";

  const languageCodes = languageListData.map((language) => language.languageCode);

  // Check if any resource belongs to an active language and has a non-empty value
  const hasAnyActiveLanguageWithValue = resources.some(
    (resource) =>
      languageCodes.includes(resource.culture) && hasNonEmptyValue(resource),
  );

  // If no active language has a resource with a non-empty value, return "No translation"
  if (!hasAnyActiveLanguageWithValue) return "No translation";

  return isKeyComplete(resources, languageCodes) ? "Complete" : "Partial";
};

const findResourceByCulture = (
  resources: IBlocksLanguageKey["resources"],
  languageCode: string,
): IBlocksLanguageKey["resources"][number] | undefined =>
  resources?.find((candidate) => candidate.culture === languageCode);

interface UseLanguageTableColumnsOptions {
  expandedRowId: string | null;
  languageListData?: ILanguageConfig[];
  languageModules?: Pick<IModuleGets, "itemId" | "moduleName">[];
  onSortChange: (sort: SortValue) => void;
  onToggleExpanded: (itemId: string) => void;
  selectedLanguages: string[];
  selectedOptionalColumns: string[];
  sortQueryParams: SortValue;
  translatingKeys: Set<string>;
}

const buildLanguageColumns = (
  selectedLanguages: string[],
  languageListData?: ILanguageConfig[],
  translatingKeys?: Set<string>,
): ColumnDef<IBlocksLanguageKey>[] =>
  selectedLanguages.map((languageCode) => {
    const language = languageListData?.find(
      (candidate) => candidate.languageCode === languageCode,
    );
    const header = (
      <div className="w-[300px] md:w-[200px]">
        <div className="font-bold text-medium-emphasis flex items-center gap-1">
          {language?.languageName ?? languageCode} {language?.isDefault ? "(Default)" : null}
        </div>
      </div>
    );

    const cell = ({ row }: { row: Row<IBlocksLanguageKey> }) => {
      const isTranslating = translatingKeys?.has(row.original.itemId) ?? false;
      const resource = findResourceByCulture(row.original.resources, languageCode);
      const hasValue = hasNonEmptyValue(resource);

      if (isTranslating && !hasValue) {
        return <span className="text-blue-600 font-medium">Translating...</span>;
      }

      return (
        <CopyableTableValue
          value={hasValue ? resource?.value : null}
          displayValue={hasValue ? undefined : "_"}
          label={`${language?.languageName ?? languageCode} value`}
          className="ml-2 sm:ml-0"
          valueClassName="line-clamp-4"
        />
      );
    };

    return {
      accessorKey: `resources.${languageCode}` as const,
      header: () => header,
      cell,
    };
  });

export const useLanguageTableColumns = ({
  expandedRowId,
  languageListData,
  languageModules,
  onSortChange,
  onToggleExpanded,
  selectedLanguages,
  selectedOptionalColumns,
  sortQueryParams,
  translatingKeys,
}: UseLanguageTableColumnsOptions) =>
  useMemo<ColumnDef<IBlocksLanguageKey>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => {
          let checked: boolean | "indeterminate" = false;
          if (table.getIsAllPageRowsSelected()) checked = true;
          else if (table.getIsSomePageRowsSelected()) checked = "indeterminate";

          return (
            <Checkbox
              checked={checked}
              onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
              aria-label="Select all"
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            onClick={(event) => event.stopPropagation()}
            aria-label="Select row"
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "keyName",
        header: () => (
          <div className="w-[300px] md:w-[200px]">
            <FilterControls.SortHeader
              label="Key"
              id="KeyName"
              value={sortQueryParams}
              onChange={onSortChange}
            />
          </div>
        ),
        cell: ({ row }) => <KeyNameCell keyName={row.getValue("keyName")} />,
      },
      {
        accessorKey: "moduleId",
        header: "Module",
        cell: ({ row }) => {
          const keyModule = languageModules?.find(
            (languageModule) => languageModule.itemId === row.getValue("moduleId"),
          );
          if (!keyModule) return null;

          return (
            <CopyableTableValue
              value={keyModule.moduleName}
              label="module name"
              className="ml-2 sm:ml-0 sm:w-[150px]"
              valueClassName="truncate"
            />
          );
        },
        filterFn: (row, id, filterValue: { text?: string; types?: string[] }) =>
          filterValue.types ? filterValue.types.includes(row.getValue(id)) : true,
      },
      ...(selectedOptionalColumns.includes("completeness")
        ? [
            {
              accessorKey: "resources",
              header: () => <span>Completeness</span>,
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) =>
                getCompletenessCellValue(row.original.resources, languageListData),
              enableHiding: true,
            } as ColumnDef<IBlocksLanguageKey>,
          ]
        : []),
      ...buildLanguageColumns(selectedLanguages, languageListData, translatingKeys),
      ...(selectedOptionalColumns.includes("createDate")
        ? [
            {
              accessorKey: "createDate",
              header: () => (
                <div className="w-[150px]">
                  <FilterControls.SortHeader
                    label="Created Date"
                    id="CreateDate"
                    value={sortQueryParams}
                    onChange={onSortChange}
                    defaultDescending
                  />
                </div>
              ),
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => (
                <DateCell value={row.original.createDate} />
              ),
              enableSorting: true,
              enableHiding: true,
            } as ColumnDef<IBlocksLanguageKey>,
          ]
        : []),
      ...(selectedOptionalColumns.includes("lastUpdateDate")
        ? [
            {
              accessorKey: "lastUpdateDate",
              header: () => (
                <div className="w-[190px] whitespace-nowrap">
                  <FilterControls.SortHeader
                    label="Last Updated Date"
                    id="LastUpdateDate"
                    value={sortQueryParams}
                    onChange={onSortChange}
                    defaultDescending
                  />
                </div>
              ),
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => (
                <DateCell value={row.original.lastUpdateDate} />
              ),
              enableSorting: true,
              enableHiding: true,
            } as ColumnDef<IBlocksLanguageKey>,
          ]
        : []),
      {
        id: "actions",
        enableHiding: false,
        header: () => (
          <span className="font-bold text-medium-emphasis">Actions</span>
        ),
        cell: ({ row }) => {
          const isExpanded = expandedRowId === row.original.itemId;
          return (
            <Button
              variant="ghost"
              className="h-8 w-8 p-0"
              aria-label={`${isExpanded ? "Collapse" : "Expand"} ${row.original.keyName}`}
              aria-expanded={isExpanded}
              onClick={(event) => {
                event.stopPropagation();
                onToggleExpanded(row.original.itemId);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <ChevronRight
                width={20}
                height={20}
                className={`transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`}
              />
            </Button>
          );
        },
      },
    ],
    [
      expandedRowId,
      languageListData,
      languageModules,
      onSortChange,
      onToggleExpanded,
      selectedLanguages,
      selectedOptionalColumns,
      sortQueryParams,
      translatingKeys,
    ],
  );
