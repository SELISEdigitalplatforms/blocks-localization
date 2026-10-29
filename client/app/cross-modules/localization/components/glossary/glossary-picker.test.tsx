import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import GlossaryPicker, { CREATED_NOT_FOUND_MESSAGE, pickCreatedGlossary } from "./glossary-picker";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (sub: string) => `/app/p1/${sub}`,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSearchGlossaries: vi.fn(),
  useGetLanguages: vi.fn(),
  useResolveGlossariesByIds: vi.fn(),
  useSaveGlossary: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useFetchLatestGlossary: vi.fn(() => vi.fn()),
}));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { fetchGlossaries: vi.fn() },
}));

const h = vi.mocked(hooks);
const fetchGlossaries = vi.mocked(languageManagerService.fetchGlossaries);
const saveGlossaryAsync = vi.fn();

const glossary = (overrides: Partial<IGlossary>): IGlossary => ({
  itemId: "g",
  name: "Term",
  isGlobal: true,
  createDate: "",
  lastUpdateDate: "",
  ...overrides,
});

const WORKSPACE = glossary({
  itemId: "g1",
  name: "Workspace",
  rule: "translate",
  translations: [
    { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] },
    { language: "fr-FR", value: "Espace", forbiddenValues: [] },
    { language: "es-ES", value: "Espacio", forbiddenValues: [] },
  ],
});
const SELISE = glossary({
  itemId: "g2",
  name: "SELISE",
  rule: "keep",
});
const FUTURE = glossary({
  itemId: "g3",
  name: "Future",
  additionalNote: "@@glossary-meta:v9@@{}",
});

const LANGUAGES = [
  { languageCode: "en-US", languageName: "English", isDefault: true },
  { languageCode: "de-DE", languageName: "German" },
  { languageCode: "fr-FR", languageName: "French" },
  { languageCode: "es-ES", languageName: "Spanish" },
  { languageCode: "it-IT", languageName: "Italian" },
];

type SearchState = { data?: { items: IGlossary[] }; isLoading?: boolean; isError?: boolean };
let searchByText: (text: string) => SearchState;

const onChangeSpy = vi.fn();

const Harness = ({ initial = [] as string[], known = [] as IGlossary[] }) => {
  const [ids, setIds] = useState(initial);
  return (
    <Dialog open>
      <DialogContent>
        <DialogTitle>Tag Glossary</DialogTitle>
        <GlossaryPicker
          selectedIds={ids}
          onChange={(next) => {
            onChangeSpy(next);
            setIds(next);
          }}
          allowCreate
          knownGlossaries={known}
        />
      </DialogContent>
    </Dialog>
  );
};

const openPicker = () => fireEvent.click(screen.getByRole("combobox"));
const typeQuery = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText("Search glossary..."), { target: { value } });

describe("pickCreatedGlossary", () => {
  it("picks the exact, case-sensitive name; the latest createDate among several (C19)", () => {
    const items = [
      glossary({ itemId: "a", name: "onboarding", createDate: "2026-10-27T10:00:00Z" }),
      glossary({ itemId: "b", name: "Onboarding", createDate: "2026-10-26T10:00:00Z" }),
      glossary({ itemId: "c", name: "Onboarding", createDate: "2026-10-27T09:00:00Z" }),
    ];
    expect(pickCreatedGlossary(items, " Onboarding ")?.itemId).toBe("c");
    expect(pickCreatedGlossary(items, "Onboardng")).toBeUndefined();
  });
});

