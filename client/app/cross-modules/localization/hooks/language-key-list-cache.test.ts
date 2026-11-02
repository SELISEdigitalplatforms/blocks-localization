import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import { localizationQueryKeys } from "../constants/query-keys";
import {
  allViewRefreshAfterSave,
  GLOSSARY_RECHECK_REFRESH_DELAYS_MS,
  refreshKeysAfterGlossaryChange,
  refreshLanguageKeyLists,
  removeLanguageKeyRows,
  replaceLanguageKeyRows,
} from "./language-key-list-cache";

const pagedKey = localizationQueryKeys.languageKeys.list(
  "t1",
  0,
  10,
  "",
  [],
  false,
  "KeyName",
  false,
  "",
  "",
  "",
  "",
  [],
  [],
);
const allViewKey = localizationQueryKeys.languageKeys.infinite("t1", {
  searchKey: "",
  moduleIds: [],
  sortProperty: "KeyName",
  isDescending: false,
  createStartDate: "",
  createEndDate: "",
  lastUpdateStartDate: "",
  lastUpdateEndDate: "",
  resourceSearchFilters: [],
  missingLanguages: [],
});

const seed = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } });
  queryClient.setQueryData(pagedKey, { totalCount: 2, keys: [] });
  queryClient.setQueryData(allViewKey, {
    pages: [
      { totalCount: 4, keys: [{ itemId: "a" }, { itemId: "b" }], hasMore: true, nextCursor: "c" },
      { totalCount: 4, keys: [{ itemId: "c" }, { itemId: "d" }], hasMore: false, nextCursor: null },
    ],
    pageParams: [null, "c"],
  });
  return queryClient;
};

type AllViewData = {
  pages: Array<{ totalCount: number; keys: Array<{ itemId: string; keyName?: string }> }>;
};

describe("refreshLanguageKeyLists", () => {
  it("invalidates paged lists but never the All view", () => {
    const queryClient = seed();
    refreshLanguageKeyLists(queryClient, "keep");

    expect(queryClient.getQueryState(pagedKey)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(allViewKey)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(allViewKey)).toBeDefined();
  });

  it("removes deleted rows from every loaded chunk and lowers the total on each", () => {
    const queryClient = seed();
    refreshLanguageKeyLists(queryClient, removeLanguageKeyRows(["b", "c"]));

    const data = queryClient.getQueryData<AllViewData>(allViewKey)!;
    expect(data.pages.flatMap((page) => page.keys.map((key) => key.itemId))).toEqual(["a", "d"]);
    expect(data.pages.map((page) => page.totalCount)).toEqual([2, 2]);
  });

  it("replaces an edited row in place and keeps the total", () => {
    const queryClient = seed();
    refreshLanguageKeyLists(
      queryClient,
      replaceLanguageKeyRows([{ itemId: "c", keyName: "renamed" }]),
    );

    const data = queryClient.getQueryData<AllViewData>(allViewKey)!;
    expect(data.pages[1].keys[0]).toMatchObject({ itemId: "c", keyName: "renamed" });
    expect(data.pages.map((page) => page.totalCount)).toEqual([4, 4]);
  });

  it("resets the All view to reload from its first chunk", () => {
    const queryClient = seed();
    refreshLanguageKeyLists(queryClient, "reset");

    expect(queryClient.getQueryData(allViewKey)).toBeUndefined();
  });
});

describe("allViewRefreshAfterSave", () => {
  const saved = [{ itemId: "c", keyName: "renamed" }];

  it("keeps the rows when the server refused the save, even for a new key", () => {
    expect(allViewRefreshAfterSave({ success: false }, true, saved)).toBe("keep");
  });

  it("reloads when the save added a key", () => {
    expect(allViewRefreshAfterSave({ success: true }, true, saved)).toBe("reset");
  });

  it.each([{ success: true }, undefined])(
    "patches the saved rows in place (response %o)",
    (response) => {
      const patch = allViewRefreshAfterSave(response, false, saved);
      expect(typeof patch).toBe("function");
      expect((patch as (keys: { itemId: string }[]) => unknown)([{ itemId: "c" }])).toEqual([
        expect.objectContaining({ itemId: "c", keyName: "renamed" }),
      ]);
    },
  );
});

describe("refreshKeysAfterGlossaryChange", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refreshes now and again after the worker's re-check is likely done", () => {
    vi.useFakeTimers();
    const queryClient = seed();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    refreshKeysAfterGlossaryChange(queryClient);
    const callsNow = invalidate.mock.calls.length;
    expect(callsNow).toBeGreaterThan(0);
    expect(queryClient.getQueryState(pagedKey)?.isInvalidated).toBe(true);

    vi.advanceTimersByTime(GLOSSARY_RECHECK_REFRESH_DELAYS_MS[0]);
    expect(invalidate.mock.calls.length).toBe(callsNow * 2);
    vi.advanceTimersByTime(GLOSSARY_RECHECK_REFRESH_DELAYS_MS[1]);
    expect(invalidate.mock.calls.length).toBe(callsNow * 3);
  });

  it("drops an All view that is not on screen and never refetches one that is", () => {
    const queryClient = seed();
    refreshKeysAfterGlossaryChange(queryClient);
    // No observer in this test, so the All view is inactive and is dropped.
    expect(queryClient.getQueryData(allViewKey)).toBeUndefined();

    const mounted = seed();
    const observer = new QueryObserver(mounted, {
      queryKey: allViewKey,
      queryFn: () => new Promise<never>(() => {}),
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    refreshKeysAfterGlossaryChange(mounted);
    expect(mounted.getQueryData(allViewKey)).toBeDefined();
    expect(mounted.getQueryState(allViewKey)?.isInvalidated).toBe(false);
    unsubscribe();
  });
});
