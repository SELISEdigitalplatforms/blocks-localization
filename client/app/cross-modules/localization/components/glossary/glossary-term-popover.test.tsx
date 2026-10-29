import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import { findGlossaryMatches } from "@blocks-localization/test-utils/helpers/glossary-matches";
import GlossaryTermPopover, { getGlossaryTermValue } from "./glossary-term-popover";

vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (sub: string) => `/app/p1/${sub}`,
}));

const term = (itemId: string, name: string, meta: object, context = ""): IGlossary => ({
  itemId,
  name,
  isGlobal: true,
  context,
  createDate: "",
  lastUpdateDate: "",
  additionalNote: GLOSSARY_META_PREFIX + JSON.stringify(meta),
});

const G1 = term(
  "g1",
  "Workspace",
  { rule: "translate", translations: { "de-DE": "Arbeitsbereich" } },
  "A shared area. ⟦rule: de-DE→Arbeitsbereich⟧",
);
// Keep with a leftover translation (Phase 2 A9): never shown or inserted.
const G2 = term("g2", "SELISE", { rule: "keep", translations: { "de-DE": "Selise GmbH" } });
const G3 = term("g3", "Dashboard", {
  rule: "forbidden",
  translations: { "de-DE": "Armaturenbrett" },
  forbidden: { "de-DE": ["Kontrollzentrum"] },
});

const matchOf = (glossary: IGlossary, text = glossary.name): GlossaryMatch =>
  findGlossaryMatches([glossary], text)[0];

const DE = { languageCode: "de-DE", languageName: "German" };

const renderPopover = (match: GlossaryMatch, onInsert = vi.fn(), targetText = "") =>
  render(
    <GlossaryTermPopover
      match={match}
      targetLanguage={DE}
      onInsert={onInsert}
      targetText={targetText}
    >
      <button type="button">{match.surface}</button>
    </GlossaryTermPopover>,
  );

describe("getGlossaryTermValue", () => {
  it("reads values by rule (C16)", () => {
    expect(getGlossaryTermValue(matchOf(G1).meta, "Workspace", "de-DE")).toEqual({
      kind: "translate",
      value: "Arbeitsbereich",
    });
    expect(getGlossaryTermValue(matchOf(G1).meta, "Workspace", "fr-FR")).toEqual({
      kind: "missing",
      alsoAvoid: [],
    });
    expect(getGlossaryTermValue(matchOf(G2).meta, "SELISE", "de-DE")).toEqual({
      kind: "keep",
      value: "SELISE",
    });
    expect(getGlossaryTermValue(matchOf(G3).meta, "Dashboard", "de-DE")).toEqual({
      kind: "forbidden",
      alsoAvoid: ["Kontrollzentrum"],
    });
  });
});

describe("GlossaryTermPopover", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the term, rule, target value and definition without the marker (H2)", async () => {
    renderPopover(matchOf(G1));
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(await screen.findByText("Arbeitsbereich")).toBeTruthy();
    expect(screen.getByText("Translate")).toBeTruthy();
    expect(screen.getByText("A shared area.")).toBeTruthy();
    expect(screen.queryByText(/⟦rule/)).toBeNull();
  });

  it("shows the first usage example only (Phase 8 H22)", async () => {
    const match = matchOf(G1);
    renderPopover({
      ...match,
      glossary: { ...match.glossary, usageExamples: [" ", "Open your workspace.", "Second."] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(await screen.findByText("e.g. “Open your workspace.”")).toBeTruthy();
    expect(screen.queryByText(/Second\./)).toBeNull();
  });

  it("shows the Draft badge and notice for a Draft term (H7)", async () => {
    renderPopover(matchOf({ ...G1, status: "draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(await screen.findByText("Draft")).toBeTruthy();
    expect(screen.getByText("Draft: not sent to the AI")).toBeTruthy();
  });

  it("shows no status for an Approved term", async () => {
    renderPopover(matchOf(G1));
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    await screen.findByText("Arbeitsbereich");
    expect(screen.queryByText("Draft")).toBeNull();
    expect(screen.queryByText("Draft: not sent to the AI")).toBeNull();
  });

  it("inserts the translation and closes (H3)", async () => {
    const onInsert = vi.fn();
    renderPopover(matchOf(G1), onInsert);
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Insert" }));
    expect(onInsert).toHaveBeenCalledWith("Arbeitsbereich");
    await waitFor(() => expect(screen.queryByText("Arbeitsbereich")).toBeNull());
  });

  it("offers no dead-end Insert for a missing translation, but a way to add it (C3)", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    render(
      <GlossaryTermPopover
        match={matchOf(G1)}
        targetLanguage={{ languageCode: "fr-FR", languageName: "French" }}
        onInsert={vi.fn()}
      >
        <button type="button">Workspace</button>
      </GlossaryTermPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(
      await screen.findByText("The glossary has no French translation for this term yet."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Insert/ })).toBeNull();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Add the French translation in the glossary (opens in a new tab)",
      }),
    );
    expect(open).toHaveBeenCalledWith("/app/p1/services/glossary/g1", "_blank", "noopener");
  });

  it("still lists the banned words of a term without a translation", async () => {
    const banned = term("g5", "Workspace", {
      rule: "translate",
      translations: { "de-DE": "Arbeitsbereich" },
      forbidden: { "fr-FR": ["Espace boulot"] },
    });
    render(
      <GlossaryTermPopover
        match={matchOf(banned)}
        targetLanguage={{ languageCode: "fr-FR", languageName: "French" }}
      >
        <button type="button">Workspace</button>
      </GlossaryTermPopover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(await screen.findByText("Also avoid")).toBeTruthy();
    expect(screen.getByText("Espace boulot")).toBeTruthy();
  });

  it("shows 'Keep as written' without Insert and ignores a leftover translation (C16)", async () => {
    renderPopover(matchOf(G2));
    fireEvent.click(screen.getByRole("button", { name: "SELISE" }));
    expect(await screen.findByText("Keep as written")).toBeTruthy();
    expect(screen.queryByText("Selise GmbH")).toBeNull();
    expect(screen.queryByRole("button", { name: /Insert/ })).toBeNull();
  });

  it("hides Insert for Forbidden and lists the active forbidden values (C4, C16)", async () => {
    renderPopover(matchOf(G3));
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
    expect(await screen.findByText("Do not use")).toBeTruthy();
    expect(screen.getByText("Also avoid")).toBeTruthy();
    expect(screen.getByText("Kontrollzentrum")).toBeTruthy();
    expect(screen.queryByText("Armaturenbrett")).toBeNull();
    expect(screen.queryByRole("button", { name: /Insert/ })).toBeNull();
  });

  it("says 'Already used' instead of Insert when the target has the value", async () => {
    renderPopover(matchOf(G1), vi.fn(), "Öffnen Sie Ihren arbeitsbereich");
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    expect(await screen.findByText("Already used")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Insert" })).toBeNull();
  });

  it("opens the term in a new tab (H4)", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderPopover(matchOf(G1));
    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open term (opens in a new tab)" }));
    expect(open).toHaveBeenCalledWith("/app/p1/services/glossary/g1", "_blank", "noopener");
  });

  it("closes on Escape and returns focus to the term (C12)", async () => {
    const user = userEvent.setup();
    renderPopover(matchOf(G1));
    const trigger = screen.getByRole("button", { name: "Workspace" });
    trigger.focus();
    await user.keyboard("{Enter}");
    expect(await screen.findByText("Arbeitsbereich")).toBeTruthy();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByText("Arbeitsbereich")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