describe("GlossaryPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchByText = () => ({ data: { items: [WORKSPACE, SELISE, FUTURE] } });
    h.useSearchGlossaries.mockImplementation(
      (text: string) => ({ isLoading: false, isError: false, ...searchByText(text) }) as never,
    );
    h.useGetLanguages.mockReturnValue({ data: LANGUAGES } as never);
    h.useGetLanguageModules.mockReturnValue({ data: [] } as never);
    h.useResolveGlossariesByIds.mockReturnValue({ glossaries: [], failedIds: [] });
    h.useSaveGlossary.mockReturnValue({
      isPending: false,
      mutateAsync: saveGlossaryAsync,
    } as never);
    saveGlossaryAsync.mockResolvedValue({ success: true });
  });

  it("shows the name, rule and up to 3 translation chips per row (H7, C16)", () => {
    renderWithProviders(<Harness />);
    openPicker();
    const workspace = screen.getByRole("option", { name: /Workspace/ });
    expect(within(workspace).getByText("Translate")).toBeTruthy();
    expect(within(workspace).getByText("de-DE")).toBeTruthy();
    expect(within(workspace).getByText("es-ES")).toBeTruthy();
    expect(within(workspace).queryByText("it-IT missing")).toBeNull();
    expect(within(workspace).getByText("+1")).toBeTruthy();
    expect(within(screen.getByRole("option", { name: /SELISE/ })).getByText("Keep")).toBeTruthy();
    expect(within(screen.getByRole("option", { name: /Future/ })).getByText("—")).toBeTruthy();
  });

  it("selects with the keyboard and removes only via the labelled chip button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Harness />);
    await user.click(screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");
    expect(onChangeSpy).toHaveBeenLastCalledWith(["g2"]);
    await user.keyboard("{Backspace}");
    expect(screen.getByRole("button", { name: "Remove SELISE" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove SELISE" }));
    expect(onChangeSpy).toHaveBeenLastCalledWith([]);
  });

  it("debounces the search by 300 ms", async () => {
    renderWithProviders(<Harness />);
    openPicker();
    typeQuery("Work");
    expect(h.useSearchGlossaries).toHaveBeenLastCalledWith("", true);
    await waitFor(() => expect(h.useSearchGlossaries).toHaveBeenLastCalledWith("Work", true));
  });

  it("shows only the current search's results (C10)", async () => {
    searchByText = (text) =>
      text === "Sel" ? { data: { items: [SELISE] } } : { data: { items: [WORKSPACE] } };
    renderWithProviders(<Harness />);
    openPicker();
    typeQuery("Sel");
    await waitFor(() => expect(screen.queryByRole("option", { name: /Workspace/ })).toBeNull());
    expect(screen.getByRole("option", { name: /SELISE/ })).toBeTruthy();
  });

  it("shows a searching row while loading", () => {
    searchByText = () => ({ isLoading: true });
    renderWithProviders(<Harness />);
    openPicker();
    expect(screen.getByRole("status").textContent).toContain("Searching…");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("shows the search error and keeps the selected chips (C9)", () => {
    searchByText = () => ({ isError: true });
    renderWithProviders(<Harness initial={["g1"]} known={[WORKSPACE]} />);
    openPicker();
    expect(screen.getByText("Couldn't search glossaries")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Remove Workspace" })).toBeTruthy();
  });

  it("resolves a selected id outside the loaded results (H10)", () => {
    h.useResolveGlossariesByIds.mockImplementation((ids: string[]) => ({
      glossaries: ids.includes("gl200") ? [glossary({ itemId: "gl200", name: "Gadget" })] : [],
      failedIds: [],
    }));
    renderWithProviders(<Harness initial={["gl200"]} />);
    expect(h.useResolveGlossariesByIds).toHaveBeenCalledWith(["gl200"], true);
    expect(screen.getByRole("button", { name: "Remove Gadget" })).toBeTruthy();
  });

  it("shows a skeleton chip while resolving, then 'Unknown glossary' on failure (C7)", () => {
    const { rerender } = renderWithProviders(<Harness initial={["gl404"]} />);
    expect(screen.getByLabelText("Loading glossary")).toBeTruthy();
    h.useResolveGlossariesByIds.mockReturnValue({ glossaries: [], failedIds: ["gl404"] });
    rerender(<Harness initial={["gl404"]} />);
    expect(screen.getByText("Unknown glossary")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove Unknown glossary" }));
    expect(onChangeSpy).toHaveBeenLastCalledWith([]);
  });

  describe("create flow", () => {
    beforeEach(() => {
      searchByText = (text) =>
        text === "Workspace" || text === "workspace"
          ? { data: { items: [WORKSPACE] } }
          : { data: { items: [] } };
    });

    const startCreate = async (query: string) => {
      openPicker();
      typeQuery(query);
      fireEvent.click(await screen.findByRole("option", { name: `Create "${query}"` }));
      return screen.findByPlaceholderText("Enter glossary name");
    };

    it("opens the sheet pre-filled and selects the new term after saving (H8)", async () => {
      fetchGlossaries.mockResolvedValue({
        items: [glossary({ itemId: "new1", name: "Onboardng" })],
        totalCount: 1,
      });
      renderWithProviders(<Harness />);
      const name = await startCreate("Onboardng");
      expect((name as HTMLInputElement).value).toBe("Onboardng");
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(onChangeSpy).toHaveBeenLastCalledWith(["new1"]));
      expect(fetchGlossaries).toHaveBeenCalledWith({
        pageNumber: 0,
        pageSize: 10,
        searchText: "Onboardng",
      });
      expect(screen.getByRole("button", { name: "Remove Onboardng" })).toBeTruthy();
      expect(screen.getByText("Tag Glossary")).toBeTruthy();
    });

    it("toasts and keeps the selection when the new term can't be found (C19)", async () => {
      fetchGlossaries.mockResolvedValue({ items: [], totalCount: 0 });
      renderWithProviders(<Harness initial={["g1"]} known={[WORKSPACE]} />);
      await startCreate("Onboardng");
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: CREATED_NOT_FOUND_MESSAGE }),
        ),
      );
      expect(onChangeSpy).not.toHaveBeenCalled();
    });

    it("keeps the selection when the save fails (C8)", async () => {
      saveGlossaryAsync.mockResolvedValue({ success: false, errorMessage: "Forbidden" });
      renderWithProviders(<Harness />);
      await startCreate("Onboardng");
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
      expect(onChangeSpy).not.toHaveBeenCalled();
      expect(fetchGlossaries).not.toHaveBeenCalled();
    });

    it("offers 'Select it' for a duplicate and keeps the dialog open (H15)", async () => {
      searchByText = (text) =>
        text === "workspace" ? { data: { items: [WORKSPACE] } } : { data: { items: [] } };
      renderWithProviders(<Harness />);
      // "worksp" finds nothing in the picker; the sheet then checks the full name.
      await startCreate("worksp");
      fireEvent.change(screen.getByPlaceholderText("Enter glossary name"), {
        target: { value: "workspace" },
      });
      fireEvent.click(await screen.findByRole("button", { name: "Select it" }));
      expect(onChangeSpy).toHaveBeenLastCalledWith(["g1"]);
      await waitFor(() => expect(screen.queryByPlaceholderText("Enter glossary name")).toBeNull());
      expect(screen.getByText("Tag Glossary")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Remove Workspace" })).toBeTruthy();
    });

    it("closes only the sheet on Escape and returns to the search (C18)", async () => {
      const user = userEvent.setup();
      renderWithProviders(<Harness initial={["g1"]} known={[WORKSPACE]} />);
      const name = await startCreate("Onboardng");
      await user.click(name);
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByPlaceholderText("Enter glossary name")).toBeNull());
      expect(screen.getByText("Tag Glossary")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Remove Workspace" })).toBeTruthy();
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByPlaceholderText("Search glossary...")),
      );
    });
  });
});
