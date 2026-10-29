import { act, renderHook, waitFor } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetTranslationSuggestion } from "@blocks-localization/hooks/use-language-manager";
import { ITranslationSuggestionResponse } from "@blocks-localization/models/language";
import { applyFix, canApplyFix } from "@blocks-localization/utils/glossary-validation";
import {
  appliedTermToMatch,
  buildSuggestionPayload,
  GlossarySuggestionInput,
  runGlossaryAwareSuggestion,
  useGlossaryAwareSuggestion,
} from "./use-glossary-aware-suggestion";

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetTranslationSuggestion: vi.fn(),
}));

const input = (overrides: Partial<GlossarySuggestionInput> = {}): GlossarySuggestionInput => ({
  requestKey: "de-DE",
  sourceText: "Open your Workspace",
  defaultLanguage: { languageName: "English", languageCode: "en-US" },
  targetLanguage: { languageName: "German", languageCode: "de-DE" },
  keyContext: "Button label",
  keyGlossaryIds: ["g9"],
  moduleId: "M",
  ...overrides,
});

const reply = (
  content: string | null,
  extra: Partial<ITranslationSuggestionResponse> = {},
): ITranslationSuggestionResponse =>
  ({ content, errors: null, isSuccess: true, ...extra }) as ITranslationSuggestionResponse;

describe("buildSuggestionPayload", () => {
  it("sends the key's own context, tags, module and both language codes (H4)", () => {
    expect(buildSuggestionPayload(input())).toEqual({
      sourceText: "Open your Workspace",
      destinationLanguage: "German",
      currentLanguage: "English",
      currentLanguageCode: "en-US",
      temperature: 0.1,
      elementDetailContext: "Button label",
      glossaryIds: ["g9"],
      moduleId: "M",
      destinationLanguageCode: "de-DE",
    });
  });

  it("leaves out an empty key context and sends [] without tags", () => {
    const payload = buildSuggestionPayload(input({ keyContext: "", keyGlossaryIds: undefined }));
    expect(payload.elementDetailContext).toBeUndefined();
    expect(payload.glossaryIds).toEqual([]);
  });

  it("never sends a client terminology prompt", () => {
    const payload = buildSuggestionPayload(input({ keyContext: undefined }));
    expect(JSON.stringify(payload)).not.toContain("TERMINOLOGY RULES");
    expect(payload).not.toHaveProperty("clientGlossaryRules");
  });

  it("uses the given default language, not English, as the source", () => {
    const payload = buildSuggestionPayload(
      input({ defaultLanguage: { languageName: "German", languageCode: "de-DE" } }),
    );
    expect(payload).toMatchObject({ currentLanguage: "German", currentLanguageCode: "de-DE" });
  });
});

