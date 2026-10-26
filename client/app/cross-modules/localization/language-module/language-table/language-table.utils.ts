import type { RowSelectionState } from "@tanstack/react-table";

const DELETE_KEY_FALLBACK_MESSAGE = "Failed to delete key. Please try again.";

/** A single key delete's errors come back as a list or as a field-to-message map. */
export const getDeleteKeyErrorMessage = (rawErrors: unknown) => {
  if (!rawErrors || typeof rawErrors !== "object") return DELETE_KEY_FALLBACK_MESSAGE;
  if (Array.isArray(rawErrors)) {
    return rawErrors.length > 0 ? (rawErrors as string[]).join(", ") : DELETE_KEY_FALLBACK_MESSAGE;
  }
  if (Object.keys(rawErrors).length === 0) return DELETE_KEY_FALLBACK_MESSAGE;
  const firstError = Object.values(rawErrors)[0];
  return typeof firstError === "string" ? firstError : JSON.stringify(rawErrors);
};

export const getDeleteKeysErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  if (Array.isArray(error) && error.length > 0) return error.join(", ");
  if (error && typeof error === "object" && Object.keys(error).length > 0) {
    return JSON.stringify(error);
  }
  return "Failed to delete selected keys. Please try again.";
};

export const parseResourceSearch = (resourceSearch: string | null | undefined) => {
  if (!resourceSearch) return {};
  try {
    return JSON.parse(resourceSearch) as Record<string, string>;
  } catch {
    return {};
  }
};

export const getResourceSearchFilters = (resourceSearchMap: Record<string, string>) =>
  Object.entries(resourceSearchMap)
    .filter(([, searchText]) => searchText.trim() !== "")
    .map(([culture, searchText]) => ({ culture, searchText }));

export const updateResourceSearchValue = (
  resourceSearch: string | null | undefined,
  culture: string,
  searchText: string,
) => {
  const updated = { ...parseResourceSearch(resourceSearch), [culture]: searchText };
  Object.keys(updated).forEach((key) => {
    if (!updated[key]) delete updated[key];
  });
  return Object.keys(updated).length > 0 ? JSON.stringify(updated) : "";
};

export const getInclusiveDateRange = (
  startDate: string | null | undefined,
  endDate: string | null | undefined,
) => {
  if (!startDate && !endDate) return undefined;

  const inclusiveEndDate = endDate
    ? new Date(new Date(endDate).getTime() + 86400000).toISOString()
    : "";
  return { startDate: startDate || "", endDate: inclusiveEndDate };
};

export const STICKY_LEFT_COLUMN_IDS = new Set(["select", "actions"]);

export const isStickyLeftColumn = (columnId: string) => STICKY_LEFT_COLUMN_IDS.has(columnId);

export const getStickyHeaderClassName = (columnId: string) => {
  if (columnId === "select") {
    return "sticky left-0 z-10 bg-background pl-2 pr-2 md:pl-2 md:pr-2 has-[[role=checkbox]]:pr-2";
  }
  if (columnId === "actions") return "sticky left-8 z-10 bg-background pl-2 pr-2 md:pl-2 md:pr-2";
  return "";
};

export const getStickyBodyCellClassName = (columnId: string) => {
  if (columnId === "select") {
    return "sticky left-0 z-10 bg-background pl-2 pr-2 py-0 md:pl-2 md:pr-2 md:py-0 has-[[role=checkbox]]:pr-2 group-hover:bg-[linear-gradient(hsl(var(--muted)/0.5),hsl(var(--muted)/0.5))] group-data-[state=selected]:bg-muted";
  }
  if (columnId === "actions") {
    return "sticky left-8 z-10 bg-background pl-2 pr-2 py-0 md:pl-2 md:pr-2 md:py-0 group-hover:bg-[linear-gradient(hsl(var(--muted)/0.5),hsl(var(--muted)/0.5))] group-data-[state=selected]:bg-muted";
  }
  return "";
};

