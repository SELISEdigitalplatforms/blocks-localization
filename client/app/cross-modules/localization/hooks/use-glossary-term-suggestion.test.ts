import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { showErrorToast } from "@/hooks/use-toast";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import {
  buildTermSuggestionPayload,
  sanitizeDefinitionForPrompt,
  useGlossaryTermSuggestion,
} from "./use-glossary-term-suggestion";

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { getTranslationSuggestion: vi.fn() },
}));

const svc = vi.mocked(languageManagerService);

const en = { itemId: "1", languageName: "English", languageCode: "en-US", isDefault: true };
const de = { itemId: "2", languageName: "German", languageCode: "de-DE" };
const fr = { itemId: "3", languageName: "French", languageCode: "fr-FR" };
const args = { name: "Workspace", definition: "Area", defaultLanguage: en };

const ok = (content: string) => ({ content, isSuccess: true, errors: null });

describe("sanitizeDefinitionForPrompt", () => {
  it("removes quotes, backticks, line breaks and brackets, and collapses spaces", () => {
    expect(sanitizeDefinitionForPrompt(" A \"shared\" `area`\n\nfor ⟦rule⟧ 'teams' ")).toBe(
      "A shared area for rule teams",
    );
  });

  it("caps the text at 300 characters", () => {
    expect(sanitizeDefinitionForPrompt("a".repeat(400))).toHaveLength(300);
  });

  it("returns an empty string for no definition", () => {
    expect(sanitizeDefinitionForPrompt(undefined)).toBe("");
  });
});

describe("buildTermSuggestionPayload", () => {
  it("sends the term with its meaning and no glossary ids or module (A2)", () => {
    expect(
      buildTermSuggestionPayload({
        name: "  Workspace ",
        definition: "Shared\narea",
        target: de,
        defaultLanguage: en,
      }),
    ).toEqual({
      sourceText: "Workspace",
      destinationLanguage: "German",
      currentLanguage: "English",
      temperature: 0.1,
      elementDetailContext:
        "Translate this glossary term for a software user interface. Output only the term in the target language. Meaning: Shared area\n",
      destinationLanguageCode: "de-DE",
    });
  });

  it("leaves out the meaning when there is no definition", () => {
    expect(
      buildTermSuggestionPayload({ name: "Workspace", target: de, defaultLanguage: en })
        .elementDetailContext,
    ).toBe(
      "Translate this glossary term for a software user interface. Output only the term in the target language.\n",
    );
  });
});

describe("useGlossaryTermSuggestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the trimmed suggestion", async () => {
    svc.getTranslationSuggestion.mockResolvedValue(ok(" Arbeitsbereich ") as never);
    const { result } = renderHook(() => useGlossaryTermSuggestion());
    let value;
    await act(async () => {
      value = await result.current.suggest(args, de);
    });
    expect(value).toBe("Arbeitsbereich");
    expect(result.current.isSuggesting).toBe(false);
  });

  it("shows the error toast and returns nothing on an empty result (C4)", async () => {
    svc.getTranslationSuggestion.mockResolvedValue(ok("  ") as never);
    const { result } = renderHook(() => useGlossaryTermSuggestion());
    let value;
    await act(async () => {
      value = await result.current.suggest(args, de);
    });
    expect(value).toBeUndefined();
    expect(showErrorToast).toHaveBeenCalledWith({ errors: "No suggestion for German." });
  });

  it("shows the error toast and returns nothing when the request fails (C4)", async () => {
    svc.getTranslationSuggestion.mockRejectedValue(new Error("Network down"));
    const { result } = renderHook(() => useGlossaryTermSuggestion());
    let value;
    await act(async () => {
      value = await result.current.suggest(args, de);
    });
    expect(value).toBeUndefined();
    expect(showErrorToast).toHaveBeenCalledWith({ errors: "Network down" });
  });

  it("runs Suggest all one request at a time and reports each value", async () => {
    svc.getTranslationSuggestion.mockImplementation(
      async (payload) =>
        ok(payload.destinationLanguageCode === "de-DE" ? "Arbeitsbereich" : "Espace") as never,
    );
    const onResult = vi.fn();
    const { result } = renderHook(() => useGlossaryTermSuggestion());
    await act(async () => {
      await result.current.suggestAll(args, [de, fr], onResult);
    });
    expect(onResult.mock.calls).toEqual([
      ["de-DE", "Arbeitsbereich"],
      ["fr-FR", "Espace"],
    ]);
  });

  it("sends no further requests and ignores the pending result after cancel (C4)", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    svc.getTranslationSuggestion.mockImplementation(
      () => new Promise((resolve) => (resolveFirst = resolve)) as never,
    );
    const onResult = vi.fn();
    const { result } = renderHook(() => useGlossaryTermSuggestion());
    let run: Promise<void> = Promise.resolve();
    act(() => {
      run = result.current.suggestAll(args, [de, fr], onResult);
    });
    expect(result.current.pendingCodes.has("de-DE")).toBe(true);
    act(() => result.current.cancel());
    await act(async () => {
      resolveFirst(ok("Arbeitsbereich"));
      await run;
    });
    expect(svc.getTranslationSuggestion).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
    expect(showErrorToast).not.toHaveBeenCalled();
    expect(result.current.isSuggesting).toBe(false);
  });

  it("cancels on unmount", async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    svc.getTranslationSuggestion.mockImplementation(
      () => new Promise((resolve) => (resolveFirst = resolve)) as never,
    );
    const onResult = vi.fn();
    const { result, unmount } = renderHook(() => useGlossaryTermSuggestion());
    let run: Promise<void> = Promise.resolve();
    act(() => {
      run = result.current.suggestAll(args, [de, fr], onResult);
    });
    unmount();
    resolveFirst(ok("Arbeitsbereich"));
    await run;
    expect(svc.getTranslationSuggestion).toHaveBeenCalledTimes(1);
    expect(onResult).not.toHaveBeenCalled();
  });
});
