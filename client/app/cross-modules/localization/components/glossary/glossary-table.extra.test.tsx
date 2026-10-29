import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { useGetGlossaries, useGetLanguages } from "@blocks-localization/hooks/use-language-manager";
import GlossaryTable from "./glossary-table";

const navigate = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetGlossaries: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetGlossarySummaryCounts: vi.fn(() => ({})),
}));
vi.mock("@blocks-localization/components/glossary/glossary-bulk-actions", () => ({
  default: ({ selected }: { selected: { name: string }[] }) =>
    selected.length > 0 ? <div>bulk-{selected.map((g) => g.name).join(",")}</div> : null,
}));
vi.mock("@blocks-localization/components/modals/glossary/glossary-editor-sheet", () => ({
  default: ({ open, glossary }: { open: boolean; glossary?: { name: string } }) =>
    open ? <div>add-edit-{glossary ? glossary.name : "new"}</div> : null,
}));
vi.mock("@blocks-localization/components/modals/glossary/delete-glossary", () => ({
  default: ({ glossaryName }: { glossaryName: string }) => <div>delete-{glossaryName}</div>,
}));

const mockGlossaries = vi.mocked(useGetGlossaries);

const row = {
  itemId: "g1",
  name: "Acme",
  language: "en-US",
  type: "Acronym",
  context: "some context",
  additionalNote: "a note",
  createDate: "2026-01-01",
};

const setData = (items: unknown[], totalCount = items.length) =>
  mockGlossaries.mockReturnValue({
    data: { items, totalCount },
    isLoading: false,
  } as never);

const openRowMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const trigger = screen.getAllByRole("button").find((b) => b.className.includes("h-8 w-8 p-0"))!;
  await user.click(trigger);
};

