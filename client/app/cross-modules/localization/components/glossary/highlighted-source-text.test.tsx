import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { findGlossaryMatches } from "@blocks-localization/test-utils/helpers/glossary-matches";
import { distinctGlossaryMatches, HighlightedSourceText } from "./highlighted-source-text";

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

const matches = (text: string) => findGlossaryMatches([G1, G2, G3], text);

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

describe("HighlightedSourceText without a rule for the target", () => {
  it("mutes and labels terms the glossary has no wording for in that language", () => {
    render(
      <HighlightedSourceText
        text={SOURCE}
        matches={matches(SOURCE)}
        targetLanguage={{ languageCode: "bn-BD", languageName: "Bengali" }}
      />,
    );
    const workspace = screen.getByRole("button", { name: /Glossary term Workspace/ });
    expect(workspace.getAttribute("aria-label")).toBe(
      "Glossary term Workspace: Translate, no Bengali wording in the glossary",
    );
    expect(workspace.className).toContain("decoration-low-emphasis/50");
    // Keep and Forbidden apply to every language.
    const selise = screen.getByRole("button", { name: /Glossary term SELISE/ });
    expect(selise.getAttribute("aria-label")).toBe("Glossary term SELISE: Keep");
    expect(selise.className).toContain("decoration-primary/70");
  });
});

describe("distinctGlossaryMatches", () => {
  it("keeps the first match of each glossary, in source order", () => {
    const text = "SELISE Workspace, another workspace and SELISE";
    expect(distinctGlossaryMatches(matches(text)).map((match) => match.surface)).toEqual([
      "SELISE",
      "Workspace",
    ]);
  });
});
