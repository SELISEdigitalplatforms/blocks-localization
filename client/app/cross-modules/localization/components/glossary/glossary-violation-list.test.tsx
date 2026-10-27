import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetTranslationSuggestion } from "@blocks-localization/hooks/use-language-manager";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { buildGlossaryMatcher } from "@blocks-localization/utils/glossary-matcher";
import { GlossaryViolation } from "@blocks-localization/utils/glossary-validation";
import {
  GlossaryUnavailableNote,
  GlossaryViolationList,
  useGlossarySuggestionRows,
} from "./glossary-violation-list";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetTranslationSuggestion: vi.fn(),
}));

const suggestAsync = vi.fn();

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
const G2: IGlossary = {
  itemId: "g2",
  name: "SELISE",
  isGlobal: true,
  createDate: "",
  lastUpdateDate: "",
  additionalNote: GLOSSARY_META_PREFIX + JSON.stringify({ rule: "keep" }),
};

const matches = buildGlossaryMatcher([G1, G2]).match("Open your SELISE Workspace", {
  scopeMode: "applicable",
  sourceCulture: "en-US",
});

const forbidden: GlossaryViolation = {
  glossaryId: "g1",
  term: "Workspace",
  kind: "forbidden-used",
  found: "Werkbereich",
};
const missingKeep: GlossaryViolation = {
  glossaryId: "g2",
  term: "SELISE",
  kind: "missing-keep",
  expected: "SELISE",
};

describe("GlossaryViolationList", () => {
  const list = (violations: GlossaryViolation[]) => (
    <GlossaryViolationList
      violations={violations}
      matches={matches}
      targetCulture="de-DE"
      onFix={vi.fn()}
      onRetry={vi.fn()}
    />
  );

  it("keeps an empty polite live region mounted without violations", () => {
    render(list([]));
    const region = screen.getByRole("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");
    expect(region.className).toBe("sr-only");
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("fills the same live region when violations arrive, so they are announced", () => {
    const { rerender } = render(list([]));
    const region = screen.getByRole("status");
    rerender(list([forbidden]));
    expect(screen.getByRole("status")).toBe(region);
    expect(region.querySelector("ul")).not.toBeNull();
    expect(region.className).toContain("mt-2 block");
    rerender(list([]));
    expect(screen.getByRole("status")).toBe(region);
    expect(region.textContent).toBe("");
  });

  it("announces each violation politely with Fix or Retry", () => {
    const onFix = vi.fn();
    const onRetry = vi.fn();
    render(
      <GlossaryViolationList
        violations={[forbidden, missingKeep]}
        matches={matches}
        targetCulture="de-DE"
        onFix={onFix}
        onRetry={onRetry}
      />,
    );
    const list = screen.getByRole("status");
    expect(list.getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText('"Werkbereich" is not allowed').className).toContain("text-sm");
    expect(screen.getByText('Keep "SELISE" unchanged')).toBeTruthy();
    expect(list.querySelectorAll("svg.text-warning-700")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    expect(onFix).toHaveBeenCalledWith(forbidden);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("disables Fix and Retry while the row's suggestion runs", () => {
    render(
      <GlossaryViolationList
        violations={[forbidden, missingKeep]}
        matches={matches}
        targetCulture="de-DE"
        disabled
        onFix={vi.fn()}
        onRetry={vi.fn()}
      />,
    );
    expect((screen.getByRole("button", { name: "Fix" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Retry" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("shows the C6 info text", () => {
    render(<GlossaryUnavailableNote />);
    expect(
      screen.getByText("Glossary unavailable; suggestion made without terminology rules."),
    ).toBeTruthy();
  });
});

describe("useGlossarySuggestionRows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetTranslationSuggestion).mockReturnValue({
      mutateAsync: suggestAsync,
    } as never);
  });

  const input = {
    requestKey: "de-DE",
    legacyPayload: {
      sourceText: "Open your Workspace",
      destinationLanguage: "German",
      currentLanguage: "English",
      temperature: 0.1,
    },
    sourceText: "Open your Workspace",
    defaultLanguage: { languageName: "English", languageCode: "en-US" },
    targetLanguage: { languageName: "German", languageCode: "de-DE" },
  };

  it("keeps violations per row, clears them on edit and re-validates after Fix", async () => {
    suggestAsync.mockResolvedValue({ content: "Öffnen Sie Ihren Werkbereich" });
    const { result } = renderHook(() =>
      useGlossarySuggestionRows({ loadGlossaries: async () => [G1] }),
    );
    await act(async () => {
      await result.current.request(input);
    });
    expect(result.current.getRow("de-DE").violations.map((v) => v.kind)).toEqual([
      "missing-translation",
      "forbidden-used",
    ]);
    expect(result.current.getRow("fr-FR").violations).toEqual([]);

    const violation = result.current.getRow("de-DE").violations[1];
    let fixed: string | null = null;
    act(() => {
      fixed = result.current.fix("de-DE", violation, "Öffnen Sie Ihren Werkbereich");
    });
    expect(fixed).toBe("Öffnen Sie Ihren Arbeitsbereich");
    expect(result.current.getRow("de-DE").violations).toEqual([]);

    await act(async () => {
      await result.current.request(input);
    });
    expect(result.current.getRow("de-DE").violations).toHaveLength(2);
    act(() => result.current.clearViolations("de-DE"));
    expect(result.current.getRow("de-DE").violations).toEqual([]);
  });

  it("records a glossary load failure for the row (C6)", async () => {
    suggestAsync.mockResolvedValue({ content: "Öffnen" });
    const { result } = renderHook(() =>
      useGlossarySuggestionRows({ loadGlossaries: () => Promise.reject(new Error("down")) }),
    );
    await act(async () => {
      await result.current.request(input);
    });
    expect(result.current.getRow("de-DE").glossaryUnavailable).toBe(true);
    expect(suggestAsync).toHaveBeenCalledWith(input.legacyPayload);
  });
});
