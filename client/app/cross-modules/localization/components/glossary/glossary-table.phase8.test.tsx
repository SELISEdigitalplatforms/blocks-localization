import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import useIsMobile from "@/hooks/use-is-mobile";
import {
  useGetGlossaries,
  useGetGlossarySummaryCounts,
  useGetLanguages,
} from "@blocks-localization/hooks/use-language-manager";
import GlossaryTable, { GLOSSARY_COLUMNS_STORAGE_KEY, getGlossaryLanguageName } from "./glossary-table";

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@/hooks/use-is-mobile", () => ({ default: vi.fn(() => false) }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetGlossaries: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetGlossarySummaryCounts: vi.fn(),
}));
vi.mock("@blocks-localization/components/glossary/glossary-bulk-actions", () => ({
  default: ({ selected }: { selected: { name: string }[] }) =>
    selected.length > 0 ? <div>bulk-{selected.map((g) => g.name).join(",")}</div> : null,
}));
vi.mock("@blocks-localization/components/modals/glossary/glossary-editor-sheet", () => ({
  default: ({ open, glossary }: { open: boolean; glossary?: { name: string } }) =>
    open ? <div>sheet-{glossary ? glossary.name : "new"}</div> : null,
}));
vi.mock("@blocks-localization/components/modals/glossary/delete-glossary", () => ({
  default: () => null,
}));

const mockGlossaries = vi.mocked(useGetGlossaries);

const languages = [
  { itemId: "1", languageCode: "en-US", languageName: "English", isDefault: true },
  { itemId: "2", languageCode: "de-DE", languageName: "German" },
];

const term = (itemId: string, name: string, extra: Record<string, unknown> = {}) => ({
  itemId,
  name,
  language: "de-DE",
  createDate: "2026-01-01",
  lastUpdateDate: "2026-01-02",
  ...extra,
});

const setItems = (items: unknown[], totalCount = items.length) =>
  mockGlossaries.mockReturnValue({
    data: { items, totalCount },
    isLoading: false,
    refetch: vi.fn(),
  } as never);

const lastFilters = () => mockGlossaries.mock.calls.at(-1)?.[3];

