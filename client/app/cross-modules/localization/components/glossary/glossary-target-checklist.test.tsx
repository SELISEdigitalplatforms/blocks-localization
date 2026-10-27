import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GlossaryRowState } from "@blocks-localization/components/glossary/glossary-violation-list";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { buildGlossaryMatcher } from "@blocks-localization/utils/glossary-matcher";
import { GlossaryTargetChecklist } from "./glossary-target-checklist";

vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (sub: string) => `/app/p1/${sub}`,
}));

const term = (itemId: string, name: string, meta: object): IGlossary => ({
  itemId,
  name,
  isGlobal: true,
  createDate: "",
  lastUpdateDate: "",
  additionalNote: GLOSSARY_META_PREFIX + JSON.stringify(meta),
});

const G1 = term("g1", "Workspace", {
  rule: "translate",
  translations: { "de-DE": "Arbeitsbereich" },
  forbidden: { "de-DE": ["Werkbereich"] },
});
const G2 = term("g2", "SELISE", { rule: "keep" });
const G3 = term("g3", "Portal", { rule: "forbidden" });

const MATCHES = buildGlossaryMatcher([G1, G2, G3]).match("Open your Workspace and SELISE portal", {
  scopeMode: "applicable",
  sourceCulture: "en-US",
});

const IDLE_ROW: GlossaryRowState = {
  violations: [],
  matches: [],
  targetCulture: "",
  glossaryUnavailable: false,
  fromSuggestion: false,
};

const renderChecklist = (targetText: string, targetCulture = "de-DE", onLiveFix = vi.fn()) =>
  render(
    <GlossaryTargetChecklist
      row={IDLE_ROW}
      targetText={targetText}
      targetCulture={targetCulture}
      languageName="German"
      liveMatches={MATCHES}
      onSuggestionFix={vi.fn()}
      onRetry={vi.fn()}
      onLiveFix={onLiveFix}
    />,
  );

describe("GlossaryTargetChecklist", () => {
  it("lists what to write for every term before the row has text", () => {
    renderChecklist("");
    const region = screen.getByRole("region", { name: "Glossary terms for German" });
    expect(within(region).getByText("Use these terms in this translation")).toBeTruthy();
    expect(within(region).getByText("Arbeitsbereich")).toBeTruthy();
    expect(within(region).getByText("· Keep as written")).toBeTruthy();
    expect(within(region).getByText("· Do not use")).toBeTruthy();
    expect(screen.getByRole("button", { name: 'Copy "Arbeitsbereich"' })).toBeTruthy();
    // An empty target has no warnings (C5).
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("marks every term followed when the translation uses them", () => {
    renderChecklist("Öffnen Sie Ihren Arbeitsbereich und das SELISE-Konto");
    expect(screen.getByRole("status").textContent).toBe("All glossary terms followed");
    expect(screen.getAllByText("Followed:")).toHaveLength(3);
  });

  it("reports issues per term and Fix replaces the forbidden word (H6)", async () => {
    const onLiveFix = vi.fn();
    renderChecklist("Ihr Werkbereich", "de-DE", onLiveFix);
    expect(
      await screen.findByText('"Werkbereich" is not allowed · use "Arbeitsbereich"'),
    ).toBeTruthy();
    expect(screen.getByText('"SELISE" is missing or changed')).toBeTruthy();
    expect(screen.getByText("Not used yet")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("3 glossary issues");
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    expect(onLiveFix).toHaveBeenCalledWith("Ihr Arbeitsbereich");
  });

  it("says the glossary has no value for a language without one", () => {
    renderChecklist("", "fr-FR");
    expect(screen.getByText("· No translation in the glossary")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Copy "Arbeitsbereich"/ })).toBeNull();
  });

  it("renders only the empty live region without matches", () => {
    render(
      <GlossaryTargetChecklist
        row={IDLE_ROW}
        targetText="Hallo"
        targetCulture="de-DE"
        liveMatches={[]}
        onSuggestionFix={vi.fn()}
        onRetry={vi.fn()}
        onLiveFix={vi.fn()}
      />,
    );
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("");
  });
});
