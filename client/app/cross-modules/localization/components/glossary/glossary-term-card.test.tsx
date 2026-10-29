import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";
import { IGlossary } from "@blocks-localization/models/language";
import GlossaryTermCard, { mergeSourcedGlossaries } from "./glossary-term-card";

vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));

const term = (itemId: string, extra: Partial<IGlossary> = {}): IGlossary => ({
  itemId,
  name: `Term ${itemId}`,
  createDate: "",
  lastUpdateDate: "",
  ...extra,
});

const languages = [
  { itemId: "1", languageCode: "en-US", languageName: "English", isDefault: true },
  { itemId: "2", languageCode: "de-DE", languageName: "German" },
];

const renderCard = (props: Partial<Parameters<typeof GlossaryTermCard>[0]> = {}) =>
  renderWithProviders(
    <TooltipProvider>
      <GlossaryTermCard
        glossary={term("g1", {
          name: "Workspace",
          rule: "translate",
          context: "Shared area ⟦rule: translate⟧",
          translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
        })}
        source="tagged"
        languages={languages}
        {...props}
      />
    </TooltipProvider>,
  );

describe("mergeSourcedGlossaries", () => {
  it("orders Tagged, Module, Global, Suggested and keeps each term under its first source", () => {
    const merged = mergeSourcedGlossaries({
      suggested: [term("s"), term("t")],
      global: [term("g"), term("t")],
      module: [term("m"), term("g")],
      tagged: [term("t")],
    });
    expect(merged.map(({ glossary, source }) => `${source}:${glossary.itemId}`)).toEqual([
      "tagged:t",
      "module:m",
      "module:g",
      "suggested:s",
    ]);
  });

  it("handles missing groups", () => {
    expect(mergeSourcedGlossaries({})).toEqual([]);
  });
});

describe("components/glossary/glossary-term-card", () => {
  it("shows the name link, rule, source label, chips and definition (H12)", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Workspace" }).getAttribute("href")).toBe(
      "/scoped/services/glossary/g1",
    );
    expect(screen.getByText("Translate")).toBeTruthy();
    expect(screen.getByText("Tagged")).toBeTruthy();
    expect(screen.getByText("de-DE")).toBeTruthy();
    expect(screen.getByText("Shared area")).toBeTruthy();
  });

  it("offers a labelled remove button on tagged cards", () => {
    const onRemove = vi.fn();
    renderCard({ onRemove });
    fireEvent.click(screen.getByRole("button", { name: "Remove Workspace from key" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("offers Add on suggested cards", () => {
    const onAdd = vi.fn();
    renderCard({ source: "suggested", onAdd });
    expect(screen.getByText("Suggested")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tag Workspace to key" }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("shows no chips for Keep terms and no definition when empty", () => {
    renderCard({ glossary: term("g2", { name: "SELISE", rule: "keep" }), source: "global" });
    expect(screen.getByText("Keep")).toBeTruthy();
    expect(screen.getByText("Global")).toBeTruthy();
    expect(screen.queryByText("de-DE")).toBeNull();
  });
});