describe("runGlossaryAwareSuggestion", () => {
  const requestSuggestion = vi.fn();
  const run = (overrides: Partial<GlossarySuggestionInput> = {}) =>
    runGlossaryAwareSuggestion(input(overrides), { requestSuggestion });

  beforeEach(() => {
    requestSuggestion.mockReset();
  });

  it("makes exactly one request and returns the server's violations and applied terms (H4, H5, C14)", async () => {
    requestSuggestion.mockResolvedValueOnce(
      reply("Öffnen Sie Ihren Werkbereich", {
        appliedTerms: [
          { glossaryId: "g1", term: "Workspace", rule: "translate", expected: "Arbeitsbereich" },
        ],
        glossaryViolations: [
          { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
        ],
      }),
    );

    const outcome = await run();

    expect(requestSuggestion).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({
      status: "success",
      content: "Öffnen Sie Ihren Werkbereich",
      violations: [
        { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
      ],
      appliedTerms: [{ glossaryId: "g1", expected: "Arbeitsbereich" }],
    });
  });

  it("returns empty violations when the server's enforcement is off (C1)", async () => {
    requestSuggestion.mockResolvedValueOnce(
      reply("Öffnen Sie Ihren Werkbereich", { appliedTerms: [], glossaryViolations: [] }),
    );
    expect(await run()).toMatchObject({ status: "success", violations: [], matches: [] });

    requestSuggestion.mockResolvedValueOnce(reply("Hallo"));
    expect(await run()).toMatchObject({ status: "success", violations: [], appliedTerms: [] });
  });

  it("reports an empty answer and a failed call without a second request", async () => {
    requestSuggestion.mockResolvedValueOnce({ content: null, errors: { x: 1 }, isSuccess: false });
    expect(await run()).toEqual({ status: "empty", errors: { x: 1 } });
    const error = new Error("boom");
    requestSuggestion.mockRejectedValueOnce(error);
    expect(await run()).toEqual({ status: "error", error });
    expect(requestSuggestion).toHaveBeenCalledTimes(2);
  });

  it("returns stale when aborted", async () => {
    const controller = new AbortController();
    requestSuggestion.mockImplementation(async () => {
      controller.abort();
      return reply("Öffnen Sie Ihren Werkbereich");
    });
    expect(await run({ signal: controller.signal })).toEqual({ status: "stale" });
    expect(requestSuggestion).toHaveBeenCalledTimes(1);
  });
});

describe("appliedTermToMatch (Fix is rule-aware, C20)", () => {
  const forbiddenUsed = {
    glossaryId: "g1",
    term: "Workspace",
    kind: "forbidden-used" as const,
    found: "Werkbereich",
  };

  it("offers Fix with the Translate term's expected value", () => {
    const matches = [
      appliedTermToMatch(
        { glossaryId: "g1", term: "Workspace", rule: "translate", expected: "Arbeitsbereich" },
        "de-DE",
      ),
    ];
    expect(canApplyFix(forbiddenUsed, matches, "de-DE")).toBe(true);
    expect(applyFix("Öffnen Sie Ihren Werkbereich", forbiddenUsed, matches, "de-DE")).toBe(
      "Öffnen Sie Ihren Arbeitsbereich",
    );
  });

  it("offers no Fix without an expected value or under Keep / Forbidden", () => {
    for (const term of [
      { glossaryId: "g1", term: "Workspace", rule: "translate" as const },
      { glossaryId: "g1", term: "Workspace", rule: "keep" as const, expected: "Arbeitsbereich" },
      { glossaryId: "g1", term: "Workspace", rule: "forbidden" as const, expected: "X" },
    ]) {
      expect(canApplyFix(forbiddenUsed, [appliedTermToMatch(term, "de-DE")], "de-DE")).toBe(false);
    }
  });
});

/** H13: the full glossary load (`Glossary/Gets?PageSize=500`) is gone from every code path. */
describe("no full glossary load (H13)", () => {
  const sourceRoot = join(process.cwd(), "app");
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
      return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name) ? [path] : [];
    });

  it("has no source that requests PageSize=500 or pages the whole glossary", () => {
    const files = sourceFiles(sourceRoot);
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((path) =>
      /PageSize=500|pageSize:\s*500|ALL_GLOSSARIES_PAGE_SIZE|fetchAllGlossaries/.test(
        readFileSync(path, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});

describe("useGlossaryAwareSuggestion", () => {
  const mutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetTranslationSuggestion).mockReturnValue({ mutateAsync } as never);
  });

  const deferred = <T>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  it("uses the existing suggestion mutation and tracks pending state per key", async () => {
    const de = deferred<unknown>();
    mutateAsync.mockReturnValueOnce(de.promise);
    const { result } = renderHook(() => useGlossaryAwareSuggestion());
    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.suggest(input());
    });
    await waitFor(() => expect(result.current.isPending("de-DE")).toBe(true));
    expect(result.current.isPending("fr-FR")).toBe(false);
    await act(async () => {
      de.resolve(reply("Öffnen Sie Ihren Arbeitsbereich"));
      await pending;
    });
    expect(result.current.isPending("de-DE")).toBe(false);
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    await expect(pending).resolves.toMatchObject({ status: "success" });
  });

  it("ignores a response superseded by a newer request for the same key (C22)", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    mutateAsync.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useGlossaryAwareSuggestion());
    let older!: Promise<unknown>;
    let newer!: Promise<unknown>;
    await act(async () => {
      older = result.current.suggest(input());
    });
    await act(async () => {
      newer = result.current.suggest(input());
    });
    await act(async () => {
      second.resolve(reply("neu"));
      first.resolve(reply("alt"));
      await Promise.all([older, newer]);
    });
    await expect(older).resolves.toEqual({ status: "stale" });
    await expect(newer).resolves.toMatchObject({ status: "success", content: "neu" });
    expect(result.current.isPending("de-DE")).toBe(false);
  });

  it("keeps rows independent and ignores a cancelled row (C22)", async () => {
    const de = deferred<unknown>();
    const fr = deferred<unknown>();
    mutateAsync.mockReturnValueOnce(de.promise).mockReturnValueOnce(fr.promise);
    const { result } = renderHook(() => useGlossaryAwareSuggestion());
    let dePromise!: Promise<unknown>;
    let frPromise!: Promise<unknown>;
    await act(async () => {
      dePromise = result.current.suggest(input());
      frPromise = result.current.suggest(
        input({
          requestKey: "fr-FR",
          targetLanguage: { languageName: "French", languageCode: "fr-FR" },
        }),
      );
    });
    act(() => result.current.cancel("de-DE"));
    expect(result.current.isPending("de-DE")).toBe(false);
    expect(result.current.isPending("fr-FR")).toBe(true);
    await act(async () => {
      de.resolve(reply("Hallo"));
      fr.resolve(reply("Bonjour"));
      await Promise.all([dePromise, frPromise]);
    });
    await expect(dePromise).resolves.toEqual({ status: "stale" });
    await expect(frPromise).resolves.toMatchObject({ status: "success", content: "Bonjour" });
  });

  it("ignores responses that arrive after unmount (modal closed, C22)", async () => {
    const pendingReply = deferred<unknown>();
    mutateAsync.mockReturnValueOnce(pendingReply.promise);
    const { result, unmount } = renderHook(() => useGlossaryAwareSuggestion());
    let promise!: Promise<unknown>;
    act(() => {
      promise = result.current.suggest(input());
    });
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));
    unmount();
    pendingReply.resolve(reply("Öffnen Sie Ihren Werkbereich"));
    await expect(promise).resolves.toEqual({ status: "stale" });
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("cancel() without a key drops every in-flight row", async () => {
    const de = deferred<unknown>();
    mutateAsync.mockReturnValueOnce(de.promise);
    const { result } = renderHook(() => useGlossaryAwareSuggestion());
    let promise!: Promise<unknown>;
    await act(async () => {
      promise = result.current.suggest(input());
    });
    act(() => result.current.cancel());
    expect(result.current.pendingKeys.size).toBe(0);
    await act(async () => {
      de.resolve(reply("Hallo"));
      await promise;
    });
    await expect(promise).resolves.toEqual({ status: "stale" });
  });
});
