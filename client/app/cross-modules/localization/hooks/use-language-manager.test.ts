import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import * as hooks from "./use-language-manager";

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: {
    fetchBlocksLanguageKey: vi.fn(),
    fetchBlocksLanguageKeyById: vi.fn(),
    fetchBlocksLanguageModules: vi.fn(),
    fetchBlocksLanguages: vi.fn(),
    saveBlocksLanguageKey: vi.fn(),
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

const renderQ = <T,>(cb: () => T) => {
  const { wrapper } = createQueryWrapper();
  return renderHook(cb, { wrapper });
};

describe("localization/hooks/use-language-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Query hooks ────────────────────────────────────────────────────────────
  it("useGetBlocksLanguageKey should fetch keys and pass filters", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({ totalCount: 1, keys: [] } as never);
    const { result } = renderQ(() =>
      hooks.useGetBlocksLanguageKey(0, 25, "search", ["m1"], false),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.fetchBlocksLanguageKey).toHaveBeenCalledWith(
      expect.objectContaining({ pageNumber: 0, pageSize: 25, searchKey: "search" }),
    );
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
    const { result } = renderQ(() =>
      hooks.useGetExportHistory(0, 20, "pk", { searchText: "x" }),
    );
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
    expect(svc.fetchGlossaries).toHaveBeenCalledWith(
      expect.objectContaining({ isGlobal: true }),
    );
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

  it("useGetKeysByGlossaryId should paginate filtered keys", async () => {
    svc.fetchBlocksLanguageKey.mockResolvedValue({
      totalCount: 3,
      keys: [{ itemId: "a" }, { itemId: "b" }, { itemId: "c" }],
    } as never);
    const { result } = renderQ(() =>
      hooks.useGetKeysByGlossaryId("g1", ["m1"], 0, 2),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      totalCount: 3,
      keys: [{ itemId: "a" }, { itemId: "b" }],
    });
  });

  it("useGetKeysByGlossaryId should be disabled without moduleIds", () => {
    const { result } = renderQ(() =>
      hooks.useGetKeysByGlossaryId("g1", [], 0, 2),
    );
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
      renderQ(() =>
        hooks.useTranslateKeyWithPolling("k1", "tenant-1", onComplete),
      );
      await vi.advanceTimersByTimeAsync(2000);
      expect(svc.fetchBlocksLanguageKeyById).toHaveBeenCalledWith({ itemId: "k1" });
      await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
    });

    it("should keep polling while translations are incomplete", async () => {
      vi.useFakeTimers();
      svc.fetchBlocksLanguageKeyById.mockResolvedValue({
        resources: [{ culture: "en-US", value: "Hello" }],
      } as never);
      renderQ(() =>
        hooks.useTranslateKeyWithPolling("k1", "tenant-1", undefined),
      );
      await vi.advanceTimersByTimeAsync(2000);
      const firstCallCount = svc.fetchBlocksLanguageKeyById.mock.calls.length;
      await vi.advanceTimersByTimeAsync(2000);
      expect(
        svc.fetchBlocksLanguageKeyById.mock.calls.length,
      ).toBeGreaterThan(firstCallCount);
    });

    it("should keep polling after a fetch error", async () => {
      vi.useFakeTimers();
      svc.fetchBlocksLanguageKeyById.mockRejectedValue(new Error("boom"));
      renderQ(() =>
        hooks.useTranslateKeyWithPolling("k1", "tenant-1", undefined),
      );
      await vi.advanceTimersByTimeAsync(2000);
      expect(svc.fetchBlocksLanguageKeyById).toHaveBeenCalled();
    });
  });
});
