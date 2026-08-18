import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/hooks/use-toast";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { useLanguageImportProgress } from "./use-language-import-progress";

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

describe("useLanguageImportProgress", () => {
  beforeEach(() => vi.clearAllMocks());

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
});
