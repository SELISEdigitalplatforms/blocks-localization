import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGetTranslationSuggestion } from "@blocks-localization/hooks/use-language-manager";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { findGlossaryMatches } from "@blocks-localization/test-utils/helpers/glossary-matches";
import { GlossaryViolation } from "@blocks-localization/utils/glossary-validation";
import {
  GlossaryViolationList,
  recheckViolations,
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

const matches = findGlossaryMatches([G1, G2], "Open your SELISE Workspace");

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
    expect(screen.getByText("2 glossary issues")).toBeTruthy();
    expect(screen.getByText("You can still save.")).toBeTruthy();
    expect(screen.getByText(/use “Arbeitsbereich”/)).toBeTruthy();

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

  it("marks a Draft term's live warning (A2)", () => {
    const draftMatches = findGlossaryMatches(
      [{ ...G1, status: "draft" }, G2],
      "Open your SELISE Workspace",
    );
    render(
      <GlossaryViolationList
        violations={[forbidden]}
        matches={draftMatches}
        targetCulture="de-DE"
        onFix={vi.fn()}
      />,
    );
    expect(screen.getByText('Draft term: "Werkbereich" is not allowed')).toBeTruthy();
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
    sourceText: "Open your Workspace",
    defaultLanguage: { languageName: "English", languageCode: "en-US" },
    targetLanguage: { languageName: "German", languageCode: "de-DE" },
  };

  const serverReply = {
    content: "Öffnen Sie Ihren Werkbereich",
    appliedTerms: [
      { glossaryId: "g1", term: "Workspace", rule: "translate", expected: "Arbeitsbereich" },
    ],
    glossaryViolations: [
      {
        glossaryId: "g1",
        term: "Workspace",
        kind: "missing-translation",
        expected: "Arbeitsbereich",
      },
      { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
    ],
  };

  it("keeps the server's violations per row, clears them on edit and re-checks after Fix", async () => {
    suggestAsync.mockResolvedValue(serverReply);
    const { result } = renderHook(() => useGlossarySuggestionRows());
    await act(async () => {
      await result.current.request(input);
    });
    expect(suggestAsync).toHaveBeenCalledTimes(1);
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

  it("shows no violations when the server returns empty arrays (C1)", async () => {
    suggestAsync.mockResolvedValue({ content: "Öffnen", appliedTerms: [], glossaryViolations: [] });
    const { result } = renderHook(() => useGlossarySuggestionRows());
    await act(async () => {
      await result.current.request(input);
    });
    expect(result.current.getRow("de-DE")).toMatchObject({
      violations: [],
      matches: [],
      fromSuggestion: true,
    });
  });
});

describe("recheckViolations", () => {
  const missing: GlossaryViolation = {
    glossaryId: "g1",
    term: "Workspace",
    kind: "missing-translation",
    expected: "Arbeitsbereich",
  };

  it("drops violations the text no longer has and keeps the rest", () => {
    expect(recheckViolations("Ihr Arbeitsbereich", [missing, forbidden], "de-DE")).toEqual([]);
    expect(recheckViolations("Ihr Werkbereich", [missing, forbidden], "de-DE")).toEqual([
      missing,
      forbidden,
    ]);
    expect(recheckViolations("Mein SELISE", [missingKeep], "de-DE")).toEqual([]);
    expect(recheckViolations("Mein selise", [missingKeep], "de-DE")).toEqual([missingKeep]);
  });
});