describe("glossary-table (Phase 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(useIsMobile).mockReturnValue(false);
    vi.mocked(useGetLanguages).mockReturnValue({ data: languages } as never);
    vi.mocked(useGetGlossarySummaryCounts).mockReturnValue({
      total: 128,
      approved: 112,
      draft: 9,
      deprecated: 7,
    });
  });
  afterEach(() => vi.restoreAllMocks());

  describe("language names (H1, C1)", () => {
    it("uses the project language name and falls back to the code", () => {
      expect(getGlossaryLanguageName("de-DE", languages)).toBe("German");
      expect(getGlossaryLanguageName("xx-XX", languages)).toBe("xx-XX");
      expect(getGlossaryLanguageName("de-DE", undefined)).toBe("de-DE");
      expect(getGlossaryLanguageName("", languages)).toBe("—");
    });

    it("shows German instead of the dummy list or the raw code", () => {
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      expect(screen.getByRole("cell", { name: "German" })).toBeTruthy();
    });
  });

  describe("column toggle (H1, C2)", () => {
    it("hides a column and remembers it per browser", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace", { type: "Acronym" })]);
      const { unmount } = renderWithProviders(<GlossaryTable />);
      expect(screen.getByRole("columnheader", { name: "Type" })).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("menuitemcheckbox", { name: "Type" }));
      expect(screen.queryByRole("columnheader", { name: "Type" })).toBeNull();
      expect(JSON.parse(localStorage.getItem(GLOSSARY_COLUMNS_STORAGE_KEY)!)).toMatchObject({
        type: false,
      });
      unmount();
      renderWithProviders(<GlossaryTable />);
      expect(screen.queryByRole("columnheader", { name: "Type" })).toBeNull();
    });

    it("never offers Name or Actions in the Columns menu", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      await user.click(screen.getByRole("button", { name: "Columns" }));
      const items = screen.getAllByRole("menuitemcheckbox").map((item) => item.textContent);
      expect(items).not.toContain("Name");
      expect(items).not.toContain("Actions");
    });

    it("uses the default columns when storage throws", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      expect(screen.getByRole("columnheader", { name: /Last updated/ })).toBeTruthy();
      expect(screen.queryByRole("columnheader", { name: /^Created/ })).toBeNull();
    });
  });

  describe("empty state (H2)", () => {
    it("offers Create your first term, which opens the sheet", async () => {
      const user = userEvent.setup();
      setItems([]);
      renderWithProviders(<GlossaryTable />);
      await user.click(screen.getByRole("button", { name: "Create your first term" }));
      expect(screen.getByText("sheet-new")).toBeTruthy();
    });

    it("offers Clear filters instead when a filter is active", async () => {
      const user = userEvent.setup();
      setItems([]);
      renderWithProviders(<GlossaryTable />);
      await user.click(screen.getByRole("button", { name: /9 draft/ }));
      expect(screen.queryByRole("button", { name: "Create your first term" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "Clear filters" }));
      expect(lastFilters()).toMatchObject({ status: undefined });
    });
  });

  describe("filters and sort (H16, H17, C18)", () => {
    it("sends no sort parameters by default", () => {
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      expect(lastFilters()).not.toHaveProperty("sortBy");
      expect(screen.getByRole("columnheader", { name: /Last updated/ }).getAttribute("aria-sort")).toBe(
        "none",
      );
    });

    it("sorts by Name ascending, then descending, and marks the header", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      await user.click(screen.getByRole("button", { name: "Name" }));
      expect(lastFilters()).toMatchObject({ sortBy: "name", sortDescending: false });
      expect(screen.getByRole("columnheader", { name: "Name" }).getAttribute("aria-sort")).toBe(
        "ascending",
      );
      await user.click(screen.getByRole("button", { name: "Name" }));
      expect(lastFilters()).toMatchObject({ sortBy: "name", sortDescending: true });
      expect(mockGlossaries.mock.calls.at(-1)?.[0]).toBe(0);
    });

    it("sends Language, Type and Scope and resets to page 0", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace")], 45);
      renderWithProviders(<GlossaryTable />);
      await user.click(screen.getByRole("button", { name: "Go to next page" }));
      expect(mockGlossaries.mock.calls.at(-1)?.[0]).toBe(1);

      await user.click(screen.getByRole("combobox", { name: "Language" }));
      await user.click(screen.getByRole("option", { name: "German" }));
      await user.click(screen.getByRole("combobox", { name: "Type" }));
      await user.click(screen.getByRole("option", { name: "Acronym" }));
      await user.click(screen.getByRole("combobox", { name: "Scope" }));
      await user.click(screen.getByRole("option", { name: "Specific modules" }));

      expect(lastFilters()).toMatchObject({ language: "de-DE", type: "Acronym", scope: "modules" });
      expect(mockGlossaries.mock.calls.at(-1)?.[0]).toBe(0);
    });
  });

  describe("summary strip (H18)", () => {
    it("shows the counts and applies a Status filter", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      const total = screen.getByRole("button", { name: "128 terms" });
      expect(total.getAttribute("aria-pressed")).toBe("true");
      await user.click(screen.getByRole("button", { name: "112 approved" }));
      expect(lastFilters()).toMatchObject({ status: "approved" });
      expect(
        screen.getByRole("button", { name: "112 approved" }).getAttribute("aria-pressed"),
      ).toBe("true");
      await user.click(screen.getByRole("button", { name: "128 terms" }));
      expect(lastFilters()).toMatchObject({ status: undefined });
    });
  });

  describe("selection (H19, C9, C10)", () => {
    it("selects the page from the header, skipping terms of a newer format", async () => {
      const user = userEvent.setup();
      setItems([
        term("g1", "Workspace"),
        term("g2", "Legacy", { additionalNote: "@@glossary-meta:v2@@{}" }),
      ]);
      renderWithProviders(<GlossaryTable />);
      expect(
        (screen.getByRole("checkbox", { name: "Select Legacy" }) as HTMLButtonElement).disabled,
      ).toBe(true);
      await user.click(screen.getByRole("checkbox", { name: "Select all terms on this page" }));
      expect(screen.getByText("bulk-Workspace")).toBeTruthy();
    });

    it("clears the selection when a filter changes", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      await user.click(screen.getByRole("checkbox", { name: "Select Workspace" }));
      expect(screen.getByText("bulk-Workspace")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: /9 draft/ }));
      expect(screen.queryByText("bulk-Workspace")).toBeNull();
    });

    it("does not open the term when its checkbox is toggled", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      await user.click(screen.getByRole("checkbox", { name: "Select Workspace" }));
      expect(screen.queryByText(/sheet-/)).toBeNull();
    });
  });

  describe("narrow widths (H15)", () => {
    it("renders a card list linking to each term below md", () => {
      vi.mocked(useIsMobile).mockReturnValue(true);
      setItems([term("g1", "Workspace")]);
      renderWithProviders(<GlossaryTable />);
      expect(screen.queryByRole("table")).toBeNull();
      const list = screen.getByRole("list", { name: "Glossary terms" });
      expect(within(list).getByRole("link", { name: "Workspace" }).getAttribute("href")).toBe(
        "/scoped/services/glossary/g1",
      );
    });

    it("makes a truncated definition focusable so its tooltip opens on Tab", async () => {
      const user = userEvent.setup();
      setItems([term("g1", "Workspace", { context: "Where a team keeps its shared files" })]);
      renderWithProviders(<GlossaryTable />);
      const definition = screen.getByText("Where a team keeps its shared files");
      expect(definition.getAttribute("tabindex")).toBe("0");
      definition.focus();
      await user.keyboard("{Shift>}{Tab}{/Shift}{Tab}");
      expect((await screen.findAllByText("Where a team keeps its shared files")).length).toBeGreaterThan(1);
    });
  });
});