describe("glossary-table (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetLanguages).mockReturnValue({
      data: [
        { itemId: "1", languageCode: "en-US", languageName: "English", isDefault: true },
        { itemId: "2", languageCode: "de-DE", languageName: "German" },
        { itemId: "3", languageCode: "fr-FR", languageName: "French" },
      ],
    } as never);
  });

  it("renders every populated column value", () => {
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Acme")).toBeTruthy();
    expect(screen.getByText("Acronym")).toBeTruthy();
    expect(screen.getByText("some context")).toBeTruthy();
    // The internal note is not a table column any more.
    expect(screen.queryByText("a note")).toBeNull();
  });

  it("shows the columns in order without Additional Note (H6)", () => {
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    const headers = screen.getAllByRole("columnheader").map((header) => header.textContent);
    // The select column is first; Created is hidden by default, Last updated is shown (Phase 8).
    expect(headers).toEqual([
      "",
      "Name",
      "Rule",
      "Status",
      "Translations",
      "Language",
      "Type",
      "Definition",
      "Last updated",
      "Actions",
    ]);
  });

  it("shows the rule badge and a chip per non-default language, warning when missing (H6, H7, H14)", () => {
    setData([
      {
        ...row,
        rule: "translate",
        translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
      },
    ]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Translate")).toBeTruthy();
    expect(screen.getByText("de-DE")).toBeTruthy();
    expect(screen.getByText("fr-FR missing")).toBeTruthy();
    expect(screen.queryByText("en-US missing")).toBeNull();
  });

  it("shows a dash instead of chips for Keep and Forbidden terms", () => {
    setData([
      {
        ...row,
        itemId: "k",
        name: "SELISE",
        rule: "keep",
      },
      {
        ...row,
        itemId: "f",
        name: "Werk",
        rule: "forbidden",
      },
    ]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Keep")).toBeTruthy();
    expect(screen.getByText("Forbidden")).toBeTruthy();
    expect(screen.queryByText(/missing/)).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("shows a migrated term's real rule and translations from the API fields, not 'missing' (C15)", () => {
    setData([
      {
        ...row,
        additionalNote: "Approved by marketing",
        schemaVersion: 2,
        rule: "translate",
        translations: [
          { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] },
          { language: "fr-FR", value: "Espace de travail", forbiddenValues: [] },
        ],
      },
    ]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Translate")).toBeTruthy();
    expect(screen.getByText("de-DE")).toBeTruthy();
    expect(screen.getByText("fr-FR")).toBeTruthy();
    expect(screen.queryByText(/missing/)).toBeNull();
  });

  it("shows the Status badge, Approved for terms without a status (C12)", () => {
    setData([
      { ...row, itemId: "a", name: "A" },
      { ...row, itemId: "d", name: "D", status: "draft" },
      { ...row, itemId: "x", name: "X", status: "deprecated" },
    ]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Approved")).toBeTruthy();
    expect(screen.getByText("Draft")).toBeTruthy();
    expect(screen.getByText("Deprecated")).toBeTruthy();
  });

  it("sends the Rule and Status filters and resets to page 0 (H12)", async () => {
    const user = userEvent.setup();
    setData([row], 100);
    const { container } = renderWithProviders(<GlossaryTable />);
    const footer = container.querySelector(".mt-5") as HTMLElement;
    const next = Array.from(footer.querySelectorAll("button")).find(
      (b) => b.querySelector(".lucide-chevron-right") && !(b as HTMLButtonElement).disabled,
    );
    fireEvent.click(next!);
    expect(mockGlossaries).toHaveBeenLastCalledWith(1, 20, "", {
      rule: undefined,
      status: undefined,
    });

    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Draft" }));
    expect(mockGlossaries).toHaveBeenLastCalledWith(0, 20, "", {
      rule: undefined,
      status: "draft",
    });

    await user.click(screen.getByRole("combobox", { name: "Rule" }));
    await user.click(await screen.findByRole("option", { name: "Keep" }));
    expect(mockGlossaries).toHaveBeenLastCalledWith(0, 20, "", { rule: "keep", status: "draft" });

    await user.click(screen.getByRole("combobox", { name: "Rule" }));
    await user.click(await screen.findByRole("option", { name: "All rules" }));
    expect(mockGlossaries).toHaveBeenLastCalledWith(0, 20, "", {
      rule: undefined,
      status: "draft",
    });
  });

  it("shows the filtered empty state and keeps search enabled when filters match nothing", async () => {
    const user = userEvent.setup();
    setData([]);
    renderWithProviders(<GlossaryTable />);
    await user.click(screen.getByRole("combobox", { name: "Status" }));
    await user.click(await screen.findByRole("option", { name: "Deprecated" }));
    expect(screen.getByText("No glossaries match the selected filters.")).toBeTruthy();
    expect((screen.getByPlaceholderText("Search glossary...") as HTMLInputElement).disabled).toBe(
      false,
    );
  });

  it("limits chips to 4 and summarizes the rest", () => {
    vi.mocked(useGetLanguages).mockReturnValue({
      data: ["en-US", "a-A", "b-B", "c-C", "d-D", "e-E", "f-F"].map((code, i) => ({
        itemId: code,
        languageCode: code,
        languageName: code,
        isDefault: i === 0,
      })),
    } as never);
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getAllByText(/ missing$/)).toHaveLength(4);
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("shows the definition without the rule marker (H8)", () => {
    setData([{ ...row, context: "A container. ⟦rule: de-DE→Arbeitsbereich⟧" }]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("A container.")).toBeTruthy();
    expect(screen.queryByText(/⟦rule/)).toBeNull();
  });

  it("does not guess the rule of a term saved by a newer version", () => {
    setData([{ ...row, additionalNote: "@@glossary-meta:v2@@{}" }]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.queryByText("Translate")).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("falls back to dashes for null, empty, and whitespace-only optional fields", () => {
    setData([
      {
        itemId: "g2",
        name: "Bare",
        language: "zz-ZZ",
        type: null,
        context: "",
        additionalNote: "   ",
        createDate: null,
      },
    ]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("Bare")).toBeTruthy();
    // A language not in the catalog (a custom one) shows its code.
    expect(screen.getByText("zz-ZZ")).toBeTruthy();
    // Missing type/date and blank text fields render a dash.
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3);
  });

  it("falls back to a dash when the language is empty", () => {
    setData([{ ...row, itemId: "g3", name: "NoLang", language: "" }]);
    renderWithProviders(<GlossaryTable />);
    expect(screen.getByText("NoLang")).toBeTruthy();
    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(1);
  });

  it("opens the edit dialog from the row menu", async () => {
    const user = userEvent.setup();
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Edit"));
    expect(await screen.findByText("add-edit-Acme")).toBeTruthy();
  });

  it("opens the delete dialog from the row menu", async () => {
    const user = userEvent.setup();
    setData([row]);
    renderWithProviders(<GlossaryTable />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete"));
    expect(await screen.findByText("delete-Acme")).toBeTruthy();
  });

  it("changes pages through the pagination footer", () => {
    setData([row], 100);
    const { container } = renderWithProviders(<GlossaryTable />);
    const footer = container.querySelector(".mt-5") as HTMLElement;
    expect(footer).toBeTruthy();
    const next = Array.from(footer.querySelectorAll("button")).find(
      (b) => b.querySelector(".lucide-chevron-right") && !(b as HTMLButtonElement).disabled,
    );
    fireEvent.click(next!);
    // Page 2 label reflects the updated page state.
    expect(screen.getByText(/Page 2 of/)).toBeTruthy();
  });
});
