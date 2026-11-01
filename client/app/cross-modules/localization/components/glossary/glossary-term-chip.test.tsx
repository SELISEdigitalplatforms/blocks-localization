import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";
import { IGlossary } from "@blocks-localization/models/language";
import GlossaryTermChip, { mergeSourcedGlossaries } from "./glossary-term-chip";

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

const renderChip = (props: Partial<Parameters<typeof GlossaryTermChip>[0]> = {}) =>
  renderWithProviders(
    <TooltipProvider>
      <GlossaryTermChip
        glossary={term("g1", {
          name: "Workspace",
          rule: "translate",
          context: "Shared area ⟦rule: translate⟧",
          translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
        })}
        source="tagged"
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

describe("components/glossary/glossary-term-chip", () => {
  it("shows only the name link and the source label (H12)", () => {
    renderChip();
    expect(screen.getByRole("link", { name: "Workspace" }).getAttribute("href")).toBe(
      "/scoped/services/glossary/g1",
    );
    expect(screen.getByText("Tagged")).toBeTruthy();
    expect(screen.queryByText("Translate")).toBeNull();
    expect(screen.queryByText("de-DE")).toBeNull();
    expect(screen.queryByText("Shared area")).toBeNull();
  });

  it("offers a labelled remove button on tagged chips", () => {
    const onRemove = vi.fn();
    renderChip({ onRemove });
    fireEvent.click(screen.getByRole("button", { name: "Remove Workspace from key" }));
    expect(onRemove).toHaveBeenCalled();
  });

  it("offers Add on suggested chips", () => {
    const onAdd = vi.fn();
    renderChip({ source: "suggested", onAdd });
    expect(screen.getByText("Suggested")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Tag Workspace to key" }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });

  it("offers no actions on module and global chips", () => {
    renderChip({ glossary: term("g2", { name: "SELISE", rule: "keep" }), source: "global" });
    expect(screen.getByText("Global")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
