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
  if (columnId === "select") return "sticky left-0 z-10 bg-background";
  if (columnId === "actions") return "sticky left-12 z-10 bg-background";
  return "";
};

export const getStickyBodyCellClassName = (columnId: string) => {
  if (columnId === "select") {
    return "sticky left-0 z-10 bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted";
  }
  if (columnId === "actions") {
    return "sticky left-12 z-10 bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted";
  }
  return "";
};

export const getPageSizeOptions = (totalCount: number) => {
  const fixedOptions = [10, 30, 50, 100];
  if (totalCount > 100) return [...fixedOptions, totalCount];
  if (totalCount > 0)
    return fixedOptions.filter((option) => option <= totalCount).concat(totalCount);
  return [10];
};
