import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { buildGlossaryMatcher } from "@blocks-localization/utils/glossary-matcher";
import {
  distinctGlossaryMatches,
  GlossaryTermChips,
  HighlightedSourceText,
} from "./highlighted-source-text";

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
  translations: { "de-DE": "Arbeitsbereich", "fr-FR": "Espace de travail" },
});
const G2 = term("g2", "SELISE", { rule: "keep" });
const G3 = term("g3", "Portal", { rule: "forbidden" });

const matches = (text: string) =>
  buildGlossaryMatcher([G1, G2, G3]).match(text, {
    scopeMode: "applicable",
    sourceCulture: "en-US",
  });

const SOURCE = "Open your Workspace and SELISE portal";

describe("HighlightedSourceText", () => {
  it("renders each match as a labelled button and keeps the text exactly (H1)", () => {
    const { container } = render(
      <p>
        <HighlightedSourceText text={SOURCE} matches={matches(SOURCE)} />
      </p>,
    );
    expect(container.textContent).toBe(SOURCE);
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Workspace", "SELISE", "portal"]);
    expect(buttons[0].getAttribute("aria-label")).toBe("Glossary term Workspace: Translate");
    expect(buttons[1].getAttribute("aria-label")).toBe("Glossary term SELISE: Keep");
    expect(buttons[0].className).toContain("decoration-dotted");
  });

  it("renders plain text without matches, while loading or after a failure (C2)", () => {
    const { container } = render(<HighlightedSourceText text={SOURCE} matches={[]} />);
    expect(container.textContent).toBe(SOURCE);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("opens the popover for the editor's target and inserts (Example 1)", async () => {
    const onInsert = vi.fn();
    render(
      <HighlightedSourceText
        text={SOURCE}
        matches={matches(SOURCE)}
        targetLanguage={{ languageCode: "de-DE", languageName: "German" }}
        onInsert={onInsert}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Glossary term Workspace/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Insert" }));
    expect(onInsert).toHaveBeenCalledWith("Arbeitsbereich");
  });
});

describe("GlossaryTermChips", () => {
  it("shows one chip per distinct glossary in first-occurrence order (H12)", () => {
    const text = "SELISE Workspace, another workspace and SELISE";
    expect(distinctGlossaryMatches(matches(text)).map((match) => match.surface)).toEqual([
      "SELISE",
      "Workspace",
    ]);
    render(<GlossaryTermChips matches={matches(text)} getTargetLanguage={() => undefined} />);
    expect(screen.getByText("Glossary terms")).toBeTruthy();
    expect(screen.getAllByRole("button").map((button) => button.textContent)).toEqual([
      "SELISE",
      "Workspace",
    ]);
  });

  it("is hidden without matches", () => {
    const { container } = render(
      <GlossaryTermChips matches={[]} getTargetLanguage={() => undefined} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("uses the current target row's language for the value and Insert (H13)", async () => {
    const onInsert = vi.fn();
    const { rerender } = render(
      <GlossaryTermChips
        matches={matches("Open your Workspace")}
        getTargetLanguage={() => ({ languageCode: "de-DE", languageName: "German" })}
        onInsert={onInsert}
      />,
    );
    rerender(
      <GlossaryTermChips
        matches={matches("Open your Workspace")}
        getTargetLanguage={() => ({ languageCode: "fr-FR", languageName: "French" })}
        onInsert={onInsert}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Glossary term Workspace/ }));
    expect(await screen.findByText("Espace de travail")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Insert into French" }));
    expect(onInsert).toHaveBeenCalledWith("Espace de travail");
  });

  it("re-matches when the source changes", () => {
    const { rerender } = render(
      <GlossaryTermChips matches={matches("Workspace")} getTargetLanguage={() => undefined} />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(1);
    rerender(
      <GlossaryTermChips
        matches={matches("Workspace and SELISE")}
        getTargetLanguage={() => undefined}
      />,
    );
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });
});