export const getTableColumnBaseWidth = (columnId: string, viewportWidth: number) => {
  const isMd = viewportWidth >= 768;
  if (columnId === "select") return 32;
  if (columnId === "keyName" || columnId.startsWith("resources_")) return isMd ? 232 : 332;
  if (columnId === "moduleId") return viewportWidth >= 640 ? 182 : 128;
  if (columnId === "createDate") return 182;
  if (columnId === "lastUpdateDate") return 220;
  if (columnId === "actions") return 48;
  return 144;
};

export const getStretchedColumnWidths = (
  columnIds: string[],
  containerWidth: number,
  viewportWidth: number,
): Record<string, number> => {
  let fixedTotal = 0;
  let flexibleTotal = 0;
  columnIds.forEach((columnId) => {
    const width = getTableColumnBaseWidth(columnId, viewportWidth);
    if (isStickyLeftColumn(columnId)) fixedTotal += width;
    else flexibleTotal += width;
  });

  if (flexibleTotal === 0 || containerWidth <= fixedTotal + flexibleTotal) return {};

  const scale = (containerWidth - fixedTotal) / flexibleTotal;
  return Object.fromEntries(
    columnIds
      .filter((columnId) => !isStickyLeftColumn(columnId))
      .map((columnId) => [
        columnId,
        Math.floor(getTableColumnBaseWidth(columnId, viewportWidth) * scale),
      ]),
  );
};

/** Rendered height of a collapsed key row (md:h-11). */
export const TABLE_ROW_HEIGHT_ESTIMATE = 44;

export const KEY_PAGE_SIZE_PRESETS = [10, 30, 50, 100];
export const DEFAULT_KEY_PAGE_SIZE = KEY_PAGE_SIZE_PRESETS[0];
export const ALL_KEYS_PAGE_SIZE = "all";
export type KeyPageSize = number | typeof ALL_KEYS_PAGE_SIZE;

/**
 * Reads the `pageSize` URL value. "all" opens the virtualized All view. A number above the largest
 * preset is an old bookmarked "All (n)" link and also opens the All view; any other positive number
 * snaps up to the nearest preset. Anything else is invalid (null), so the default applies.
 */
export const parseKeyPageSize = (value: string): KeyPageSize | null => {
  if (value === ALL_KEYS_PAGE_SIZE) return ALL_KEYS_PAGE_SIZE;
  if (!/^\d+$/.test(value)) return null;
  const pageSize = Number(value);
  if (pageSize <= 0) return null;
  return KEY_PAGE_SIZE_PRESETS.find((preset) => preset >= pageSize) ?? ALL_KEYS_PAGE_SIZE;
};

/**
 * The rows-per-page select lists the total itself as its "All (n)" option. Picking it means the
 * All view, unless the total is itself a preset, where one page of that size already shows everything.
 */
export const toKeyPageSize = (selected: number, totalCount: number): KeyPageSize =>
  selected === totalCount && !KEY_PAGE_SIZE_PRESETS.includes(selected)
    ? ALL_KEYS_PAGE_SIZE
    : selected;

/** The Key/Gets error code (e.g. CURSOR_MISMATCH) carried in a failed request's `errors` map. */
export const getKeyListErrorCode = (error: unknown): string | undefined => {
  const errors = (error as { errors?: Record<string, string | string[]> } | null)?.errors;
  if (!errors || typeof errors !== "object") return undefined;
  return Object.values(errors).flat()[0];
};

export const getPageSizeOptions = (totalCount: number) => {
  const fixedOptions = KEY_PAGE_SIZE_PRESETS;
  // A single page already shows everything, so no "All" option is needed.
  if (totalCount <= fixedOptions[0]) return [fixedOptions[0]];
  // Exclude options equal to totalCount so it is not listed twice.
  return fixedOptions.filter((option) => option < totalCount).concat(totalCount);
};

/** Whether every one of the rows is selected; false when there are none. */
export const areAllRowsSelected = (rowIds: string[], selection: RowSelectionState) =>
  rowIds.length > 0 && rowIds.every((rowId) => selection[rowId]);

/** The selection with the rows added; the same object when they already all are. */
export const withRowsSelected = (selection: RowSelectionState, rowIds: string[]) => {
  const unselected = rowIds.filter((rowId) => !selection[rowId]);
  if (unselected.length === 0) return selection;
  return { ...selection, ...Object.fromEntries(unselected.map((rowId) => [rowId, true])) };
};
