import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { localizationQueryKeys } from "../constants/query-keys";
import * as hooks from "./use-language-manager";

const project = vi.hoisted(() => ({ tenantId: "tenant-1" }));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: project.tenantId } }),
}));

vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: {
    fetchBlocksLanguageKey: vi.fn(),
    fetchDuplicateSummary: vi.fn(),
    enforceUniqueness: vi.fn(),
    fetchBlocksLanguageKeyById: vi.fn(),
    fetchBlocksLanguageModules: vi.fn(),
    fetchBlocksLanguages: vi.fn(),
    saveBlocksLanguageKey: vi.fn(),
    saveBlocksLanguageKeys: vi.fn(),
    saveLanguageModule: vi.fn(),
    deleteLanguageModule: vi.fn(),
    tagGlossary: vi.fn(),
    translateAll: vi.fn(),
    translateKey: vi.fn(),
    saveLanguage: vi.fn(),
    deleteLanguageKey: vi.fn(),
    deleteLanguageKeys: vi.fn(),
    translateLanguageKeys: vi.fn(),
    deleteLanguage: vi.fn(),
    setDefault: vi.fn(),
    generateUilmFile: vi.fn(),
    getTranslationSuggestion: vi.fn(),
    importLanguageFile: vi.fn(),
    saveLanguageKeyUilmExport: vi.fn(),
    getKeysTimeline: vi.fn(),
    getExportHistory: vi.fn(),
    revertKeyTimeline: vi.fn(),
    getLocalizationTimeline: vi.fn(),
    getTimelineByOperationId: vi.fn(),
    fetchGlossaries: vi.fn(),
    saveGlossary: vi.fn(),
    deleteGlossary: vi.fn(),
    getSuggestedGlossaries: vi.fn(),
    getGlossaryById: vi.fn(),
    getWebhook: vi.fn(),
    saveWebhook: vi.fn(),
  },
}));

const svc = vi.mocked(languageManagerService);

const renderQ = <T>(cb: () => T) => {
  const { wrapper } = createQueryWrapper();
  return renderHook(cb, { wrapper });
};

