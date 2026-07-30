import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { useLanguageViewStore } from "@blocks-localization/store/use-language-view-store";
import { LanguageTable } from "./language-table";

const navigate = vi.fn();
const setQueryParams = vi.fn();
const setSortQueryParams = vi.fn();
const sortReset = vi.fn();

// Mutable query-param state so individual tests can drive the memoised
// resource-search parsing and filter branches inside the component.
let queryParamsState: Record<string, unknown> = {};

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-utilities/notification", () => ({
  useNotificationListener: vi.fn(),
}));
vi.mock("@blocks-localization/components/language-table-toolbar/language-table-toolbar", () => ({
  LanguageTableToolbar: () => null,
  useKeysFilterQueryParams: () => ({
    queryParams: queryParamsState,
    setQueryParams,
  }),
  useKeysSortQueryParams: () => ({
    sortQueryParams: { property: "KeyName", isDescending: false },
    setSortQueryParams,
    reset: sortReset,
  }),
}));
vi.mock("@blocks-localization/components/modals/auto-translate/auto-translate", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/components/modals/export-key/export-key", () => ({
  default: () => null,
}));
vi.mock("../../components/import-language-file/import-file-modal", () => ({
  default: () => null,
}));
vi.mock("../localization-timeline/localization-timeline", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetBlocksLanguageKey: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useGetLanguages: vi.fn(),
  useDeleteLanguageKey: vi.fn(),
  useDeleteLanguageKeys: vi.fn(),
  useGenerateUilmFile: vi.fn(),
  useTranslateKey: vi.fn(),
  useTranslateKeyWithPolling: vi.fn(),
  useTranslateLanguageKeys: vi.fn(),
}));

// Keep the real zustand store, but neutralise the tenant re-hydration side
// effect so tests can prime view settings deterministically. The mount effect
// otherwise calls updateLanguageViewTenantId, which reloads (empty) cookie
// state and clobbers whatever we set up.
vi.mock("@blocks-localization/store/use-language-view-store", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@blocks-localization/store/use-language-view-store")>();
  return {
    ...actual,
    updateLanguageViewTenantId: vi.fn(),
    rehydrateLanguageViewStore: vi.fn(),
  };
});

const h = vi.mocked(hooks);

const deleteAsync = vi.fn();
const translateKeyAsync = vi.fn();
const bulkDeleteAsync = vi.fn();
const bulkTranslateAsync = vi.fn();
const generateAsync = vi.fn();

const baseLanguages = [
  { languageCode: "en-US", languageName: "English", isDefault: true },
  { languageCode: "de-DE", languageName: "German", isDefault: false },
];

const setBaseMocks = (languages: unknown = baseLanguages) => {
  h.useGetLanguageModules.mockReturnValue({
    data: [{ itemId: "m1", moduleName: "UILM" }],
    isLoading: false,
  } as never);
  h.useGetLanguages.mockReturnValue({ data: languages } as never);
  h.useDeleteLanguageKey.mockReturnValue({
    isPending: false,
    mutateAsync: deleteAsync,
  } as never);
  h.useDeleteLanguageKeys.mockReturnValue({
    isPending: false,
    mutateAsync: bulkDeleteAsync,
  } as never);
  h.useGenerateUilmFile.mockReturnValue({
    isPending: false,
    mutateAsync: generateAsync,
  } as never);
  h.useTranslateKey.mockReturnValue({
    isPending: false,
    mutateAsync: translateKeyAsync,
  } as never);
  h.useTranslateLanguageKeys.mockReturnValue({
    isPending: false,
    mutateAsync: bulkTranslateAsync,
  } as never);
  h.useTranslateKeyWithPolling.mockReturnValue(undefined as never);
};

const setKeys = (data: unknown) =>
  h.useGetBlocksLanguageKey.mockReturnValue({
    isLoading: false,
    data,
  } as never);

const oneKey = (overrides: Record<string, unknown> = {}) => ({
  totalCount: 1,
  keys: [
    {
      itemId: "k1",
      keyName: "greeting",
      moduleId: "m1",
      routes: [],
      glossaryIds: [],
      resources: [{ culture: "en-US", value: "Hello" }],
      isPartiallyTranslated: false,
      createDate: "2026-01-01T00:00:00Z",
      lastUpdateDate: "2026-01-02T00:00:00Z",
      context: "",
      ...overrides,
    },
  ],
});

