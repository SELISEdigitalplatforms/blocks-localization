import { memo, useMemo, type CSSProperties } from "react";
import type { ColumnDef, Row } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { CopyableTableValue } from "@/components/copyable-table-value/copyable-table-value";
import { FilterControls, type SortValue } from "@/components/filter-toolbar";
import { GlossaryIssueBadge } from "../components/glossary-issue-badge";
import type {
  IBlocksLanguageKey,
  ILanguageConfig,
  IModuleGets,
} from "@blocks-localization/models/language";

const getModuleHue = (moduleId: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < moduleId.length; index++) {
    hash ^= moduleId.codePointAt(index) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
};

const MODULE_BADGE_SATURATION = 0.7;
const MODULE_BADGE_LIGHTNESS = 0.55;
const MIN_TEXT_CONTRAST = 4.5; // WCAG AA for normal-size text

const DARK_TEXT = { color: "#111827", luminance: 0.0092 };
const LIGHT_TEXT = { color: "#ffffff", luminance: 1 };
const BLACK_TEXT = { color: "#000000", luminance: 0 };

const hslToRgb = (hue: number, saturation: number, lightness: number): number[] => {
  const chroma = saturation * Math.min(lightness, 1 - lightness);
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12;
    return lightness - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [channel(0), channel(8), channel(4)];
};

const getRelativeLuminance = ([red, green, blue]: number[]): number => {
  const linearize = (value: number) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  return 0.2126 * linearize(red) + 0.7152 * linearize(green) + 0.0722 * linearize(blue);
};

const getContrastRatio = (first: number, second: number): number =>
  (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);

// Keeps the default dark text where readable; otherwise picks white, and only
// falls back to pure black for mid-luminance hues where neither reaches AA.
export const getReadableTextColor = (backgroundLuminance: number): string => {
  const darkContrast = getContrastRatio(backgroundLuminance, DARK_TEXT.luminance);
  const lightContrast = getContrastRatio(backgroundLuminance, LIGHT_TEXT.luminance);
  const preferred = darkContrast >= lightContrast ? DARK_TEXT : LIGHT_TEXT;
  if (Math.max(darkContrast, lightContrast) >= MIN_TEXT_CONTRAST) return preferred.color;
  return getContrastRatio(backgroundLuminance, BLACK_TEXT.luminance) >= lightContrast
    ? BLACK_TEXT.color
    : LIGHT_TEXT.color;
};

export const getModuleBadgeStyle = (moduleId: string): CSSProperties => {
  const hue = getModuleHue(moduleId);
  const backgroundLuminance = getRelativeLuminance(
    hslToRgb(hue, MODULE_BADGE_SATURATION, MODULE_BADGE_LIGHTNESS),
  );
  return {
    backgroundColor: `hsl(${hue}, 70%, 55%)`,
    color: getReadableTextColor(backgroundLuminance),
  };
};

const COMPLETENESS_BADGE_VARIANT: Record<
  string,
  { variant: BadgeProps["variant"]; className?: string }
> = {
  Complete: { variant: "success" },
  Partial: { variant: "warning" },
};

const CompletenessBadge = ({ value }: { value: string }) => {
  const { variant, className } = COMPLETENESS_BADGE_VARIANT[value] ?? {
    variant: "outline",
    className: "border-transparent bg-muted text-muted-foreground",
  };
  return (
    <Badge variant={variant} className={`rounded-full ${className ?? ""}`}>
      {value}
    </Badge>
  );
};

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
      valueClassName="max-w-full truncate text-primary"
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

export const hasNonEmptyValue = (
  resource: IBlocksLanguageKey["resources"][number] | undefined,
): boolean =>
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
    (resource) => languageCodes.includes(resource.culture) && hasNonEmptyValue(resource),
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
  /** True while the module list may not yet include modules created by an import. */
  isLanguageModulesPending?: boolean;
  onSortChange: (sort: SortValue) => void;
  onToggleExpanded: (itemId: string) => void;
  selectedLanguages: string[];
  selectedOptionalColumns: string[];
  sortQueryParams: SortValue;
  translatingKeys: Set<string>;
  /**
   * Overrides the header checkbox's "Select all" label and adds it as a tooltip, e.g. to say that
   * only the loaded rows of a progressively loaded view are selected.
   */
  selectAllLabel?: string;
}

const buildLanguageColumns = (
  selectedLanguages: string[],
  languageListData?: ILanguageConfig[],
  translatingKeys?: Set<string>,
): ColumnDef<IBlocksLanguageKey>[] =>
  selectedLanguages.map((languageCode) => {
    const language = languageListData?.find((candidate) => candidate.languageCode === languageCode);
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
  isLanguageModulesPending = false,
  onSortChange,
  onToggleExpanded,
  selectedLanguages,
  selectedOptionalColumns,
  sortQueryParams,
  translatingKeys,
  selectAllLabel,
}: UseLanguageTableColumnsOptions) => {
  return useMemo<ColumnDef<IBlocksLanguageKey>[]>(
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
              aria-label={selectAllLabel ?? "Select all"}
              title={selectAllLabel}
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
        id: "actions",
        enableHiding: false,
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
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-1">
            <KeyNameCell keyName={row.getValue("keyName")} />
            <GlossaryIssueBadge
              violations={row.original.glossaryViolations}
              className="ml-2 sm:ml-0"
            />
          </div>
        ),
      },
      {
        accessorKey: "moduleId",
        header: "Module",
        cell: ({ row }) => {
          const keyModule = languageModules?.find(
            (languageModule) => languageModule.itemId === row.getValue("moduleId"),
          );
          if (!keyModule) {
            return isLanguageModulesPending ? (
              <span className="ml-2 sm:ml-0 text-xs text-low-emphasis">Loading…</span>
            ) : null;
          }

          return (
            <CopyableTableValue
              value={keyModule.moduleName}
              label="module name"
              className="ml-2 sm:ml-0 sm:w-[150px]"
              valueClassName="inline-block truncate rounded-full px-2 py-0.5 text-xs font-medium"
              valueStyle={getModuleBadgeStyle(keyModule.itemId)}
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
              cell: ({ row }: { row: Row<IBlocksLanguageKey> }) => (
                <CompletenessBadge
                  value={getCompletenessCellValue(row.original.resources, languageListData)}
                />
              ),
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
    ],
    [
      expandedRowId,
      languageListData,
      languageModules,
      isLanguageModulesPending,
      onSortChange,
      onToggleExpanded,
      selectedLanguages,
      selectedOptionalColumns,
      sortQueryParams,
      translatingKeys,
      selectAllLabel,
    ],
  );
};