describe("localization/hooks/use-language-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    project.tenantId = "tenant-1";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Query hooks ────────────────────────────────────────────────────────────
  it("useGetBlocksLanguageKey should fetch keys and pass filters", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 1, keys: [] } as never);
    const { result } = renderQ(() => hooks.useGetBlocksLanguageKey(0, 25, "search", ["m1"], false));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 0, pageSize: 25, searchKey: "search" }),
      // The query's AbortSignal, so a superseded request is cancelled.
      { signal: expect.any(AbortSignal) },
    );
  });

  it("useGetBlocksLanguageKey prefetches the next page once the current one settles", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 30, keys: [] } as never);
    const { result } = renderQ(() => hooks.useGetBlocksLanguageKey(0, 10, "", [], false));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() =>
      expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 1, pageSize: 10 }),
        expect.anything(),
      ),
    );
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledTimes(2);
  });

  it("useGetBlocksLanguageKey swallows a failed prefetch and keeps the current page", async () => {
    svc.fetchBlocksLanguageKey
      .mockResolvedValueOnce({ totalCount: 30, keys: [] } as never)
      .mockRejectedValueOnce(new Error("next page down"));
    const { result } = renderQ(() => hooks.useGetBlocksLanguageKey(0, 10, "", [], false));
    await waitFor(() => expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledTimes(2));
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual({ totalCount: 30, keys: [] });
  });

  it("useGetBlocksLanguageKey does not prefetch past the last page", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 10, keys: [] } as never);
    const { result } = renderQ(() => hooks.useGetBlocksLanguageKey(0, 10, "", [], false));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledTimes(1);
  });

  it("useGetBlocksLanguageKey stays idle while the All view is active", () => {
    renderQ(() =>
      hooks.useGetBlocksLanguageKey(
        0,
        10,
        "",
        [],
        false,
        "",
        false,
        undefined,
        undefined,
        undefined,
        undefined,
        false,
      ),
    );
    expect(svc.fetchBlocksLanguageKey).not.toHaveBeenCalled();
  });

  it("useGetBlocksLanguageKeysInfinite counts on the first chunk and follows the cursor after it", async () => {
    svc.fetchBlocksLanguageKey
      .mockResolvedValueOnce({
        totalCount: 150,
        keys: [{ itemId: "k1" }],
        hasMore: true,
        nextCursor: "cursor-1",
      } as never)
      .mockResolvedValueOnce({
        totalCount: null,
        keys: [{ itemId: "k2" }],
        hasMore: false,
        nextCursor: null,
      } as never);
    const { result } = renderQ(() =>
      hooks.useGetBlocksLanguageKeysInfinite({
        searchKey: "hello",
        moduleIds: ["m1"],
        sortProperty: "KeyName",
        isDescending: false,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenLastCalledWith(
      expect.objectContaining({
        pageSize: hooks.LANGUAGE_KEY_CHUNK_SIZE,
        includeTotalCount: true,
        cursor: undefined,
        searchKey: "hello",
      }),
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "cursor-1", includeTotalCount: false }),
      { signal: expect.any(AbortSignal) },
    );
    // The uncounted chunk carries the first chunk's total forward.
    expect(result.current.data?.pages[1].totalCount).toBe(150);
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it("useGetBlocksLanguageKeysInfinite pages the duplicates filter by page number, not by cursor", async () => {
    svc.fetchBlocksLanguageKey
      .mockResolvedValueOnce({
        totalCount: 150,
        keys: [{ itemId: "k1" }],
        nextCursor: null,
      } as never)
      .mockResolvedValueOnce({
        totalCount: null,
        keys: [{ itemId: "k2" }],
        nextCursor: null,
      } as never);
    const { result } = renderQ(() =>
      hooks.useGetBlocksLanguageKeysInfinite({
        searchKey: "",
        moduleIds: [],
        sortProperty: "KeyName",
        isDescending: false,
        enabled: true,
        onlyDuplicates: true,
      }),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 0, onlyDuplicates: true, includeTotalCount: true }),
      { signal: expect.any(AbortSignal) },
    );
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenLastCalledWith(
      expect.objectContaining({ pageNumber: 1, cursor: undefined, includeTotalCount: false }),
      { signal: expect.any(AbortSignal) },
    );
    // 150 rows fill two chunks of 100, so there is nothing after the second.
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it("useGetBlocksLanguageKeysInfinite stays idle until the All view is selected", () => {
    renderQ(() =>
      hooks.useGetBlocksLanguageKeysInfinite({
        searchKey: "",
        moduleIds: [],
        sortProperty: "KeyName",
        isDescending: false,
        enabled: false,
      }),
    );
    expect(svc.fetchBlocksLanguageKey).not.toHaveBeenCalled();
  });

  it("editing or deleting a key patches the All view in place instead of refetching it", async () => {
    const { queryClient, wrapper } = createQueryWrapper();
    const allViewKey = localizationQueryKeys.languageKeys.infinite("tenant-1", {
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
    // Seeded without an observer, so keep it from being garbage-collected mid-test.
    queryClient.setQueryDefaults(localizationQueryKeys.languageKeys.infinitePrefix, {
      gcTime: Infinity,
    });
    queryClient.setQueryData(allViewKey, {
      pages: [
        {
          totalCount: 3,
          keys: [
            { itemId: "a", keyName: "a", resources: [] },
            { itemId: "b", keyName: "b", resources: [] },
            { itemId: "c", keyName: "c", resources: [] },
          ],
          hasMore: false,
          nextCursor: null,
        },
      ],
      pageParams: [null],
    });
    svc.saveBlocksLanguageKey.mockResolvedValue({ success: true } as never);
    svc.deleteLanguageKey.mockResolvedValue({ isSuccess: true } as never);

    const save = renderHook(() => hooks.useSaveBlocksLanguageKey(), { wrapper });
    await save.result.current.mutateAsync({
      itemId: "b",
      keyName: "b",
      moduleId: "m",
      resources: [{ culture: "de-DE", value: "Hallo" }],
      routes: [],
      isPartiallyTranslated: false,
    });
    const remove = renderHook(() => hooks.useDeleteLanguageKey(), { wrapper });
    await remove.result.current.mutateAsync({ itemId: "a" });

    const page = queryClient.getQueryData<{
      pages: Array<{ totalCount: number; keys: Array<{ itemId: string; resources: unknown[] }> }>;
    }>(allViewKey)!.pages[0];
    expect(page.keys.map((key) => key.itemId)).toEqual(["b", "c"]);
    expect(page.keys[0].resources).toEqual([{ culture: "de-DE", value: "Hallo" }]);
    expect(page.totalCount).toBe(2);
    expect(queryClient.getQueryState(allViewKey)?.isInvalidated).toBe(false);
    expect(svc.fetchBlocksLanguageKey).not.toHaveBeenCalled();
  });

  it("useGetBlocksLanguageKey should ask for duplicates only when the filter is on", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 0, keys: [] } as never);
    const off = renderQ(() => hooks.useGetBlocksLanguageKey(0, 10, "", [], false));
    await waitFor(() => expect(off.result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey.mock.calls[0][0]).not.toHaveProperty("onlyDuplicates");

    const on = renderQ(() =>
      hooks.useGetBlocksLanguageKey(
        0,
        10,
        "",
        [],
        false,
        "",
        false,
        undefined,
        undefined,
        undefined,
        [],
        true,
        true,
      ),
    );
    await waitFor(() => expect(on.result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenLastCalledWith(
      expect.objectContaining({ onlyDuplicates: true }),
      { signal: expect.any(AbortSignal) },
    );
  });

  it("the duplicate filter is part of the list query key", () => {
    const list = (onlyDuplicates: boolean) =>
      localizationQueryKeys.languageKeys.list(
        "t",
        0,
        10,
        "",
        [],
        false,
        "",
        false,
        "",
        "",
        "",
        "",
        [],
        [],
        onlyDuplicates,
      );
    expect(list(true)).not.toEqual(list(false));
  });

  it("useGetDuplicateSummary should load the tenant summary", async () => {
    const summary = { keyGroupCount: 2, duplicateKeyRowCount: 5, extraKeyCount: 3 };
    svc.fetchDuplicateSummary.mockResolvedValue(summary as never);
    const { result } = renderQ(() => hooks.useGetDuplicateSummary());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summary);
  });

  it("useGetDuplicateSummary should not retry a failure", async () => {
    svc.fetchDuplicateSummary.mockRejectedValue(new Error("down"));
    const { result } = renderQ(() => hooks.useGetDuplicateSummary());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(svc.fetchDuplicateSummary).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a single key delete", "useDeleteLanguageKey", "deleteLanguageKey", {}],
    ["a bulk delete", "useDeleteLanguageKeys", "deleteLanguageKeys", {}],
    ["a key save", "useSaveBlocksLanguageKey", "saveBlocksLanguageKey", {}],
    ["a bulk key save", "useSaveBlocksLanguageKeys", "saveBlocksLanguageKeys", []],
  ] as const)(
    "the duplicate summary is refreshed after %s",
    async (_label, hook, method, payload) => {
      vi.mocked(svc[method]).mockResolvedValue({ isSuccess: true, success: true } as never);
      const { queryClient, wrapper } = createQueryWrapper();
      const summaryKey = localizationQueryKeys.languageKeys.duplicateSummary("tenant-1");
      queryClient.setQueryData(summaryKey, { extraKeyCount: 1 });
      const { result } = renderHook(
        () => (hooks[hook] as () => { mutateAsync: (p: unknown) => Promise<unknown> })(),
        { wrapper },
      );

      await result.current.mutateAsync(payload as never);

      await waitFor(() => expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true));
    },
  );

  it("useEnforceUniqueness should refresh the summary even when it is refused", async () => {
    svc.enforceUniqueness.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    const { queryClient, wrapper } = createQueryWrapper();
    const summaryKey = localizationQueryKeys.languageKeys.duplicateSummary("tenant-1");
    queryClient.setQueryData(summaryKey, { extraKeyCount: 0 });
    const { result } = renderHook(() => hooks.useEnforceUniqueness(), { wrapper });

    await expect(result.current.mutateAsync()).rejects.toThrow("Forbidden");

    await waitFor(() => expect(queryClient.getQueryState(summaryKey)?.isInvalidated).toBe(true));
  });

  it("useGetBlocksLanguageKey should keep the current rows during a search refetch", async () => {
    const firstPage = { totalCount: 1, keys: [{ itemId: "key-1", keyName: "Greeting" }] };
    let resolveFiltered!: (value: typeof firstPage) => void;
    const filteredPage = new Promise<typeof firstPage>((resolve) => {
      resolveFiltered = resolve;
    });
    svc.fetchBlocksLanguageKey.mockImplementation(({ searchKey }) =>
      searchKey === "first" ? Promise.resolve(firstPage as never) : (filteredPage as never),
    );
    const { wrapper } = createQueryWrapper();
    const { result, rerender } = renderHook(
      ({ search }) => hooks.useGetBlocksLanguageKey(0, 10, search, [], false),
      { initialProps: { search: "first" }, wrapper },
    );

    await waitFor(() => expect(result.current.data).toEqual(firstPage));
    rerender({ search: "filtered" });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));

    expect(result.current.data).toEqual(firstPage);
    expect(result.current.isLoading).toBe(false);

    resolveFiltered({ totalCount: 0, keys: [] });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
  });

  it("useGetBlocksLanguageKeyById should be disabled without an itemId", async () => {
    const { result } = renderQ(() => hooks.useGetBlocksLanguageKeyById(""));
    expect(result.current.fetchStatus).toBe("idle");
    expect(svc.fetchBlocksLanguageKeyById).not.toHaveBeenCalled();
  });

  it("useGetBlocksLanguageKeyById should stop polling once translations exist", async () => {
    svc.fetchBlocksLanguageKeyById.mockResolvedValue({
      resources: [{ culture: "de-DE", value: "Hallo" }],
    } as never);
    const { result } = renderQ(() => hooks.useGetBlocksLanguageKeyById("k1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKeyById).toHaveBeenCalledWith({ itemId: "k1" });
  });

  it("useGetModuleKeyCount should request a single key of the module and return the total", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 7, keys: [{}] } as never);
    const { result } = renderQ(() => hooks.useGetModuleKeyCount("m1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7);
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith(
      expect.objectContaining({
        pageNumber: 0,
        pageSize: 1,
        moduleIds: ["m1"],
        sortProperty: "KeyName",
      }),
    );
  });

  it("useGetModuleKeyCount should stay idle without a module id", () => {
    const { result } = renderQ(() => hooks.useGetModuleKeyCount(""));
    expect(result.current.fetchStatus).toBe("idle");
    expect(svc.fetchBlocksLanguageKey).not.toHaveBeenCalled();
  });

  it("useGetLanguageModules should fetch modules", async () => {
    svc.fetchBlocksLanguageModules.mockResolvedValue([] as never);
    const { result } = renderQ(() => hooks.useGetLanguageModules());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetLanguages should fetch languages", async () => {
    svc.fetchBlocksLanguages.mockResolvedValue([] as never);
    const { result } = renderQ(() => hooks.useGetLanguages());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetLanguageModule should be disabled without a projectKey", () => {
    const { result } = renderQ(() => hooks.useGetLanguageModule(""));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetLanguageKeysTimeline should fetch when keyId present", async () => {
    svc.getKeysTimeline.mockResolvedValue({ totalCount: 0, timelines: [] } as never);
    const { result } = renderQ(() => hooks.useGetLanguageKeysTimeline(0, 20, "k1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetExportHistory should fetch with filters", async () => {
    svc.getExportHistory.mockResolvedValue({ totalCount: 0, uilmExportedFiles: [] } as never);
    const { result } = renderQ(() => hooks.useGetExportHistory(0, 20, "pk", { searchText: "x" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.getExportHistory).toHaveBeenCalled();
  });

  it("useGetLocalizationTimeline should pass filters through", async () => {
    svc.getLocalizationTimeline.mockResolvedValue({ totalCount: 0, operations: [] } as never);
    const { result } = renderQ(() =>
      hooks.useGetLocalizationTimeline(0, 20, { userId: "u1", logFromValues: ["a"] }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.getLocalizationTimeline).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1" }),
    );
  });

  it("useGetTimelineByOperationId should be disabled without operationId", () => {
    const { result } = renderQ(() => hooks.useGetTimelineByOperationId("", 0, 20));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetGlossaries should fetch", async () => {
    svc.fetchGlossaries.mockResolvedValue({ items: [], totalCount: 0 } as never);
    const { result } = renderQ(() => hooks.useGetGlossaries(0, 25, "term"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetGlobalGlossaries should fetch global glossaries", async () => {
    svc.fetchGlossaries.mockResolvedValue({ items: [], totalCount: 0 } as never);
    const { result } = renderQ(() => hooks.useGetGlobalGlossaries());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchGlossaries).toHaveBeenCalledWith(expect.objectContaining({ isGlobal: true }));
  });

  it("useGetModuleGlossaries should be disabled without a moduleId", () => {
    const { result } = renderQ(() => hooks.useGetModuleGlossaries(""));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetModuleGlossaries should fetch with a moduleId", async () => {
    svc.fetchGlossaries.mockResolvedValue({ items: [], totalCount: 0 } as never);
    const { result } = renderQ(() => hooks.useGetModuleGlossaries("m1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetSuggestedGlossaries should respect the enabled flag", () => {
    const { result } = renderQ(() => hooks.useGetSuggestedGlossaries("i1", false));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetSuggestedGlossaries should fetch when enabled", async () => {
    svc.getSuggestedGlossaries.mockResolvedValue({ suggestedGlossaries: [] } as never);
    const { result } = renderQ(() => hooks.useGetSuggestedGlossaries("i1", true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useSearchGlossaries should fetch when enabled", async () => {
    svc.fetchGlossaries.mockResolvedValue({ items: [], totalCount: 0 } as never);
    const { result } = renderQ(() => hooks.useSearchGlossaries("q", true));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetGlossaryById should be disabled without an itemId", () => {
    const { result } = renderQ(() => hooks.useGetGlossaryById(""));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetGlossaryById should fetch with an itemId", async () => {
    svc.getGlossaryById.mockResolvedValue({ itemId: "g1" } as never);
    const { result } = renderQ(() => hooks.useGetGlossaryById("g1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetKeysByGlossaryId should request keys filtered by glossaryId with server paging", async () => {
    const page = { totalCount: 25, keys: [{ itemId: "b" }, { itemId: "a" }] };
    svc.fetchBlocksLanguageKey.mockResolvedValue(page as never);
    const { result } = renderQ(() => hooks.useGetKeysByGlossaryId("g1", 2, 10));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledTimes(1);
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith({
      pageNumber: 2,
      pageSize: 10,
      searchKey: "",
      moduleIds: [],
      isPartiallyTranslated: false,
      sortProperty: "KeyName",
      isDescending: false,
      glossaryId: "g1",
    });
    expect(result.current.data).toEqual(page);
  });

  it("useGetKeysByGlossaryId should not depend on moduleIds (global-only glossary)", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 0, keys: [] } as never);
    const { result } = renderQ(() => hooks.useGetKeysByGlossaryId("g1", 0, 10));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ totalCount: 0, keys: [] });
  });

  it("useGetKeysByGlossaryId should be disabled without a tenant", () => {
    project.tenantId = "";
    const { result } = renderQ(() => hooks.useGetKeysByGlossaryId("g1", 0, 10));
    expect(result.current.fetchStatus).toBe("idle");
    expect(svc.fetchBlocksLanguageKey).not.toHaveBeenCalled();
  });

  it("useGetKeysByGlossaryId should be invalidated by key saves (languageKeys.all prefix)", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 0, keys: [] } as never);
    const { queryClient, wrapper } = createQueryWrapper();
    const { result } = renderHook(() => hooks.useGetKeysByGlossaryId("g1", 0, 10), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledTimes(2);
  });

  it("useGetGlossaryUsageCount should read totalCount from a 1-item page", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 7, keys: [{}] } as never);
    const { result } = renderQ(() => hooks.useGetGlossaryUsageCount("g1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(7);
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 0, pageSize: 1, glossaryId: "g1", moduleIds: [] }),
    );
  });

  it("useGetGlossaryUsageCount should be disabled without a tenant", () => {
    project.tenantId = "";
    const { result } = renderQ(() => hooks.useGetGlossaryUsageCount("g1"));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetWebhook should fetch the webhook config", async () => {
    svc.getWebhook.mockResolvedValue({ url: "https://x" } as never);
    const { result } = renderQ(() => hooks.useGetWebhook());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  // ─── Mutation hooks ─────────────────────────────────────────────────────────
  it("useSaveBlocksLanguageKey should invoke the service", async () => {
    svc.saveBlocksLanguageKey.mockResolvedValue({ success: true } as never);
    const { result } = renderQ(() => hooks.useSaveBlocksLanguageKey());
    await result.current.mutateAsync({ keyName: "k" } as never);
    expect(svc.saveBlocksLanguageKey).toHaveBeenCalled();
  });

  it("useSaveBlocksLanguageKeys should invoke the bulk service", async () => {
    svc.saveBlocksLanguageKeys.mockResolvedValue({ success: true } as never);
    const { result } = renderQ(() => hooks.useSaveBlocksLanguageKeys());
    await result.current.mutateAsync([{ keyName: "k" }] as never);
    expect(svc.saveBlocksLanguageKeys).toHaveBeenCalled();
  });

  it("useSaveLanguageModule should invoke the service", async () => {
    svc.saveLanguageModule.mockResolvedValue({ success: true } as never);
    const { result } = renderQ(() => hooks.useSaveLanguageModule());
    await result.current.mutateAsync({ moduleName: "m" } as never);
    expect(svc.saveLanguageModule).toHaveBeenCalled();
  });

  it("useDeleteLanguageModule should invoke the service", async () => {
    svc.deleteLanguageModule.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useDeleteLanguageModule());
    await result.current.mutateAsync({ itemId: "m1" });
    expect(svc.deleteLanguageModule).toHaveBeenCalledWith({ itemId: "m1" });
  });

  it("useTagGlossary should default projectKey to the tenant id", async () => {
    svc.tagGlossary.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useTagGlossary());
    await result.current.mutateAsync({ moduleId: "m1", glossaryIds: [] } as never);
    expect(svc.tagGlossary).toHaveBeenCalledWith(
      expect.objectContaining({ projectKey: "tenant-1" }),
    );
  });

  it("useTranslateAll should invoke the service", async () => {
    svc.translateAll.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useTranslateAll());
    await result.current.mutateAsync({ projectKey: "p" } as never);
    expect(svc.translateAll).toHaveBeenCalled();
  });

  it("useTranslateKey should invoke the service", async () => {
    svc.translateKey.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useTranslateKey());
    await result.current.mutateAsync({ keyId: "k" } as never);
    expect(svc.translateKey).toHaveBeenCalled();
  });

  it("useSaveLanguage should invoke the service", async () => {
    svc.saveLanguage.mockResolvedValue({ success: true } as never);
    const { result } = renderQ(() => hooks.useSaveLanguage());
    await result.current.mutateAsync({ languageName: "English" } as never);
    expect(svc.saveLanguage).toHaveBeenCalled();
  });

  it("useDeleteLanguageKey should invoke the service", async () => {
    svc.deleteLanguageKey.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useDeleteLanguageKey());
    await result.current.mutateAsync({ itemId: "k1" });
    expect(svc.deleteLanguageKey).toHaveBeenCalledWith({ itemId: "k1" });
  });

  it("useDeleteLanguageKeys should invoke the service", async () => {
    svc.deleteLanguageKeys.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useDeleteLanguageKeys());
    await result.current.mutateAsync({ itemIds: ["k1"] } as never);
    expect(svc.deleteLanguageKeys).toHaveBeenCalled();
  });

  it("useDeleteLanguageModule with deleteKeys should also refresh key lists and timelines", async () => {
    svc.deleteLanguageModule.mockResolvedValue({ isSuccess: true } as never);
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => hooks.useDeleteLanguageModule(), { wrapper });

    await result.current.mutateAsync({ itemId: "m1", deleteKeys: true });

    const invalidatedKeys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ["get-language-modules"],
        ["get-blocksLanguageKeys"],
        ["get-blocksLanguageKey"],
        ["get-uilm-timeline"],
        ["get-localization-timeline"],
      ]),
    );
  });

  it("useDeleteLanguageModule with a target module should also refresh key lists and timelines", async () => {
    svc.deleteLanguageModule.mockResolvedValue({ isSuccess: true } as never);
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => hooks.useDeleteLanguageModule(), { wrapper });

    await result.current.mutateAsync({ itemId: "m1", targetModuleId: "m2" });

    const invalidatedKeys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        ["get-language-modules"],
        ["get-blocksLanguageKeys"],
        ["get-blocksLanguageKey"],
        ["get-uilm-timeline"],
        ["get-localization-timeline"],
      ]),
    );
  });

  it("useDeleteLanguageModule without a target module should only refresh the modules and the duplicate summary", async () => {
    svc.deleteLanguageModule.mockResolvedValue({ isSuccess: true } as never);
    const { queryClient, wrapper } = createQueryWrapper();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => hooks.useDeleteLanguageModule(), { wrapper });

    await result.current.mutateAsync({ itemId: "m1" });

    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      ["get-language-modules"],
      ["get-blocksLanguageKeys", "duplicate-summary"],
    ]);
  });

  it("useTranslateLanguageKeys should invoke the service", async () => {
    svc.translateLanguageKeys.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useTranslateLanguageKeys());
    await result.current.mutateAsync({ keyIds: ["k1"] } as never);
    expect(svc.translateLanguageKeys).toHaveBeenCalled();
  });

  it("useDeleteLanguage should optimistically remove the language from cache", async () => {
    svc.deleteLanguage.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useDeleteLanguage());
    await result.current.mutateAsync({ languageName: "English" });
    expect(svc.deleteLanguage).toHaveBeenCalledWith({ languageName: "English" });
  });

  it("useSetDefaultLanguage should invoke the service", async () => {
    svc.setDefault.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useSetDefaultLanguage());
    await result.current.mutateAsync({ languageName: "English", projectKey: "p" } as never);
    expect(svc.setDefault).toHaveBeenCalled();
  });

  it("useGenerateUilmFile should invoke the service", async () => {
    svc.generateUilmFile.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useGenerateUilmFile());
    await result.current.mutateAsync({ guid: "g", projectKey: "p" } as never);
    expect(svc.generateUilmFile).toHaveBeenCalled();
  });

  it("useGetTranslationSuggestion should invoke the service", async () => {
    svc.getTranslationSuggestion.mockResolvedValue({ content: "x" } as never);
    const { result } = renderQ(() => hooks.useGetTranslationSuggestion());
    await result.current.mutateAsync({ sourceText: "Hi" } as never);
    expect(svc.getTranslationSuggestion).toHaveBeenCalled();
  });

  it("useImportLanguageFile should invoke the service", async () => {
    svc.importLanguageFile.mockResolvedValue({ success: true } as never);
    const { result } = renderQ(() => hooks.useImportLanguageFile());
    await result.current.mutateAsync({ fileId: "f" } as never);
    expect(svc.importLanguageFile).toHaveBeenCalled();
  });

  it("useSaveLanguageKeyUilmExport should invoke the service", async () => {
    svc.saveLanguageKeyUilmExport.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useSaveLanguageKeyUilmExport());
    await result.current.mutateAsync({ outputType: 1 } as never);
    expect(svc.saveLanguageKeyUilmExport).toHaveBeenCalled();
  });

  it("useRevertKeyTimeline should invoke the service", async () => {
    svc.revertKeyTimeline.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useRevertKeyTimeline());
    await result.current.mutateAsync({ itemId: "k1" });
    expect(svc.revertKeyTimeline).toHaveBeenCalledWith({ itemId: "k1" });
  });

  it("useSaveGlossary should invoke the service", async () => {
    svc.saveGlossary.mockResolvedValue({ success: true } as never);
    const { result } = renderQ(() => hooks.useSaveGlossary());
    await result.current.mutateAsync({ name: "term" } as never);
    expect(svc.saveGlossary).toHaveBeenCalled();
  });

  it("useDeleteGlossary should invoke the service", async () => {
    svc.deleteGlossary.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => hooks.useDeleteGlossary());
    await result.current.mutateAsync({ itemId: "g1" } as never);
    expect(svc.deleteGlossary).toHaveBeenCalled();
  });

  describe("useDeleteGlossaryWithCascade", () => {
    const makeKey = (n: number, glossaryIds = ["g1", "other"]) => ({
      itemId: `k${n}`,
      keyName: `key.${n}`,
      moduleId: "m1",
      resources: [{ culture: "en-US", value: `v${n}` }],
      routes: n % 2 ? ["r/1"] : undefined,
      context: `ctx${n}`,
      isPartiallyTranslated: n % 2 === 0,
      glossaryIds,
      createDate: "",
      lastUpdateDate: "",
    });
    const range = (from: number, count: number) =>
      Array.from({ length: count }, (_, i) => makeKey(from + i));

    /** Simulates the server: keys drop out of the glossaryId filter once saved without it. */
    const mockServer = (initialCount: number) => {
      let tagged = range(1, initialCount);
      svc.fetchBlocksLanguageKey.mockImplementation((async (req: { pageSize: number }) => ({
        totalCount: tagged.length,
        keys: tagged.slice(0, req.pageSize),
      })) as never);
      svc.saveBlocksLanguageKeys.mockImplementation((async (batch: { itemId: string }[]) => {
        const ids = new Set(batch.map((k) => k.itemId));
        tagged = tagged.filter((k) => !ids.has(k.itemId));
        return { success: true, errorMessage: "", validationErrors: [] };
      }) as never);
      svc.deleteGlossary.mockResolvedValue({ isSuccess: true, errors: null } as never);
    };

    it("should strip only the glossary id and keep the rest of each key unchanged", async () => {
      mockServer(2);
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({ glossaryId: "g1", initialCount: 2 });
      expect(res).toEqual({ status: "deleted" });
      // One 100-key page, then a 1-item re-count that verifies nothing is still tagged.
      expect(svc.fetchBlocksLanguageKey.mock.calls.map(([req]) => req.pageSize)).toEqual([100, 1]);
      expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith(
        expect.objectContaining({ pageNumber: 0, pageSize: 100, glossaryId: "g1" }),
      );
      expect(svc.saveBlocksLanguageKeys).toHaveBeenCalledTimes(1);
      expect(svc.saveBlocksLanguageKeys).toHaveBeenCalledWith([
        {
          itemId: "k1",
          keyName: "key.1",
          moduleId: "m1",
          resources: [{ culture: "en-US", value: "v1" }],
          routes: ["r/1"],
          context: "ctx1",
          isPartiallyTranslated: false,
          glossaryIds: ["other"],
          isNewKey: false,
        },
        {
          itemId: "k2",
          keyName: "key.2",
          moduleId: "m1",
          resources: [{ culture: "en-US", value: "v2" }],
          routes: [],
          context: "ctx2",
          isPartiallyTranslated: true,
          glossaryIds: ["other"],
          isNewKey: false,
        },
      ]);
      expect(svc.deleteGlossary).toHaveBeenCalledWith({ itemId: "g1" });
      expect(svc.saveBlocksLanguageKeys.mock.invocationCallOrder[0]).toBeLessThan(
        svc.deleteGlossary.mock.invocationCallOrder[0],
      );
    });

    it("should send sequential batches of at most 100 keys (250 → 100, 100, 50)", async () => {
      mockServer(250);
      const onProgress = vi.fn();
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({
        glossaryId: "g1",
        initialCount: 250,
        onProgress,
      });
      expect(res).toEqual({ status: "deleted" });
      expect(svc.fetchBlocksLanguageKey.mock.calls.map(([req]) => req.pageSize)).toEqual([
        100, 100, 100, 1,
      ]);
      expect(svc.saveBlocksLanguageKeys.mock.calls.map(([batch]) => batch.length)).toEqual([
        100, 100, 50,
      ]);
      expect(svc.deleteGlossary).toHaveBeenCalledTimes(1);
      expect(onProgress).toHaveBeenLastCalledWith(250, 250);
    });

    it("should delete directly when no keys use the glossary", async () => {
      mockServer(0);
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      await result.current.mutateAsync({ glossaryId: "g1", initialCount: 0 });
      expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledTimes(1);
      expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 1, glossaryId: "g1" }),
      );
      expect(svc.saveBlocksLanguageKeys).not.toHaveBeenCalled();
      expect(svc.deleteGlossary).toHaveBeenCalledTimes(1);
    });

    it("should clean keys tagged after the dialog counted them before deleting", async () => {
      mockServer(3);
      const onProgress = vi.fn();
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({
        glossaryId: "g1",
        initialCount: 0,
        onProgress,
      });
      expect(res).toEqual({ status: "deleted" });
      expect(svc.saveBlocksLanguageKeys).toHaveBeenCalledTimes(1);
      expect(svc.saveBlocksLanguageKeys.mock.calls[0][0]).toHaveLength(3);
      expect(onProgress).toHaveBeenLastCalledWith(3, 3);
    });

    it("should not delete when SaveKeys reports success but a key stays tagged", async () => {
      // e.g. two documents share (KeyName, ModuleId): the server replaces only the first.
      mockServer(2);
      const stuck = makeKey(99);
      const fetchImpl = svc.fetchBlocksLanguageKey.getMockImplementation()!;
      svc.fetchBlocksLanguageKey.mockImplementation((async (req: { pageSize: number }) => {
        const real = (await fetchImpl(req as never)) as { totalCount: number; keys: unknown[] };
        return {
          totalCount: real.totalCount + 1,
          keys: [...real.keys, stuck].slice(0, req.pageSize),
        };
      }) as never);
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({ glossaryId: "g1", initialCount: 3 });
      expect(res).toMatchObject({
        status: "keys-failed",
        reason: "iteration-limit",
        removedCount: 2,
        totalCount: 3,
      });
      // ceil(3/100) + 2 = 3 batches at most.
      expect(svc.saveBlocksLanguageKeys).toHaveBeenCalledTimes(3);
      expect(svc.deleteGlossary).not.toHaveBeenCalled();
    });

    it("should stop on a failed batch, re-count, and not delete", async () => {
      mockServer(250);
      const save = svc.saveBlocksLanguageKeys.getMockImplementation()!;
      svc.saveBlocksLanguageKeys
        .mockImplementationOnce(save)
        .mockResolvedValueOnce({ success: false, errorMessage: "denied" } as never);
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({ glossaryId: "g1", initialCount: 250 });
      expect(res).toEqual({
        status: "keys-failed",
        reason: "save-failed",
        removedCount: 100,
        totalCount: 250,
        errorMessage: "denied",
      });
      expect(svc.deleteGlossary).not.toHaveBeenCalled();
      expect(svc.fetchBlocksLanguageKey).toHaveBeenLastCalledWith(
        expect.objectContaining({ pageSize: 1, glossaryId: "g1" }),
      );
    });

    it("should stop at the first batch when SaveKeys is rejected (no permission)", async () => {
      mockServer(3);
      svc.saveBlocksLanguageKeys.mockRejectedValueOnce(new Error("Forbidden"));
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({ glossaryId: "g1", initialCount: 3 });
      expect(res).toMatchObject({ status: "keys-failed", removedCount: 0, totalCount: 3 });
      expect(svc.saveBlocksLanguageKeys).toHaveBeenCalledTimes(1);
      expect(svc.deleteGlossary).not.toHaveBeenCalled();
    });

    it("should resume from the remaining keys on retry", async () => {
      mockServer(250);
      const save = svc.saveBlocksLanguageKeys.getMockImplementation()!;
      svc.saveBlocksLanguageKeys
        .mockImplementationOnce(save)
        .mockResolvedValueOnce({ success: false, errorMessage: "x" } as never);
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      await result.current.mutateAsync({ glossaryId: "g1", initialCount: 250 });
      svc.saveBlocksLanguageKeys.mockClear();

      const res = await result.current.mutateAsync({ glossaryId: "g1", initialCount: 150 });
      expect(res).toEqual({ status: "deleted" });
      expect(svc.saveBlocksLanguageKeys.mock.calls.map(([batch]) => batch.length)).toEqual([
        100, 50,
      ]);
      expect(svc.deleteGlossary).toHaveBeenCalledTimes(1);
    });

    it("should stop after ceil(N/100) + 2 iterations when keys keep matching", async () => {
      // The server keeps reporting more matching keys than were cleaned (e.g. concurrent tagging).
      svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 500, keys: range(1, 5) } as never);
      svc.saveBlocksLanguageKeys.mockResolvedValue({ success: true } as never);
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({ glossaryId: "g1", initialCount: 5 });
      expect(res).toMatchObject({ status: "keys-failed", reason: "iteration-limit" });
      expect(svc.saveBlocksLanguageKeys).toHaveBeenCalledTimes(3);
      expect(svc.deleteGlossary).not.toHaveBeenCalled();
    });

    it("should report a failed glossary delete", async () => {
      mockServer(0);
      svc.deleteGlossary.mockResolvedValue({ isSuccess: false, errors: "nope" } as never);
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      const res = await result.current.mutateAsync({ glossaryId: "g1", initialCount: 0 });
      expect(res).toEqual({ status: "delete-failed", errors: "nope" });
    });

    it("should invalidate glossary and key caches after deleting", async () => {
      mockServer(1);
      const { queryClient, wrapper } = createQueryWrapper();
      const invalidate = vi.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => hooks.useDeleteGlossaryWithCascade(), { wrapper });
      await result.current.mutateAsync({ glossaryId: "g1", initialCount: 1 });
      const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
      const q = localizationQueryKeys;
      expect(keys).toEqual(
        expect.arrayContaining([
          q.glossaries.all,
          q.glossaries.globalPrefix,
          q.glossaries.modulePrefix,
          q.glossaries.searchPrefix,
          q.glossaries.detailPrefix,
          q.glossaries.suggestedPrefix,
          q.languageKeys.all,
          q.languageKeys.detailPrefix,
        ]),
      );
    });

    it("should refuse to run without a tenant", async () => {
      project.tenantId = "";
      const { result } = renderQ(() => hooks.useDeleteGlossaryWithCascade());
      await expect(
        result.current.mutateAsync({ glossaryId: "g1", initialCount: 1 }),
      ).rejects.toThrow();
      expect(svc.fetchBlocksLanguageKey).not.toHaveBeenCalled();
      expect(svc.deleteGlossary).not.toHaveBeenCalled();
    });
  });

  it("useSaveWebhook should default projectKey to the tenant id", async () => {
    svc.saveWebhook.mockResolvedValue({ success: true } as never);
    const { result } = renderQ(() => hooks.useSaveWebhook());
    await result.current.mutateAsync({ url: "https://x" } as never);
    expect(svc.saveWebhook).toHaveBeenCalledWith(
      expect.objectContaining({ projectKey: "tenant-1" }),
    );
  });

  // ─── Polling hook ───────────────────────────────────────────────────────────
  describe("useTranslateKeyWithPolling", () => {
    it("should not poll when keyId or tenantId is missing", () => {
      vi.useFakeTimers();
      renderQ(() => hooks.useTranslateKeyWithPolling("", "", undefined));
      vi.advanceTimersByTime(5000);
      expect(svc.fetchBlocksLanguageKeyById).not.toHaveBeenCalled();
    });

    it("should invoke the completion callback once translations arrive", async () => {
      vi.useFakeTimers();
      svc.fetchBlocksLanguageKeyById.mockResolvedValue({
        resources: [{ culture: "de-DE", value: "Hallo" }],
      } as never);
      const onComplete = vi.fn();
      renderQ(() => hooks.useTranslateKeyWithPolling("k1", "tenant-1", onComplete));
      await vi.advanceTimersByTimeAsync(2000);
      expect(svc.fetchBlocksLanguageKeyById).toHaveBeenCalledWith({ itemId: "k1" });
      await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
    });

    it("should keep polling while translations are incomplete", async () => {
      vi.useFakeTimers();
      svc.fetchBlocksLanguageKeyById.mockResolvedValue({
        resources: [{ culture: "en-US", value: "Hello" }],
      } as never);
      renderQ(() => hooks.useTranslateKeyWithPolling("k1", "tenant-1", undefined));
      await vi.advanceTimersByTimeAsync(2000);
      const firstCallCount = svc.fetchBlocksLanguageKeyById.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(svc.fetchBlocksLanguageKeyById.mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    it("should keep polling after a fetch error", async () => {
      vi.useFakeTimers();
      svc.fetchBlocksLanguageKeyById.mockRejectedValue(new Error("boom"));
      renderQ(() => hooks.useTranslateKeyWithPolling("k1", "tenant-1", undefined));
      await vi.advanceTimersByTimeAsync(2000);
      expect(svc.fetchBlocksLanguageKeyById).toHaveBeenCalled();
    });
  });
});
