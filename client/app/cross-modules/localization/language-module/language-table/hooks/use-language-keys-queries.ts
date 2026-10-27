import { useMemo } from "react";
import type { useKeysFilterQueryParams } from "@blocks-localization/components/language-table-toolbar/language-table-toolbar";
import {
  useGetBlocksLanguageKey,
  useGetBlocksLanguageKeysInfinite,
} from "@blocks-localization/hooks/use-language-manager";
import {
  ALL_KEYS_PAGE_SIZE,
  DEFAULT_KEY_PAGE_SIZE,
  getInclusiveDateRange,
} from "../language-table.utils";

interface UseLanguageKeysQueriesOptions {
  queryParams: ReturnType<typeof useKeysFilterQueryParams>["queryParams"];
  sortQueryParams: { property: string; isDescending: boolean };
  resourceSearchFilters: { culture: string; searchText: string }[];
}

/**
 * The keys table reads from one of two queries: numbered pages, or the chunked All view. Both are
 * declared (only the active one is enabled) and this returns the active view's rows and state.
 */
export const useLanguageKeysQueries = ({
  queryParams,
  sortQueryParams,
  resourceSearchFilters,
}: UseLanguageKeysQueriesOptions) => {
  // "all" is the virtualized All view (chunked, cursor-based); a number is a regular page size.
  const isAllView = queryParams.pageSize === ALL_KEYS_PAGE_SIZE;
  const pagedPageSize =
    queryParams.pageSize === ALL_KEYS_PAGE_SIZE
      ? DEFAULT_KEY_PAGE_SIZE
      : (queryParams.pageSize ?? DEFAULT_KEY_PAGE_SIZE);
  const createDateRange = getInclusiveDateRange(
    queryParams.createStartDate,
    queryParams.createEndDate,
  );
  const lastUpdateDateRange = getInclusiveDateRange(
    queryParams.lastUpdateStartDate,
    queryParams.lastUpdateEndDate,
  );
  const activeResourceSearchFilters =
    resourceSearchFilters.length > 0 ? resourceSearchFilters : undefined;

  const pagedKeysQuery = useGetBlocksLanguageKey(
    queryParams.pageNumber ?? 0,
    pagedPageSize,
    queryParams.search ?? "",
    queryParams.moduleIds ?? [],
    false,
    sortQueryParams.property,
    sortQueryParams.isDescending,
    createDateRange,
    lastUpdateDateRange,
    activeResourceSearchFilters,
    queryParams.missingLanguages ?? [],
    !isAllView,
    queryParams.duplicates,
  );
  const allViewQuery = useGetBlocksLanguageKeysInfinite({
    searchKey: queryParams.search ?? "",
    moduleIds: queryParams.moduleIds ?? [],
    sortProperty: sortQueryParams.property,
    isDescending: sortQueryParams.isDescending,
    createDateRange,
    lastUpdateDateRange,
    resourceSearchFilters: activeResourceSearchFilters,
    missingLanguages: queryParams.missingLanguages ?? [],
    enabled: isAllView,
    onlyDuplicates: queryParams.duplicates,
  });
  const allViewKeys = useMemo(
    () => allViewQuery.data?.pages.flatMap((page) => page.keys) ?? [],
    [allViewQuery.data],
  );
  // Every chunk carries the total forward, so the newest one is current even after eviction.
  const allViewTotalCount = allViewQuery.data?.pages.at(-1)?.totalCount ?? 0;
  const pagedData = pagedKeysQuery.data;

  const refetchLanguageKeys = isAllView
    ? async () => {
        const result = await allViewQuery.refetch();
        return {
          data: {
            totalCount: result.data?.pages.at(-1)?.totalCount ?? 0,
            keys: result.data?.pages.flatMap((page) => page.keys),
          },
        };
      }
    : pagedKeysQuery.refetch;

  const isDuplicatesTruncated = isAllView
    ? allViewQuery.data?.pages.some((page) => page.duplicatesTruncated)
    : pagedData?.duplicatesTruncated;

  return {
    isAllView,
    pagedPageSize,
    createDateRange,
    lastUpdateDateRange,
    allViewQuery,
    allViewKeys,
    allViewTotalCount,
    pagedData,
    isLoading: isAllView ? allViewQuery.isLoading : pagedKeysQuery.isLoading,
    isFetching: isAllView ? allViewQuery.isFetching : pagedKeysQuery.isFetching,
    isPlaceholderData: isAllView ? false : pagedKeysQuery.isPlaceholderData,
    currentTotalCount: isAllView ? allViewTotalCount : (pagedData?.totalCount ?? 0),
    refetchLanguageKeys,
    showDuplicatesTruncatedNote: Boolean(queryParams.duplicates && isDuplicatesTruncated),
  };
};
