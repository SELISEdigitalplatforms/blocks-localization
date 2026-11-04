import { fireEvent, render, screen } from "@testing-library/react";
import { KeyboardEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GlossaryRule } from "@blocks-localization/models/glossary-meta";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import GlossaryTermMenu, {
  getGlossaryTermMenuHint,
  getGlossaryTermMenuItems,
  getGlossaryTermMenuShortcut,
  hasInsertableGlossaryTerms,
  isGlossaryTermMenuShortcut,
} from "./glossary-term-menu";

vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));

const match = (
  itemId: string,
  name: string,
  rule: GlossaryRule,
  translations: Record<string, string> = {},
  surface = name,
): GlossaryMatch => ({
  glossary: { itemId, name, createDate: "", lastUpdateDate: "" },
  meta: { rule, caseSensitive: false, variants: [], translations, forbidden: {} },
  definition: "",
  start: 0,
  length: surface.length,
  surface,
  scope: "key",
  status: "approved",
});

const matches = [
  match("g1", "Workspace", "translate", { "de-DE": "Arbeitsbereich" }),
  match("g1", "Workspace", "translate", { "de-DE": "Arbeitsbereich" }, "workspace"),
  match("g2", "Invoice", "translate"),
  match("g3", "SELISE", "keep", {}, "Selise"),
  match("g4", "Werkbereich", "forbidden"),
];

const keyEvent = (init: Partial<KeyboardEvent<HTMLElement>>) =>
  ({
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    code: "",
    ...init,
  }) as KeyboardEvent<HTMLElement>;

describe("getGlossaryTermMenuItems", () => {
  it("lists each term once by rule: translate value, missing, keep surface, no forbidden (H11)", () => {
    expect(getGlossaryTermMenuItems(matches, "de-DE")).toEqual([
      {
        glossaryId: "g1",
        name: "Workspace",
        surface: "Workspace",
        value: "Arbeitsbereich",
        used: false,
      },
      { glossaryId: "g2", name: "Invoice", surface: "Invoice", used: false },
      { glossaryId: "g3", name: "SELISE", surface: "Selise", value: "Selise", used: false },
    ]);
  });

  it("marks the terms the target text already uses, inflected or in a compound", () => {
    const items = getGlossaryTermMenuItems(matches, "de-DE", "Öffne den Standardarbeitsbereich");
    expect(items.map((item) => [item.glossaryId, item.used])).toEqual([
      ["g1", true],
      ["g2", false],
      ["g3", false],
    ]);
  });
});

describe("hasInsertableGlossaryTerms", () => {
  it("is true while a term with wording is not in the target yet", () => {
    expect(hasInsertableGlossaryTerms(matches, "de-DE", "Öffne den Arbeitsbereich")).toBe(true);
  });

  it("is false once every term with wording is used", () => {
    expect(hasInsertableGlossaryTerms(matches, "de-DE", "Arbeitsbereich von Selise")).toBe(false);
  });
});

describe("getGlossaryTermMenuShortcut", () => {
  afterEach(() => vi.restoreAllMocks());

  it("names Option on Apple keyboards", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    );
    expect(getGlossaryTermMenuShortcut()).toEqual({ keys: "⌥⇧G", label: "Option+Shift+G" });
    expect(getGlossaryTermMenuHint()).toBe(
      "Press Option+Shift+G to insert a glossary at the cursor.",
    );
  });

  it("names Alt elsewhere", () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Windows NT 10.0)");
    expect(getGlossaryTermMenuShortcut()).toEqual({ keys: "Alt+Shift+G", label: "Alt+Shift+G" });
  });
});

describe("isGlossaryTermMenuShortcut", () => {
  it("matches Alt+Shift+G by key code, whatever character it types", () => {
    expect(
      isGlossaryTermMenuShortcut(keyEvent({ altKey: true, shiftKey: true, code: "KeyG" })),
    ).toBe(true);
  });

  it("ignores other combinations", () => {
    expect(isGlossaryTermMenuShortcut(keyEvent({ altKey: true, code: "KeyG" }))).toBe(false);
    expect(
      isGlossaryTermMenuShortcut(keyEvent({ altKey: true, shiftKey: true, code: "KeyH" })),
    ).toBe(false);
    expect(
      isGlossaryTermMenuShortcut(
        keyEvent({ altKey: true, shiftKey: true, ctrlKey: true, code: "KeyG" }),
      ),
    ).toBe(false);
  });
});

const renderMenu = (menuMatches: GlossaryMatch[], targetText = "") => {
  const onInsert = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <GlossaryTermMenu
      open
      onOpenChange={onOpenChange}
      matches={menuMatches}
      targetLanguage={{ languageCode: "de-DE", languageName: "German" }}
      targetText={targetText}
      onInsert={onInsert}
      onReturnFocus={vi.fn()}
    >
      <textarea aria-label="target" />
    </GlossaryTermMenu>,
  );
  return { onInsert, onOpenChange };
};

describe("components/glossary/glossary-term-menu", () => {
  it("inserts the chosen term's value and closes", () => {
    const { onInsert, onOpenChange } = renderMenu(matches);
    fireEvent.click(screen.getByRole("option", { name: /Workspace/ }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onInsert).toHaveBeenCalledWith("Arbeitsbereich", "Workspace");
  });

  it("disables a term without a value for the language", () => {
    const { onInsert } = renderMenu(matches);
    const option = screen.getByRole("option", { name: /Invoice/ });
    expect(option.getAttribute("aria-disabled")).toBe("true");
    expect(option.textContent).toContain("no German translation");
    fireEvent.click(option);
    expect(onInsert).not.toHaveBeenCalled();
  });

  it("does not list forbidden terms", () => {
    renderMenu(matches);
    expect(screen.queryByRole("option", { name: /Werkbereich/ })).toBeNull();
  });

  it("lists a term the target already uses under Already used, not insertable (no duplicates)", () => {
    const { onInsert } = renderMenu(matches, "Gehe zum Arbeitsbereich");
    expect(screen.getByText("Already used")).toBeTruthy();
    const option = screen.getByRole("option", { name: /Workspace/ });
    expect(option.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(option);
    expect(onInsert).not.toHaveBeenCalled();
    // Terms still to insert stay under the insert group.
    expect(screen.getByText("Insert in German")).toBeTruthy();
    expect(screen.getByRole("option", { name: /SELISE/ }).getAttribute("aria-disabled")).toBe(
      "false",
    );
  });

  it("drops the insert group once every term is used", () => {
    renderMenu([matches[0]], "Gehe zum Arbeitsbereich");
    expect(screen.queryByText("Insert in German")).toBeNull();
    expect(screen.getByText("Already used")).toBeTruthy();
  });

  it("says when the source has no glossary terms (C6)", () => {
    renderMenu([match("g4", "Werkbereich", "forbidden")]);
    expect(screen.getByText("No glossaries in the source")).toBeTruthy();
  });
});
