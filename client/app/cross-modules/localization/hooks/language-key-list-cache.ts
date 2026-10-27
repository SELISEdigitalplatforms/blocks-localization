import type { InfiniteData, QueryClient, QueryKey } from "@tanstack/react-query";
import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";
import type {
  IBlocksLanguageKey,
  IBlocksLanguageKeyResponse,
} from "@blocks-localization/models/language";

/** Rewrites the loaded rows of the All view, e.g. to replace an edited key or drop deleted ones. */
export type LanguageKeyRowsPatch = (keys: IBlocksLanguageKey[]) => IBlocksLanguageKey[];

/**
 * How a mutation affects the All view: `patch` applies a change it already knows to the loaded rows,
 * `keep` leaves them (nothing visible changed yet), `reset` reloads from the first chunk.
 */
export type AllViewRefresh = "reset" | "keep" | LanguageKeyRowsPatch;

const isAllViewQuery = (queryKey: QueryKey) =>
  queryKey[1] === localizationQueryKeys.languageKeys.infinitePrefix[1];

/**
 * Refreshes key lists after a mutation. Paged lists are invalidated exactly as before. The All view is
 * never invalidated, because refetching it would re-request every loaded chunk (up to 50 calls);
 * it is patched, kept or reset to its first chunk instead.
 */
export const refreshLanguageKeyLists = (queryClient: QueryClient, allView: AllViewRefresh) => {
  void queryClient.invalidateQueries({
    queryKey: localizationQueryKeys.languageKeys.all,
    predicate: (query) => !isAllViewQuery(query.queryKey),
  });

  if (allView === "keep") return;
  if (allView === "reset") {
    void queryClient.resetQueries({ queryKey: localizationQueryKeys.languageKeys.infinitePrefix });
    return;
  }

  queryClient.setQueriesData<InfiniteData<IBlocksLanguageKeyResponse>>(
    { queryKey: localizationQueryKeys.languageKeys.infinitePrefix },
    (data) => {
      if (!data) return data;
      let removed = 0;
      const pages = data.pages.map((page) => {
        const keys = allView(page.keys);
        removed += page.keys.length - keys.length;
        return { ...page, keys };
      });
      if (removed === 0) return { ...data, pages };
      return {
        ...data,
        pages: pages.map((page) => ({
          ...page,
          totalCount: page.totalCount === null ? null : Math.max(page.totalCount - removed, 0),
        })),
      };
    },
  );
};

/**
 * Replaces loaded rows with saved versions (matched by itemId). A save payload carries no
 * lastUpdateDate, so the row is stamped as updated now, as the server does on save.
 */
export const replaceLanguageKeyRows =
  (saved: Array<Partial<IBlocksLanguageKey> & { itemId: string }>): LanguageKeyRowsPatch =>
  (keys) => {
    const savedById = new Map(saved.map((key) => [key.itemId, key]));
    const now = new Date().toISOString();
    return keys.map((key) => {
      const update = savedById.get(key.itemId);
      return update ? { ...key, ...update, lastUpdateDate: update.lastUpdateDate ?? now } : key;
    });
  };

/**
 * How a key save refreshes the All view: a refused save changed nothing, a new key needs its
 * sorted position so the view reloads, and edited keys are swapped in place.
 */
export const allViewRefreshAfterSave = (
  response: { success?: boolean } | undefined,
  hasNewKey: boolean,
  savedKeys: Parameters<typeof replaceLanguageKeyRows>[0],
): AllViewRefresh => {
  if (response?.success === false) return "keep";
  if (hasNewKey) return "reset";
  return replaceLanguageKeyRows(savedKeys);
};

export const removeLanguageKeyRows =
  (itemIds: string[]): LanguageKeyRowsPatch =>
  (keys) => {
    const removedIds = new Set(itemIds);
    return keys.filter((key) => !removedIds.has(key.itemId));
  };
