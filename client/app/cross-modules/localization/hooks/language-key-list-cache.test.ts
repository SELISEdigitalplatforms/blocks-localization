import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { localizationQueryKeys } from "../constants/query-keys";
import {
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
const allViewKey = localizationQueryKeys.languageKeys.infinite(
  "t1",
  "",
  [],
  "KeyName",
  false,
  "",
  "",
  "",
  "",
  [],
  [],
);

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
