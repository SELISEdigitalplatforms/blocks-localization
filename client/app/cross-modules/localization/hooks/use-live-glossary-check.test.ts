import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { MATCH_DEBOUNCE_MS } from "@blocks-localization/hooks/use-glossary-match";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary, IGlossaryMatchDto } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { findGlossaryMatches } from "@blocks-localization/test-utils/helpers/glossary-matches";
import { applyFix } from "@blocks-localization/utils/glossary-validation";
import {
  isDraftViolation,
  LIVE_CHECK_DEBOUNCE_MS,
  useLiveGlossaryCheck,
  useSourceGlossaryMatches,
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

const matchesFor = (text: string, glossaries: IGlossary[] = [G1]): GlossaryMatch[] =>
  findGlossaryMatches(glossaries, text);

const project = vi.hoisted(() => ({ tenantId: "tenant-1" }));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: project.tenantId } }),
}));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { matchGlossary: vi.fn() },
}));

const matchGlossary = vi.mocked(languageManagerService.matchGlossary);

const dto = (overrides: Partial<IGlossaryMatchDto> = {}): IGlossaryMatchDto => ({
  glossaryId: "g1",
  start: 10,
  length: 9,
  surface: "Workspace",
  term: "Workspace",
  rule: "translate",
  status: "approved",
  caseSensitive: false,
  scope: "global",
  definition: "",
  translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] }],
  ...overrides,
});

describe("useSourceGlossaryMatches", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    matchGlossary.mockReset();
    matchGlossary.mockResolvedValue({ matches: [dto()] });
  });
  afterEach(() => vi.useRealTimers());

  it("matches a static source at once", async () => {
    const { result } = renderHook(
      () => useSourceGlossaryMatches({ text: "Open your Workspace", sourceCulture: "en-US" }),
      { wrapper: createQueryWrapper().wrapper },
    );
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(result.current.isCurrent).toBe(true);
    expect(matchGlossary).toHaveBeenCalledTimes(1);
  });

  it("sends /Match only 300 ms after an editable source stops changing (C18)", async () => {
    const { result, rerender } = renderHook(
      ({ text }) => useSourceGlossaryMatches({ text, sourceCulture: "en-US", debounce: true }),
      { wrapper: createQueryWrapper().wrapper, initialProps: { text: "" } },
    );
    for (const text of ["O", "Op", "Open", "Open your", "Open your Workspace"]) {
      rerender({ text });
      act(() => {
        vi.advanceTimersByTime(MATCH_DEBOUNCE_MS - 50);
      });
    }
    expect(matchGlossary).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(50);
    });
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(matchGlossary).toHaveBeenCalledTimes(1);
    expect(matchGlossary.mock.calls[0][0]).toMatchObject({ text: "Open your Workspace" });
    expect(result.current.isCurrent).toBe(true);

    // Typing again: the previous matches stay but no longer belong to the text.
    rerender({ text: "Open your Workspace now" });
    expect(result.current.isCurrent).toBe(false);
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

  it("checks Draft terms too and marks their violations as Draft (A2)", () => {
    const draftMatches = matchesFor("Open your Workspace", [{ ...G1, status: "draft" }]);
    const { result } = renderHook(() =>
      useLiveGlossaryCheck({
        targetText: "Öffnen Sie Ihren Werkbereich",
        targetCulture: "de-DE",
        matches: draftMatches,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(LIVE_CHECK_DEBOUNCE_MS);
    });
    expect(result.current.violations).toHaveLength(2);
    expect(result.current.violations.every((v) => isDraftViolation(v, draftMatches))).toBe(true);
    expect(isDraftViolation(result.current.violations[0], matches)).toBe(false);
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
    const live = findGlossaryMatches(glossaries, source);
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
