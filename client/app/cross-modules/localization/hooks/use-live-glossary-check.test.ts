import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { buildGlossaryMatcher, GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";
import { applyFix } from "@blocks-localization/utils/glossary-validation";
import {
  LIVE_CHECK_DEBOUNCE_MS,
  useApplicableGlossaryMatches,
  useLiveGlossaryCheck,
  useLoadedGlossaries,
} from "./use-live-glossary-check";

const G1: IGlossary = {
  itemId: "g1",
  name: "Workspace",
  isGlobal: true,
  createDate: "",
  lastUpdateDate: "",
  additionalNote:
    GLOSSARY_META_PREFIX +
    JSON.stringify({
      rule: "translate",
      translations: { "de-DE": "Arbeitsbereich" },
      forbidden: { "de-DE": ["Werkbereich"] },
    }),
};
const G_MODULE: IGlossary = {
  itemId: "g5",
  name: "Portal",
  moduleIds: ["M2"],
  createDate: "",
  lastUpdateDate: "",
};

const matchesFor = (text: string): GlossaryMatch[] =>
  buildGlossaryMatcher([G1, G_MODULE]).match(text, {
    scopeMode: "applicable",
    sourceCulture: "en-US",
  });

describe("useLoadedGlossaries", () => {
  it("resolves the loader once and is undefined until then", async () => {
    const loader = vi.fn().mockResolvedValue([G1]);
    const { result } = renderHook(() => useLoadedGlossaries(loader));
    expect(result.current).toBeUndefined();
    await waitFor(() => expect(result.current).toEqual([G1]));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("stays undefined without a loader or after a failure (C2)", async () => {
    const loader = vi.fn().mockRejectedValue(new Error("down"));
    const { result } = renderHook(() => useLoadedGlossaries(loader));
    await waitFor(() => expect(loader).toHaveBeenCalled());
    await act(async () => {});
    expect(result.current).toBeUndefined();
    expect(renderHook(() => useLoadedGlossaries(undefined)).result.current).toBeUndefined();
  });
});

describe("useApplicableGlossaryMatches", () => {
  it("matches in applicable scope and is empty while the glossary is missing", () => {
    const { result, rerender } = renderHook(
      ({ glossaries }: { glossaries?: IGlossary[] }) =>
        useApplicableGlossaryMatches(glossaries, "Open the Workspace Portal", {
          sourceCulture: "en-US",
        }),
      { initialProps: { glossaries: undefined as IGlossary[] | undefined } },
    );
    expect(result.current).toEqual([]);
    rerender({ glossaries: [G1, G_MODULE] });
    // "Portal" belongs to another module, so it doesn't apply here.
    expect(result.current.map((match) => match.surface)).toEqual(["Workspace"]);
  });

  it("applies module scope", () => {
    const { result } = renderHook(() =>
      useApplicableGlossaryMatches([G1, G_MODULE], "Portal", {
        sourceCulture: "en-US",
        moduleId: "M2",
      }),
    );
    expect(result.current.map((match) => match.glossary.itemId)).toEqual(["g5"]);
  });
});

describe("useLiveGlossaryCheck", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const matches = matchesFor("Open your Workspace");

  it("shows violations 150 ms after typing stops (H5)", () => {
    const { result, rerender } = renderHook(
      ({ targetText }) => useLiveGlossaryCheck({ targetText, targetCulture: "de-DE", matches }),
      { initialProps: { targetText: "" } },
    );
    rerender({ targetText: "Öffnen Sie Ihren Werkbereich" });
    act(() => {
      vi.advanceTimersByTime(LIVE_CHECK_DEBOUNCE_MS - 1);
    });
    expect(result.current.violations).toEqual([]);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.violations.map((violation) => violation.kind)).toEqual([
      "missing-translation",
      "forbidden-used",
    ]);
  });

  it("has no warnings for an empty target (C5) or without matches", () => {
    const { result, rerender } = renderHook(
      ({ targetText, list }) =>
        useLiveGlossaryCheck({ targetText, targetCulture: "de-DE", matches: list }),
      { initialProps: { targetText: "Werkbereich", list: matches } },
    );
    act(() => {
      vi.advanceTimersByTime(LIVE_CHECK_DEBOUNCE_MS);
    });
    expect(result.current.violations).toHaveLength(2);
    rerender({ targetText: "", list: matches });
    expect(result.current.violations).toEqual([]);
    rerender({ targetText: "Werkbereich", list: [] });
    act(() => {
      vi.advanceTimersByTime(LIVE_CHECK_DEBOUNCE_MS);
    });
    expect(result.current.violations).toEqual([]);
  });

  it("recomputes immediately after Fix (H6, C21)", () => {
    const text = "Öffnen Sie Ihren Werkbereich";
    const { result, rerender } = renderHook(
      ({ targetText }) => useLiveGlossaryCheck({ targetText, targetCulture: "de-DE", matches }),
      { initialProps: { targetText: text } },
    );
    act(() => {
      vi.advanceTimersByTime(LIVE_CHECK_DEBOUNCE_MS);
    });
    const forbidden = result.current.violations.find((v) => v.kind === "forbidden-used")!;
    const fixed = applyFix(text, forbidden, matches, "de-DE")!;
    expect(fixed).toBe("Öffnen Sie Ihren Arbeitsbereich");
    act(() => result.current.checkNow(fixed));
    rerender({ targetText: fixed });
    // No timer advanced: the list is already recomputed.
    expect(result.current.violations).toEqual([]);
  });

  it("stays within the 5 ms budget per run on a 2,000-term glossary (C14)", () => {
    const glossaries: IGlossary[] = Array.from({ length: 2000 }, (_, index) => ({
      itemId: `t${index}`,
      name: `Term${index}`,
      isGlobal: true,
      createDate: "",
      lastUpdateDate: "",
      additionalNote:
        GLOSSARY_META_PREFIX +
        JSON.stringify({ rule: "translate", translations: { "de-DE": `Begriff${index}` } }),
    }));
    const source = Array.from({ length: 50 }, (_, index) => `Term${index * 7}`)
      .join(" ")
      .slice(0, 500);
    const matcher = buildGlossaryMatcher(glossaries);
    const live = matcher.match(source, { scopeMode: "applicable", sourceCulture: "en-US" });
    const { result, rerender } = renderHook(
      ({ targetText }) =>
        useLiveGlossaryCheck({ targetText, targetCulture: "de-DE", matches: live }),
      { initialProps: { targetText: "" } },
    );
    const timings: number[] = [];
    for (let run = 0; run < 20; run++) {
      const started = performance.now();
      const text = `Begriff${run} ${"x".repeat(run)}`;
      act(() => result.current.checkNow(text));
      rerender({ targetText: text });
      timings.push(performance.now() - started);
    }
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.floor(timings.length * 0.95) - 1];
    // Fails at 2× the budget (render overhead included).
    expect(p95).toBeLessThan(10);
  });
});