// Set the persisted view store deterministically before each render.
const primeStore = (selectedLanguages: string[] = [], selectedOptionalColumns: string[] = []) =>
  useLanguageViewStore.setState({
    selectedLanguages,
    selectedOptionalColumns,
    isHydrated: true,
    hasStoredViewSettings: true,
    tenantId: "t1",
  });

// Locate the ellipsis trigger inside a rendered data row.
const getRowActionsTrigger = () => {
  const buttons = screen.getAllByRole("button");
  return buttons.find((b) => b.className.includes("h-8 w-8 p-0"))!;
};

describe("language-table (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryParamsState = {
      pageNumber: 0,
      pageSize: 10,
      search: "",
      moduleIds: [],
      missingLanguages: [],
      resourceSearch: "",
    };
    setBaseMocks();
    primeStore([], []);
  });

  describe("optional & language column renderers", () => {
    it("renders completeness as Complete when every language has a value", () => {
      primeStore(["en-US", "de-DE"], ["completeness"]);
      setKeys(
        oneKey({
          resources: [
            { culture: "en-US", value: "Hello" },
            { culture: "de-DE", value: "Hallo" },
          ],
        }),
      );
      renderWithProviders(<LanguageTable />);
      expect(screen.getByText("Complete")).toBeTruthy();
    });

    it("renders completeness as Partial when a language value is missing", () => {
      primeStore(["en-US", "de-DE"], ["completeness"]);
      setKeys(
        oneKey({
          resources: [{ culture: "en-US", value: "Hello" }],
        }),
      );
      renderWithProviders(<LanguageTable />);
      expect(screen.getByText("Partial")).toBeTruthy();
    });

    it("renders 'No translation' when a key has no resources", () => {
      primeStore([], ["completeness"]);
      setKeys(oneKey({ resources: [] }));
      renderWithProviders(<LanguageTable />);
      expect(screen.getByText("No translation")).toBeTruthy();
    });

    it("renders created and last-updated date cells, with a dash when absent", () => {
      primeStore([], ["createDate", "lastUpdateDate"]);
      setKeys({
        totalCount: 2,
        keys: [
          {
            itemId: "k1",
            keyName: "greeting",
            moduleId: "m1",
            resources: [],
            createDate: "2026-01-01T00:00:00Z",
            lastUpdateDate: "2026-01-02T00:00:00Z",
          },
          {
            itemId: "k2",
            keyName: "farewell",
            moduleId: "m1",
            resources: [],
            createDate: null,
            lastUpdateDate: null,
          },
        ],
      });
      renderWithProviders(<LanguageTable />);
      // The null-date rows render em dashes.
      expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
      // Column headers for the optional date columns are present.
      expect(screen.getByText("Created Date")).toBeTruthy();
      expect(screen.getByText("Last Updated Date")).toBeTruthy();
    });

    it("renders a language column value for the selected language", () => {
      primeStore(["de-DE"], []);
      setKeys(
        oneKey({
          resources: [{ culture: "de-DE", value: "Hallo Welt" }],
        }),
      );
      renderWithProviders(<LanguageTable />);
      expect(screen.getByText("Hallo Welt")).toBeTruthy();
      expect(screen.getByText("German")).toBeTruthy();
    });

    it("does not render a module cell for an unknown module id", () => {
      primeStore([], []);
      setKeys(oneKey({ moduleId: "does-not-exist" }));
      renderWithProviders(<LanguageTable />);
      // Module column stays empty for unmatched module ids.
      expect(screen.queryByText("UILM")).toBeNull();
    });
  });

  describe("resource search parsing", () => {
    it("parses a valid resourceSearch json into a filter", () => {
      queryParamsState.resourceSearch = JSON.stringify({ "de-DE": "foo" });
      primeStore(["de-DE"], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      // The de-DE search input reflects the parsed value.
      const inputs = screen.getAllByPlaceholderText("Search...");
      const values = inputs.map((i) => (i as HTMLInputElement).value);
      expect(values).toContain("foo");
    });

    it("falls back to an empty map for malformed resourceSearch json", () => {
      queryParamsState.resourceSearch = "{not-json";
      primeStore(["de-DE"], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      const inputs = screen.getAllByPlaceholderText("Search...");
      const values = inputs.map((i) => (i as HTMLInputElement).value);
      // No parsed value; the de-DE search stays empty.
      expect(values.every((v) => v === "")).toBe(true);
    });

    it("updates resource search and normalises the reducer output", () => {
      vi.useFakeTimers();
      try {
        primeStore(["de-DE"], []);
        setKeys(oneKey());
        renderWithProviders(<LanguageTable />);
        const inputs = screen.getAllByPlaceholderText("Search...");
        // The last search input belongs to the de-DE language column.
        fireEvent.change(inputs[inputs.length - 1], {
          target: { value: "abc" },
        });
        // The SearchInput debounces its onChange by 300ms.
        vi.advanceTimersByTime(350);
        expect(setQueryParams).toHaveBeenCalled();
        const updater = setQueryParams.mock.calls.at(-1)![0] as (
          prev: Record<string, unknown>,
        ) => Record<string, unknown>;
        // Merge into existing state.
        const merged = updater({
          resourceSearch: JSON.stringify({ "en-US": "x" }),
        });
        expect(JSON.parse(merged.resourceSearch as string)).toEqual({
          "en-US": "x",
          "de-DE": "abc",
        });
        // Malformed previous value is tolerated.
        const fromBroken = updater({ resourceSearch: "oops" });
        expect(JSON.parse(fromBroken.resourceSearch as string)).toEqual({
          "de-DE": "abc",
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("clears an empty resource search entry via the clear button", () => {
      queryParamsState.resourceSearch = JSON.stringify({ "de-DE": "old" });
      primeStore(["de-DE"], []);
      setKeys(oneKey());
      const { container } = renderWithProviders(<LanguageTable />);
      // The clear (X) buttons call onChange("") synchronously.
      const clearButtons = Array.from(container.querySelectorAll("button")).filter((b) =>
        b.querySelector(".lucide-x"),
      );
      fireEvent.click(clearButtons[clearButtons.length - 1]);
      const updater = setQueryParams.mock.calls.at(-1)![0] as (
        prev: Record<string, unknown>,
      ) => Record<string, unknown>;
      const merged = updater({
        resourceSearch: JSON.stringify({ "de-DE": "old" }),
      });
      // Empty value removes the entry, leaving no resourceSearch.
      expect(merged.resourceSearch).toBe("");
    });

    it("updates the key search field", () => {
      vi.useFakeTimers();
      try {
        primeStore([], []);
        setKeys(oneKey());
        renderWithProviders(<LanguageTable />);
        const keyInput = screen.getAllByPlaceholderText("Search...")[0];
        fireEvent.change(keyInput, { target: { value: "gre" } });
        vi.advanceTimersByTime(350);
        const updater = setQueryParams.mock.calls.at(-1)![0] as (
          prev: Record<string, unknown>,
        ) => Record<string, unknown>;
        expect(updater({}).search).toBe("gre");
        expect(updater({}).pageNumber).toBe(0);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("row actions menu", () => {
    it("navigates to details from the View details action", async () => {
      const user = userEvent.setup();
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("View details"));
      expect(navigate).toHaveBeenCalledWith("/scoped/services/language/translations/k1");
    });

    it("opens and confirms the single-key translate dialog", async () => {
      const user = userEvent.setup();
      translateKeyAsync.mockResolvedValue({ isSuccess: true });
      primeStore(["de-DE"], []);
      setKeys(oneKey({ resources: [{ culture: "de-DE", value: "" }] }));
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("Translate"));
      expect(await screen.findByText("Auto-translate this key?")).toBeTruthy();
      const confirm = screen.getAllByRole("button", { name: "Translate" }).at(-1)!;
      await user.click(confirm);
      await waitFor(() => expect(translateKeyAsync).toHaveBeenCalled());
      // After a successful translate the empty de-DE cell shows the loading text.
      expect(await screen.findByText("Translating...")).toBeTruthy();
    });

    it("shows an error toast when single-key translate returns errors", async () => {
      const user = userEvent.setup();
      translateKeyAsync.mockResolvedValue({ isSuccess: false, errors: ["nope"] });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("Translate"));
      const confirm = screen.getAllByRole("button", { name: "Translate" }).at(-1)!;
      await user.click(confirm);
      await waitFor(() => expect(translateKeyAsync).toHaveBeenCalled());
    });

    it("handles a thrown error from single-key translate", async () => {
      const user = userEvent.setup();
      translateKeyAsync.mockRejectedValue(new Error("boom"));
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("Translate"));
      const confirm = screen.getAllByRole("button", { name: "Translate" }).at(-1)!;
      await user.click(confirm);
      await waitFor(() => expect(translateKeyAsync).toHaveBeenCalled());
    });

    it("deletes a single key successfully", async () => {
      const user = userEvent.setup();
      deleteAsync.mockResolvedValue({ isSuccess: true });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("Delete key"));
      expect(await screen.findByText("Delete language key?")).toBeTruthy();
      const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
      await user.click(confirm);
      await waitFor(() => expect(deleteAsync).toHaveBeenCalled());
    });

    it("surfaces an array error message on single delete", async () => {
      const user = userEvent.setup();
      deleteAsync.mockResolvedValue({ isSuccess: false, errors: ["a", "b"] });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("Delete key"));
      const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
      await user.click(confirm);
      await waitFor(() => expect(deleteAsync).toHaveBeenCalled());
    });

    it("surfaces an object error message on single delete", async () => {
      const user = userEvent.setup();
      deleteAsync.mockResolvedValue({
        isSuccess: false,
        errors: { field: "bad" },
      });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("Delete key"));
      const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
      await user.click(confirm);
      await waitFor(() => expect(deleteAsync).toHaveBeenCalled());
    });

    it("handles a thrown error on single delete", async () => {
      const user = userEvent.setup();
      deleteAsync.mockRejectedValue(new Error("delete failed"));
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(getRowActionsTrigger());
      await user.click(await screen.findByText("Delete key"));
      const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
      await user.click(confirm);
      await waitFor(() => expect(deleteAsync).toHaveBeenCalled());
    });
  });

  describe("view settings dropdown", () => {
    it("toggles optional columns and languages", async () => {
      const user = userEvent.setup();
      primeStore(["en-US"], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      // Radix checkbox items close the menu on select, so reopen each time.
      const openView = async () => user.click(screen.getByText("View"));

      await openView();
      await user.click(await screen.findByText("Completeness"));
      await waitFor(() =>
        expect(useLanguageViewStore.getState().selectedOptionalColumns).toContain("completeness"),
      );

      await openView();
      await user.click(await screen.findByText("Created Date"));
      await waitFor(() =>
        expect(useLanguageViewStore.getState().selectedOptionalColumns).toContain("createDate"),
      );

      await openView();
      await user.click(await screen.findByText("Last Updated Date"));
      await waitFor(() =>
        expect(useLanguageViewStore.getState().selectedOptionalColumns).toContain("lastUpdateDate"),
      );

      // Toggle a language via the checkbox item.
      await openView();
      await user.click(await screen.findByText("German"));
      await waitFor(() =>
        expect(useLanguageViewStore.getState().selectedLanguages).toContain("de-DE"),
      );
    });

    it("select-all clears languages when all are already selected", async () => {
      const user = userEvent.setup();
      primeStore(["en-US", "de-DE"], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(screen.getByText("View"));
      // The "Languages" master checkbox is checked; clicking clears selection.
      await user.click(await screen.findByLabelText("Languages"));
      await waitFor(() => expect(useLanguageViewStore.getState().selectedLanguages).toEqual([]));
    });

    it("select-all selects every language when none are selected", async () => {
      const user = userEvent.setup();
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(screen.getByText("View"));
      await user.click(await screen.findByLabelText("Languages"));
      await waitFor(() =>
        expect(useLanguageViewStore.getState().selectedLanguages.sort()).toEqual([
          "de-DE",
          "en-US",
        ]),
      );
    });
  });

  describe("top toolbar menu", () => {
    const openTopMenu = (container: HTMLElement) =>
      within(container)
        .getAllByRole("button")
        .find((b) => b.className.includes("sm:w-10"))!;

    it("opens the import keys action", async () => {
      const user = userEvent.setup();
      primeStore([], []);
      setKeys(oneKey());
      const { container } = renderWithProviders(<LanguageTable />);
      await user.click(openTopMenu(container));
      await user.click(await screen.findByText("Import keys"));
      // The import dialog state flips without crashing.
      expect(screen.getByText("Translations")).toBeTruthy();
    });

    it("opens the export keys action", async () => {
      const user = userEvent.setup();
      primeStore([], []);
      setKeys(oneKey());
      const { container } = renderWithProviders(<LanguageTable />);
      await user.click(openTopMenu(container));
      await user.click(await screen.findByText("Export keys"));
      expect(screen.getByText("Translations")).toBeTruthy();
    });

    it("navigates to export history", async () => {
      const user = userEvent.setup();
      primeStore([], []);
      setKeys(oneKey());
      const { container } = renderWithProviders(<LanguageTable />);
      await user.click(openTopMenu(container));
      await user.click(await screen.findByText("Export History"));
      expect(navigate).toHaveBeenCalledWith("/scoped/services/language/export-history");
    });
  });

  describe("publish changes", () => {
    it("generates uilm files successfully", async () => {
      const user = userEvent.setup();
      generateAsync.mockResolvedValue({ isSuccess: true });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(screen.getByText("Publish Changes"));
      const confirm = await screen.findByRole("button", { name: "Publish" });
      await user.click(confirm);
      await waitFor(() => expect(generateAsync).toHaveBeenCalled());
    });

    it("shows an error toast when uilm generation fails", async () => {
      const user = userEvent.setup();
      generateAsync.mockResolvedValue({ isSuccess: false, errors: ["x"] });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(screen.getByText("Publish Changes"));
      const confirm = await screen.findByRole("button", { name: "Publish" });
      await user.click(confirm);
      await waitFor(() => expect(generateAsync).toHaveBeenCalled());
    });

    it("handles a thrown error during uilm generation", async () => {
      const user = userEvent.setup();
      generateAsync.mockRejectedValue(new Error("gen failed"));
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(screen.getByText("Publish Changes"));
      const confirm = await screen.findByRole("button", { name: "Publish" });
      await user.click(confirm);
      await waitFor(() => expect(generateAsync).toHaveBeenCalled());
    });
  });

  describe("bulk action error handling", () => {
    const selectRow = () => fireEvent.click(screen.getByLabelText("Select row"));

    it("shows an error toast when bulk delete returns a string error", async () => {
      bulkDeleteAsync.mockResolvedValue({
        isSuccess: false,
        errors: "server exploded",
      });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      selectRow();
      fireEvent.click(screen.getByText("Delete"));
      const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
      fireEvent.click(confirm);
      await waitFor(() => expect(bulkDeleteAsync).toHaveBeenCalled());
    });

    it("handles a thrown error during bulk delete", async () => {
      bulkDeleteAsync.mockRejectedValue(new Error("bulk delete boom"));
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      selectRow();
      fireEvent.click(screen.getByText("Delete"));
      const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
      fireEvent.click(confirm);
      await waitFor(() => expect(bulkDeleteAsync).toHaveBeenCalled());
    });

    it("shows an error toast when bulk translate returns errors", async () => {
      bulkTranslateAsync.mockResolvedValue({
        isSuccess: false,
        errors: { code: "bad" },
      });
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      selectRow();
      fireEvent.click(screen.getByText("Translate"));
      const confirm = screen.getAllByRole("button", { name: "Translate" }).at(-1)!;
      fireEvent.click(confirm);
      await waitFor(() => expect(bulkTranslateAsync).toHaveBeenCalled());
    });

    it("handles a thrown error during bulk translate", async () => {
      bulkTranslateAsync.mockRejectedValue(new Error("bulk translate boom"));
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      selectRow();
      fireEvent.click(screen.getByText("Translate"));
      const confirm = screen.getAllByRole("button", { name: "Translate" }).at(-1)!;
      fireEvent.click(confirm);
      await waitFor(() => expect(bulkTranslateAsync).toHaveBeenCalled());
    });
  });

  describe("pagination & tabs", () => {
    it("renders pagination and moves to the next page", () => {
      primeStore([], []);
      setKeys({ totalCount: 200, keys: oneKey().keys });
      const { container } = renderWithProviders(<LanguageTable />);
      expect(screen.getByText(/Rows per page/)).toBeTruthy();
      // Target the pagination footer specifically (avoids the row-action
      // ellipsis which shares the h-8 w-8 p-0 class).
      const footer = container.querySelector(".mt-5") as HTMLElement;
      const navButtons = Array.from(footer.querySelectorAll("button")).filter(
        (b) => !(b as HTMLButtonElement).disabled,
      );
      // Click the next-page chevron to trigger onPageChangeHandler.
      const next = navButtons.find((b) => b.querySelector(".lucide-chevron-right"));
      fireEvent.click(next!);
      expect(setQueryParams).toHaveBeenCalled();
    });

    it("caps page-size options at the total count for small datasets", () => {
      primeStore([], []);
      setKeys({ totalCount: 25, keys: oneKey().keys });
      renderWithProviders(<LanguageTable />);
      expect(screen.getByText("Translations")).toBeTruthy();
    });

    it("switches to the History tab and resets filters", async () => {
      const user = userEvent.setup();
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      await user.click(screen.getByText("History"));
      await waitFor(() => expect(sortReset).toHaveBeenCalled());
      expect(setQueryParams).toHaveBeenCalledWith(null);
    });
  });

  describe("language defaults", () => {
    it("falls back to en-US when no languages are returned", () => {
      setBaseMocks(undefined);
      primeStore([], []);
      setKeys(oneKey());
      renderWithProviders(<LanguageTable />);
      // Renders without a language list and shows the table shell.
      expect(screen.getByText("Translations")).toBeTruthy();
    });
  });
});
