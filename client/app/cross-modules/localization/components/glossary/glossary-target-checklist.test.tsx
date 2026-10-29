import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GlossaryRowState } from "@blocks-localization/components/glossary/glossary-violation-list";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { appliedTermToMatch } from "@blocks-localization/hooks/use-glossary-aware-suggestion";
import { findGlossaryMatches } from "@blocks-localization/test-utils/helpers/glossary-matches";
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

const MATCHES = findGlossaryMatches([G1, G2, G3], "Open your Workspace and SELISE portal");

const IDLE_ROW: GlossaryRowState = {
  violations: [],
  matches: [],
  targetCulture: "",
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

  it("never calls a term without a rule for the language followed", () => {
    const portalOnly = findGlossaryMatches(
      [
        term("g4", "Customer Portal", {
          rule: "translate",
          translations: { "de-DE": "Kundenportal" },
        }),
      ],
      "Go to Customer Portal",
    );
    render(
      <GlossaryTargetChecklist
        row={IDLE_ROW}
        targetText="কাস্টমার পোর্টালে যান"
        targetCulture="bn-BD"
        languageName="Bengali"
        liveMatches={portalOnly}
        onSuggestionFix={vi.fn()}
        onRetry={vi.fn()}
        onLiveFix={vi.fn()}
      />,
    );
    expect(screen.getByRole("status").textContent).toBe("Nothing to check for Bengali");
    expect(screen.queryByText(/followed/)).toBeNull();
    expect(screen.getByText("No rule to check:")).toBeTruthy();
  });

  it("says only the checked terms were followed when some have no rule", () => {
    renderChecklist("Ouvrez SELISE", "fr-FR");
    expect(screen.getByRole("status").textContent).toBe("All checked terms followed");
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

  it("marks a Draft term's live issue (A2)", async () => {
    render(
      <GlossaryTargetChecklist
        row={IDLE_ROW}
        targetText="Ihr Werkbereich"
        targetCulture="de-DE"
        liveMatches={findGlossaryMatches([{ ...G1, status: "draft" }], "Open your Workspace")}
        onSuggestionFix={vi.fn()}
        onRetry={vi.fn()}
        onLiveFix={vi.fn()}
      />,
    );
    expect(
      await screen.findByText('Draft term: "Werkbereich" is not allowed · use "Arbeitsbereich"'),
    ).toBeTruthy();
  });

  describe("after a suggestion", () => {
    const suggestionRow = (overrides: Partial<GlossaryRowState>): GlossaryRowState => ({
      ...IDLE_ROW,
      targetCulture: "de-DE",
      fromSuggestion: true,
      ...overrides,
    });
    const renderRow = (row: GlossaryRowState, onSuggestionFix = vi.fn(), onRetry = vi.fn()) =>
      render(
        <GlossaryTargetChecklist
          row={row}
          targetText="Ihr Werkbereich"
          targetCulture="de-DE"
          languageName="German"
          liveMatches={MATCHES}
          onSuggestionFix={onSuggestionFix}
          onRetry={onRetry}
          onLiveFix={vi.fn()}
        />,
      );
    const forbiddenUsed = {
      glossaryId: "g1",
      term: "Workspace",
      kind: "forbidden-used" as const,
      found: "Werkbereich",
    };

    it("shows nothing when the server applied and reported nothing (C1)", () => {
      renderRow(suggestionRow({}));
      expect(screen.queryByRole("region")).toBeNull();
    });

    it("lists only the terms the server applied, with its violations and Fix (C20)", () => {
      const onSuggestionFix = vi.fn();
      renderRow(
        suggestionRow({
          violations: [forbiddenUsed],
          matches: [
            appliedTermToMatch(
              {
                glossaryId: "g1",
                term: "Workspace",
                rule: "translate",
                expected: "Arbeitsbereich",
              },
              "de-DE",
            ),
          ],
        }),
        onSuggestionFix,
      );
      const region = screen.getByRole("region", { name: "Glossary terms for German" });
      expect(within(region).getByText("Workspace")).toBeTruthy();
      expect(within(region).queryByText("SELISE")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Fix" }));
      expect(onSuggestionFix).toHaveBeenCalledWith(forbiddenUsed);
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    });

    it("offers Retry, not Fix, without a Translate expected value (C20)", () => {
      const onRetry = vi.fn();
      renderRow(
        suggestionRow({
          violations: [forbiddenUsed],
          matches: [
            appliedTermToMatch({ glossaryId: "g1", term: "Workspace", rule: "translate" }, "de-DE"),
          ],
        }),
        vi.fn(),
        onRetry,
      );
      expect(screen.queryByRole("button", { name: "Fix" })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
