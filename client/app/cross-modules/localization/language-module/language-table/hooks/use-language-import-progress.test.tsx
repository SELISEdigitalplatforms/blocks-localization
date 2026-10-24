import { act, renderHook, waitFor } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";

import { toast } from "@/hooks/use-toast";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { useLanguageImportProgress } from "./use-language-import-progress";

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

describe("useLanguageImportProgress", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it("tracks an import until the matching notification and refreshed keys are available", async () => {
    const refetch = vi.fn().mockResolvedValue({ data: { totalCount: 250 } });
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLanguageImportProgress({ totalCount: 0, refetch }), {
      wrapper,
    });

    act(() => {
      result.current.onImportStarted({
        correlationId: "correlation-1",
        fileName: "large-import.csv",
      });
    });

    expect(result.current.progress).toEqual(
      expect.objectContaining({
        status: "processing",
        fileNames: ["large-import.csv"],
      }),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("language-import-export", {
          detail: {
            payload: { responseKey: "correlation-1" },
            DenormalizedPayload: { IsSuccess: true },
          },
        }),
      );
    });

    await waitFor(() => expect(refetch).toHaveBeenCalled());
    await waitFor(() => expect(result.current.progress).toBeNull());
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: "Import complete" }));
  });

  it("ignores notifications for a different import", () => {
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(() => useLanguageImportProgress({ totalCount: 0 }), {
      wrapper,
    });

    act(() => {
      result.current.onImportStarted({
        correlationId: "correlation-1",
        fileName: "large-import.csv",
      });
      window.dispatchEvent(
        new CustomEvent("language-import-export", {
          detail: {
            payload: { responseKey: "another-import" },
            DenormalizedPayload: { IsSuccess: true },
          },
        }),
      );
    });

    expect(result.current.progress?.status).toBe("processing");
  });

  it("keeps refetching modules after import until modules referenced by imported keys appear", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const refetch = vi.fn().mockResolvedValue({
      data: { totalCount: 2, keys: [{ moduleId: "existing" }, { moduleId: "imported" }] },
    });
    // The imported module only becomes readable after the keys do.
    let isImportedModuleReadable = false;
    const fetchModules = vi.fn(async () =>
      isImportedModuleReadable
        ? [{ itemId: "existing" }, { itemId: "imported" }]
        : [{ itemId: "existing" }],
    );
    const { wrapper } = createQueryWrapper();
    const { result } = renderHook(
      () => {
        const modules = useQuery({
          queryKey: localizationQueryKeys.modules.list("tenant-1"),
          queryFn: fetchModules,
        });
        return { modules, importProgress: useLanguageImportProgress({ totalCount: 0, refetch }) };
      },
      { wrapper },
    );

    await waitFor(() => expect(result.current.modules.data).toHaveLength(1));

    act(() => {
      result.current.importProgress.onImportStarted({
        correlationId: "correlation-1",
        fileName: "modules.csv",
      });
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("language-import-export", {
          detail: {
            payload: { responseKey: "correlation-1" },
            DenormalizedPayload: { IsSuccess: true },
          },
        }),
      );
    });

    await waitFor(() => expect(result.current.importProgress.progress).toBeNull());
    expect(result.current.modules.data).toHaveLength(1);
    isImportedModuleReadable = true;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    await waitFor(() => expect(result.current.modules.data).toHaveLength(2));
    const callsAfterSync = fetchModules.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(fetchModules).toHaveBeenCalledTimes(callsAfterSync);
  });
});
