import { fireEvent, render, screen } from "@testing-library/react";
import { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { GlossaryRule } from "@blocks-localization/models/glossary-meta";
import { GlossaryMatch } from "@blocks-localization/models/glossary-match";
import GlossaryTermMenu, {
  getGlossaryTermMenuItems,
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
      { glossaryId: "g1", name: "Workspace", value: "Arbeitsbereich" },
      { glossaryId: "g2", name: "Invoice" },
      { glossaryId: "g3", name: "SELISE", value: "Selise" },
    ]);
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

const renderMenu = (menuMatches: GlossaryMatch[]) => {
  const onInsert = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <GlossaryTermMenu
      open
      onOpenChange={onOpenChange}
      matches={menuMatches}
      targetLanguage={{ languageCode: "de-DE", languageName: "German" }}
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
    expect(onInsert).toHaveBeenCalledWith("Arbeitsbereich");
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

  it("says when the source has no glossary terms (C6)", () => {
    renderMenu([match("g4", "Werkbereich", "forbidden")]);
    expect(screen.getByText("No glossary terms in the source")).toBeTruthy();
  });
});
