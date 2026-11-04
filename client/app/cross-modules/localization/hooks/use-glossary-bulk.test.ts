import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { IGlossary } from "@blocks-localization/models/language";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { localizationQueryKeys } from "../constants/query-keys";
import { runWithConcurrency, useGlossaryBulk } from "./use-glossary-bulk";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));

vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: {
    saveGlossary: vi.fn(),
    deleteGlossary: vi.fn(),
    tagGlossary: vi.fn(),
  },
}));

const svc = vi.mocked(languageManagerService);

const term = (itemId: string, extra: Partial<IGlossary> = {}): IGlossary => ({
  itemId,
  name: `Term ${itemId}`,
  language: "en-US",
  type: "Phrase",
  context: "A definition",
  additionalNote: "note",
  isGlobal: false,
  moduleIds: ["m1"],
  createDate: "",
  lastUpdateDate: "",
  version: 3,
  rule: "translate",
  caseSensitive: false,
  variants: ["Terms"],
  translations: [{ language: "de-DE", value: "Begriff", forbiddenValues: [] }],
  status: "draft",
  ...extra,
});

const renderBulk = () => {
  const { wrapper, queryClient } = createQueryWrapper();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  const { result } = renderHook(() => useGlossaryBulk(), { wrapper });
  return { result, invalidate };
};

describe("runWithConcurrency", () => {
  it("never runs more than the limit at once and settles every item", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const settled = vi.fn();
    const results = await runWithConcurrency(
      Array.from({ length: 10 }, (_, index) => index),
      4,
      async (item) => {
        inFlight++;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 1));
        inFlight--;
        if (item === 3) throw new Error("boom");
        return item * 2;
      },
      settled,
    );
    expect(maxInFlight).toBe(4);
    expect(settled).toHaveBeenCalledTimes(10);
    expect(results).toHaveLength(10);
    expect(results[3]).toEqual({ status: "rejected", reason: new Error("boom") });
    expect(results[9]).toEqual({ status: "fulfilled", value: 18 });
  });

  it("handles an empty list", async () => {
    await expect(runWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
  });
});

describe("useGlossaryBulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    svc.saveGlossary.mockResolvedValue({ success: true, errorMessage: "", validationErrors: [] });
    svc.deleteGlossary.mockResolvedValue({ isSuccess: true, errors: null });
    svc.tagGlossary.mockResolvedValue({ isSuccess: true, errors: null });
  });

  it("approves with each term's full payload, the new status and its version (H19)", async () => {
    const { result } = renderBulk();
    let outcome;
    await act(async () => {
      outcome = await result.current.run({ kind: "status", status: "approved" }, [term("a")]);
    });
    expect(svc.saveGlossary).toHaveBeenCalledWith({
      itemId: "a",
      name: "Term a",
      language: "en-US",
      type: "Phrase",
      context: "A definition",
      additionalNote: "note",
      isGlobal: false,
      moduleIds: ["m1"],
      rule: "translate",
      caseSensitive: false,
      variants: ["Terms"],
      translations: [{ language: "de-DE", value: "Begriff", forbiddenValues: [] }],
      status: "approved",
      version: 3,
    });
    expect(outcome).toEqual({ total: 1, succeeded: 1, failed: [] });
    expect(result.current.isRunning).toBe(false);
  });

  it("sets whole project by clearing the module links", async () => {
    const { result } = renderBulk();
    await act(async () => {
      await result.current.run({ kind: "set-project" }, [term("a")]);
    });
    expect(svc.saveGlossary).toHaveBeenCalledWith(
      expect.objectContaining({ isGlobal: true, moduleIds: [], status: "draft", version: 3 }),
    );
  });

  it("continues past a Version error and reports the failed name (C8)", async () => {
    svc.saveGlossary.mockImplementation(async (payload) =>
      payload.itemId === "b"
        ? {
            success: false,
            errorMessage: "",
            validationErrors: [
              { propertyName: "Version", errorMessage: "The term was changed." } as never,
            ],
          }
        : { success: true, errorMessage: "", validationErrors: [] },
    );
    const { result } = renderBulk();
    let outcome;
    await act(async () => {
      outcome = await result.current.run({ kind: "status", status: "deprecated" }, [
        term("a"),
        term("b"),
        term("c"),
      ]);
    });
    expect(svc.saveGlossary).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({
      total: 3,
      succeeded: 2,
      failed: [{ itemId: "b", name: "Term b", message: "The term was changed." }],
    });
  });

  it("reports a rejected delete and still deletes the others", async () => {
    svc.deleteGlossary.mockImplementation(async ({ itemId }) => {
      if (itemId === "a") throw new Error("Forbidden");
      return { isSuccess: true, errors: null };
    });
    const { result } = renderBulk();
    let outcome;
    await act(async () => {
      outcome = await result.current.run({ kind: "delete" }, [term("a"), term("b")]);
    });
    expect(svc.deleteGlossary).toHaveBeenCalledTimes(2);
    expect(outcome).toEqual({
      total: 2,
      succeeded: 1,
      failed: [{ itemId: "a", name: "Term a", message: "Forbidden" }],
    });
  });

  it("tags with one request holding the union of existing and selected ids (C7)", async () => {
    const { result } = renderBulk();
    await act(async () => {
      await result.current.run({ kind: "tag-module", moduleId: "m9", existingIds: ["x", "a"] }, [
        term("a"),
        term("b"),
      ]);
    });
    expect(svc.tagGlossary).toHaveBeenCalledTimes(1);
    expect(svc.tagGlossary).toHaveBeenCalledWith({
      moduleId: "m9",
      glossaryIds: ["x", "a", "b"],
      projectKey: "t1",
    });
    expect(svc.saveGlossary).not.toHaveBeenCalled();
  });

  it("reports every selected term when tagging fails", async () => {
    svc.tagGlossary.mockResolvedValue({ isSuccess: false, errors: "No permission" });
    const { result } = renderBulk();
    let outcome;
    await act(async () => {
      outcome = await result.current.run({ kind: "tag-module", moduleId: "m9", existingIds: [] }, [
        term("a"),
      ]);
    });
    expect(outcome).toEqual({
      total: 1,
      succeeded: 0,
      failed: [{ itemId: "a", name: "Term a", message: "No permission" }],
    });
  });

  it("invalidates the glossary caches and the key lists afterwards", async () => {
    const { result, invalidate } = renderBulk();
    await act(async () => {
      await result.current.run({ kind: "status", status: "approved" }, [term("a")]);
    });
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        localizationQueryKeys.glossaries.all,
        localizationQueryKeys.glossaries.globalPrefix,
        localizationQueryKeys.glossaries.modulePrefix,
        localizationQueryKeys.glossaries.searchPrefix,
        localizationQueryKeys.glossaries.detailPrefix,
        localizationQueryKeys.glossaries.suggestedPrefix,
        localizationQueryKeys.languageKeys.all,
      ]),
    );
  });

  it("does nothing for an empty selection", async () => {
    const { result } = renderBulk();
    let outcome;
    await act(async () => {
      outcome = await result.current.run({ kind: "delete" }, []);
    });
    expect(outcome).toBeUndefined();
    expect(svc.deleteGlossary).not.toHaveBeenCalled();
  });
});
