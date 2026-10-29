import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { IGlossary } from "@blocks-localization/models/language";
import GlossaryMobileList, { getGlossaryScopeText } from "./glossary-mobile-list";

vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));

const languages = [
  { itemId: "1", languageCode: "en-US", languageName: "English", isDefault: true },
  { itemId: "2", languageCode: "de-DE", languageName: "German" },
  { itemId: "3", languageCode: "fr-FR", languageName: "French" },
];

const workspace: IGlossary = {
  itemId: "g1",
  name: "Workspace",
  createDate: "",
  lastUpdateDate: "",
  rule: "translate",
  status: "draft",
  isGlobal: false,
  moduleIds: ["m1", "m2"],
  translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
};

const renderList = (props: Partial<Parameters<typeof GlossaryMobileList>[0]> = {}) => {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  renderWithProviders(
    <GlossaryMobileList
      glossaries={[workspace]}
      languages={languages}
      isLoading={false}
      emptyState={<p>empty-state</p>}
      onEdit={onEdit}
      onDelete={onDelete}
      {...props}
    />,
  );
  return { onEdit, onDelete };
};

describe("components/glossary/glossary-mobile-list", () => {
  it("renders each term as a card linking to its details (H15)", () => {
    renderList();
    const link = screen.getByRole("link", { name: "Workspace" });
    expect(link.getAttribute("href")).toBe("/scoped/services/glossary/g1");
  });

  it("shows the rule, status, scope and translation chips", () => {
    renderList();
    expect(screen.getByText("Translate")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("2 modules")).toBeTruthy();
    expect(screen.getByText("de-DE")).toBeTruthy();
    expect(screen.getByText("fr-FR missing")).toBeTruthy();
  });

  it("opens Edit and Delete from the card's actions menu", async () => {
    const user = userEvent.setup();
    const { onEdit, onDelete } = renderList();
    await user.click(screen.getByRole("button", { name: "Actions for Workspace" }));
    await user.click(await screen.findByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith(workspace);
    await user.click(screen.getByRole("button", { name: "Actions for Workspace" }));
    await user.click(await screen.findByText("Delete"));
    expect(onDelete).toHaveBeenCalledWith(workspace);
  });

  it("shows the empty state without terms", () => {
    renderList({ glossaries: [] });
    expect(screen.getByText("empty-state")).toBeTruthy();
  });

  it("shows skeletons while loading", () => {
    renderList({ isLoading: true });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("describes the scope", () => {
    expect(getGlossaryScopeText({ ...workspace, isGlobal: true })).toBe("Whole project");
    expect(getGlossaryScopeText({ ...workspace, moduleIds: ["m1"] })).toBe("1 module");
    expect(getGlossaryScopeText({ ...workspace, moduleIds: undefined })).toBe("0 modules");
  });
});
