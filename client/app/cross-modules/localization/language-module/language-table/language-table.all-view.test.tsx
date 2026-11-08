import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { useLanguageImportProgress } from "./hooks/use-language-import-progress";
import { LanguageTable } from "./language-table";

const setQueryParams = vi.fn();
const toast = vi.hoisted(() => vi.fn());

let glossaryIssuesFilter = false;
let duplicatesFilter = false;

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@seliseblocks/genesis-os", async () => ({
  ...(await import("@/test-utils/i18n-mock")).i18nMock,
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-utilities/notification", () => ({ useNotificationListener: vi.fn() }));
vi.mock("@/hooks/use-toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/use-toast")>()),
  toast,
}));
vi.mock("./hooks/use-language-import-progress", () => ({
  getImportFileLabel: (fileNames: string[]) => fileNames[0] ?? "Your file",
  useLanguageImportProgress: vi.fn(),
}));
vi.mock("@blocks-localization/components/language-table-toolbar/language-table-toolbar", () => ({
  LanguageTableToolbar: () => null,
  useKeysFilterQueryParams: () => ({
    queryParams: {
      pageNumber: 0,
      pageSize: "all",
      search: "",
      moduleIds: [],
      missingLanguages: [],
      resourceSearch: "",
      glossaryIssues: glossaryIssuesFilter,
      duplicates: duplicatesFilter,
    },
    setQueryParams,
  }),
  useKeysSortQueryParams: () => ({
    sortQueryParams: { property: "KeyName", isDescending: false },
    setSortQueryParams: vi.fn(),
    reset: vi.fn(),
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
vi.mock("../localization-timeline/localization-timeline", () => ({ default: () => null }));
vi.mock("@blocks-localization/hooks/use-language-manager", async (importOriginal) => ({
  // Pure: the bulk "all matching" payload must carry the same filter the query sends.
  buildKeyListFilter: (await importOriginal<typeof import("@blocks-localization/hooks/use-language-manager")>())
    .buildKeyListFilter,
  useGetBlocksLanguageKey: vi.fn(),
  useGetBlocksLanguageKeysInfinite: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useGetLanguages: vi.fn(),
  useDeleteLanguageKey: vi.fn(),
  useDeleteLanguageKeys: vi.fn(),
  useGenerateUilmFile: vi.fn(),
  useTranslateKey: vi.fn(),
  useTranslateKeyWithPolling: vi.fn(),
  useTranslateLanguageKeys: vi.fn(),
  useSaveBlocksLanguageKeys: vi.fn(),
  useGetDuplicateSummary: vi.fn(() => ({ data: undefined, isError: false })),
  useGetGlossaryIssueCount: vi.fn(() => ({ data: undefined })),
  useEnforceUniqueness: vi.fn(() => ({ mutate: vi.fn() })),
}));

const h = vi.mocked(hooks);
const mutationStub = { isPending: false, mutateAsync: vi.fn() };

const keys = (count: number, start = 0) =>
  Array.from({ length: count }, (_, offset) => start + offset).map((index) => ({
    itemId: `k${index}`,
    keyName: `key_${index}`,
    moduleId: "m1",
    resources: [],
    isPartiallyTranslated: false,
    lastUpdateDate: "2026-01-01T00:00:00Z",
    createDate: "2026-01-01T00:00:00Z",
    context: "",
  }));

const fetchNextPage = vi.fn();
const refetch = vi.fn();

const setAllView = (
  rowCount: number,
  overrides: Partial<Record<string, unknown>> = {},
  totalCount = 12345,
) => {
  h.useGetBlocksLanguageKeysInfinite.mockReturnValue({
    data: {
      pages: [{ totalCount, keys: keys(rowCount), hasMore: true, nextCursor: "c1" }],
      pageParams: [null],
    },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    hasNextPage: true,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    fetchNextPage,
    refetch,
    ...overrides,
  } as never);
};

// The rows from `start` on, as after the chunks before them were evicted.
const setAllViewWindow = (start: number, count: number) =>
  setAllView(count, {
    data: {
      pages: [{ totalCount: 12345, keys: keys(count, start), hasMore: true, nextCursor: "c2" }],
      pageParams: ["c1"],
    },
  });

const selectedLabel = (count: number) =>
  `${count.toLocaleString()} of ${(12345).toLocaleString()} keys selected`;

// jsdom has no layout. The virtualizer sizes its window from offsetHeight: give the viewport
// room for ~10 rows and every row a fixed height.
const VIEWPORT_HEIGHT = 440;
const ROW_HEIGHT = 44;
const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const offsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return this.dataset?.testid === "language-table-viewport" ? VIEWPORT_HEIGHT : ROW_HEIGHT;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get: () => 1200,
  });
});

afterAll(() => {
  if (offsetHeight) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offsetHeight);
  if (offsetWidth) Object.defineProperty(HTMLElement.prototype, "offsetWidth", offsetWidth);
});

// The virtual rows are lazy-loaded; wait for the first key before asserting on them.
const renderAllView = async () => {
  const result = renderWithProviders(<LanguageTable />);
  await screen.findByText("key_0");
  return result;
};

describe("language-table All view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useLanguageImportProgress).mockReturnValue({
      progress: null,
      isSyncingModules: false,
      onImportStarted: vi.fn(),
      onImportRequestFailed: vi.fn(),
    });
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: undefined,
      refetch: vi.fn(),
    } as never);
    h.useGetLanguageModules.mockReturnValue({
      data: [{ itemId: "m1", moduleName: "UILM" }],
      isLoading: false,
    } as never);
    h.useGetLanguages.mockReturnValue({
      data: [{ languageCode: "en-US", languageName: "English", isDefault: true }],
    } as never);
    h.useDeleteLanguageKey.mockReturnValue(mutationStub as never);
    h.useDeleteLanguageKeys.mockReturnValue(mutationStub as never);
    h.useGenerateUilmFile.mockReturnValue(mutationStub as never);
    h.useTranslateKey.mockReturnValue(mutationStub as never);
    h.useTranslateLanguageKeys.mockReturnValue(mutationStub as never);
    h.useTranslateKeyWithPolling.mockReturnValue(undefined as never);
    h.useSaveBlocksLanguageKeys.mockReturnValue(mutationStub as never);
  });

  it("disables the paged query and enables the chunked one", () => {
    setAllView(300);
    renderWithProviders(<LanguageTable />);

    expect(h.useGetBlocksLanguageKey.mock.lastCall?.[11]).toBe(false);
    expect(h.useGetBlocksLanguageKeysInfinite.mock.lastCall?.[0].enabled).toBe(true);
    expect(h.useGetBlocksLanguageKeysInfinite.mock.lastCall?.[0].hasGlossaryViolations).toBe(false);
  });

  it("passes the Glossary issues filter to the chunked query (H11)", () => {
    glossaryIssuesFilter = true;
    setAllView(0);
    try {
      renderWithProviders(<LanguageTable />);
      expect(h.useGetBlocksLanguageKeysInfinite.mock.lastCall?.[0].hasGlossaryViolations).toBe(
        true,
      );
    } finally {
      glossaryIssuesFilter = false;
    }
  });

  it("renders only a window of the loaded rows", async () => {
    setAllView(300);
    const { container } = await renderAllView();

    const visibleRows = Math.ceil(VIEWPORT_HEIGHT / ROW_HEIGHT);
    const renderedRows = container.querySelectorAll("tbody tr");
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThanOrEqual(visibleRows + 2 * 10 + 3);
    expect(screen.getByText("key_0")).toBeTruthy();
    expect(screen.queryByText("key_299")).toBeNull();
  });

  it("shows loaded-of-total in the footer instead of page navigation", () => {
    setAllView(300);
    renderWithProviders(<LanguageTable />);

    const status = screen.getByText(/^Showing/);
    expect(status.textContent).toBe(
      `Showing ${(300).toLocaleString()} of ${(12345).toLocaleString()} keys`,
    );
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(screen.queryByLabelText("Go to next page")).toBeNull();
  });

  it("labels the header checkbox as selecting the loaded rows", () => {
    setAllView(300);
    renderWithProviders(<LanguageTable />);

    const selectAll = screen.getByLabelText("Select all loaded (300)");
    expect(selectAll.getAttribute("title")).toBe("Select all loaded (300)");
  });

  it("keeps select-all covering the rows of chunks loaded after it", async () => {
    setAllView(100);
    const { rerender } = await renderAllView();

    fireEvent.click(screen.getByLabelText("Select all loaded (100)"));
    expect(screen.getByText(`100 of ${(12345).toLocaleString()} keys selected`)).toBeTruthy();

    setAllView(200);
    rerender(<LanguageTable />);

    expect(
      await screen.findByText(`200 of ${(12345).toLocaleString()} keys selected`),
    ).toBeTruthy();
  });

  it("stops selecting later chunks once a row is unticked", async () => {
    setAllView(100);
    const { rerender } = await renderAllView();

    fireEvent.click(screen.getByLabelText("Select all loaded (100)"));
    fireEvent.click(screen.getAllByLabelText("Select row")[0]);
    expect(screen.getByText(`99 of ${(12345).toLocaleString()} keys selected`)).toBeTruthy();

    setAllView(200);
    rerender(<LanguageTable />);

    expect(await screen.findByText(`99 of ${(12345).toLocaleString()} keys selected`)).toBeTruthy();
  });

  // Each test selects and re-renders a few hundred rows, which is slow on a busy runner.
  describe("selection of evicted keys (SPEC13)", { timeout: 30_000 }, () => {
    const bulkDeleteAsync = vi.fn();
    const bulkTranslateAsync = vi.fn();

    beforeEach(() => {
      h.useDeleteLanguageKeys.mockReturnValue({
        isPending: false,
        mutateAsync: bulkDeleteAsync,
      } as never);
      h.useTranslateLanguageKeys.mockReturnValue({
        isPending: false,
        mutateAsync: bulkTranslateAsync,
      } as never);
    });

    // Select all of k0–k99, follow to k199, then evict k0–k99: the window is k100–k299.
    const selectAllThenEvict = async () => {
      setAllView(100);
      const result = await renderAllView();
      fireEvent.click(screen.getByLabelText("Select all loaded (100)"));
      setAllView(200);
      result.rerender(<LanguageTable />);
      await screen.findByText(selectedLabel(200));
      setAllViewWindow(100, 200);
      result.rerender(<LanguageTable />);
      await screen.findByText("key_100");
      return result;
    };

    const confirmIn = (dialogTitle: string, confirmName: string) => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText(dialogTitle)).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: confirmName }));
    };

    it("counts evicted keys once each while select-all keeps following (H1, H9)", async () => {
      await selectAllThenEvict();

      expect(await screen.findByText(selectedLabel(300))).toBeTruthy();
    });

    it("deletes every selected key, evicted ones included, and clears them (H2, H4, H10)", async () => {
      bulkDeleteAsync.mockResolvedValue({ isSuccess: true });
      await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      expect(
        screen.getByText("Are you sure you want to delete 300 selected language keys?"),
      ).toBeTruthy();
      confirmIn("Delete language keys?", "Delete");

      await waitFor(() => expect(bulkDeleteAsync).toHaveBeenCalledTimes(1));
      const { itemIds } = bulkDeleteAsync.mock.lastCall?.[0] as { itemIds: string[] };
      expect(itemIds).toHaveLength(300);
      expect(new Set(itemIds)).toEqual(new Set(keys(300).map((key) => key.itemId)));
      await waitFor(() => expect(screen.queryByText(/keys selected/)).toBeNull());
    });

    it("keeps the selection when the bulk delete fails (C7, C8)", async () => {
      bulkDeleteAsync.mockResolvedValue({ isSuccess: false, errors: { k0: "Key not found" } });
      await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      confirmIn("Delete language keys?", "Delete");

      await waitFor(() => expect(bulkDeleteAsync).toHaveBeenCalledTimes(1));
      expect(screen.getByText(selectedLabel(300))).toBeTruthy();
    });

    it("translates every selected key, evicted ones included (H3, H5, H10)", async () => {
      bulkTranslateAsync.mockResolvedValue({ isSuccess: true });
      await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      fireEvent.click(screen.getByRole("button", { name: "Translate" }));
      expect(
        screen.getByText(
          "Are you sure you want to automatically translate 300 selected language keys?",
        ),
      ).toBeTruthy();
      confirmIn("Auto-translate selected keys?", "Translate");

      await waitFor(() => expect(bulkTranslateAsync).toHaveBeenCalledTimes(1));
      const { keyIds } = bulkTranslateAsync.mock.lastCall?.[0] as { keyIds: string[] };
      expect(keyIds).toHaveLength(300);
      expect(keyIds).toContain("k0");
      await waitFor(() => expect(screen.queryByText(/keys selected/)).toBeNull());
    });

    it("removes only an unticked loaded key from the count (H8)", async () => {
      await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      fireEvent.click(screen.getAllByLabelText("Select row")[0]);

      expect(screen.getByText(selectedLabel(299))).toBeTruthy();
    });

    it("disables Bulk edit with a reason while some selected keys are evicted (C1, C2)", async () => {
      await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      const bulkEdit = screen.getByRole("button", { name: "Bulk edit" }) as HTMLButtonElement;
      expect(bulkEdit.disabled).toBe(true);
      const trigger = bulkEdit.parentElement?.querySelector<HTMLButtonElement>(
        'button[aria-disabled="true"]',
      );
      expect(trigger?.tabIndex).toBe(0);
      const reason = document.getElementById(trigger?.getAttribute("aria-describedby") ?? "");
      expect(reason?.textContent).toBe(
          'Bulk edit works on loaded keys only. Use "Back to top" to reload them, or select fewer keys.',
      );

      fireEvent.focus(trigger!);
      expect((await screen.findByRole("tooltip")).textContent).toContain("Bulk edit works on loaded keys only.");

      fireEvent.click(bulkEdit);
      fireEvent.keyDown(trigger!, { key: "Enter" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect((screen.getByRole("button", { name: "Translate" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    it("keeps Bulk edit enabled while every selected key is loaded (H6)", async () => {
      setAllView(100);
      await renderAllView();
      fireEvent.click(screen.getAllByLabelText("Select row")[0]);

      const bulkEdit = screen.getByRole("button", { name: "Bulk edit" }) as HTMLButtonElement;
      expect(bulkEdit.disabled).toBe(false);
      expect(bulkEdit.parentElement?.getAttribute("aria-describedby")).toBeNull();
    });

    it("shows reloaded keys as ticked after Back to top (H7, C12)", async () => {
      const { rerender } = await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      setAllView(100);
      rerender(<LanguageTable />);
      await screen.findByText("key_0");

      expect(screen.getByText(selectedLabel(300))).toBeTruthy();
      const rowCheckboxes = screen.getAllByLabelText("Select row");
      expect(rowCheckboxes.every((box) => box.getAttribute("data-state") === "checked")).toBe(true);
    });

    it("keeps the selection when a chunk fails to load (C11)", async () => {
      const { rerender } = await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      setAllView(200, {
        data: {
          pages: [{ totalCount: 12345, keys: keys(200, 100), hasMore: true, nextCursor: "c2" }],
          pageParams: ["c1"],
        },
        isFetchNextPageError: true,
        isError: true,
      });
      rerender(<LanguageTable />);

      expect(await screen.findByText(selectedLabel(300))).toBeTruthy();
    });

    it("clears evicted keys too on Clear selection (H11, C9)", async () => {
      await selectAllThenEvict();
      await screen.findByText(selectedLabel(300));

      fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));

      expect(screen.queryByText(/keys selected/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Bulk edit" })).toBeNull();
    });

    it("clears the selection when the filters change (C5)", async () => {
      setAllView(100);
      const { rerender } = await renderAllView();
      fireEvent.click(screen.getAllByLabelText("Select row")[0]);
      expect(screen.getByText(selectedLabel(1))).toBeTruthy();

      glossaryIssuesFilter = true;
      try {
        rerender(<LanguageTable />);
        await waitFor(() => expect(screen.queryByText(/keys? selected/)).toBeNull());
      } finally {
        glossaryIssuesFilter = false;
      }
    });

    it("clears selected IDs when the Duplicates filter changes", async () => {
      setAllView(100);
      const { rerender } = await renderAllView();
      fireEvent.click(screen.getAllByLabelText("Select row")[0]);
      expect(screen.getByText(selectedLabel(1))).toBeTruthy();

      duplicatesFilter = true;
      try {
        rerender(<LanguageTable />);
        await waitFor(() => expect(screen.queryByText(/keys? selected/)).toBeNull());
      } finally {
        duplicatesFilter = false;
      }
    });

    it("allows bulk Translate and Delete for up to 10,000 keys (C3, C4)", async () => {
      setAllView(10_001, {}, 20_000);
      const { rerender } = renderWithProviders(<LanguageTable />);
      await screen.findByText("key_0");
      fireEvent.click(screen.getByLabelText(/^Select all loaded/));
      const limit = "Select up to 10,000 keys for bulk actions.";

      const translate = screen.getByRole("button", { name: "Translate" }) as HTMLButtonElement;
      expect(translate.disabled).toBe(true);
      expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      expect(screen.getAllByText(limit)).toHaveLength(2);

      fireEvent.click(screen.getAllByLabelText("Select row")[0]);
      rerender(<LanguageTable />);

      expect((screen.getByRole("button", { name: "Translate" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
      expect(screen.queryByText(limit)).toBeNull();
    });
  });

  describe("select all matching (SPEC14)", { timeout: 30_000 }, () => {
    const bulkDeleteAsync = vi.fn();
    const bulkTranslateAsync = vi.fn();
    const MATCHING = 935;
    const linkName = `Select all ${MATCHING} keys matching these filters`;
    const modeText = `All ${MATCHING} keys matching these filters are selected.`;

    const setMutations = (isPending = false) => {
      h.useDeleteLanguageKeys.mockReturnValue({ isPending, mutateAsync: bulkDeleteAsync } as never);
      h.useTranslateLanguageKeys.mockReturnValue({
        isPending,
        mutateAsync: bulkTranslateAsync,
      } as never);
    };

    beforeEach(() => setMutations());

    const selectAllLoaded = async (totalCount = MATCHING) => {
      setAllView(100, {}, totalCount);
      const result = await renderAllView();
      fireEvent.click(screen.getByLabelText("Select all loaded (100)"));
      return result;
    };

    const selectAllMatching = async () => {
      const result = await selectAllLoaded();
      fireEvent.click(screen.getByRole("button", { name: linkName }));
      return result;
    };

    // The count is split by <strong> in all-matching mode, so match the whole live region.
    const barText = () =>
      screen.getByText(
        (_, element) =>
          element?.tagName === "SPAN" &&
          element.getAttribute("aria-live") === "polite" &&
          /selected/.test(element.textContent ?? ""),
      );

    it("offers to select every matching key once all loaded rows are selected (H1)", async () => {
      setAllView(100, {}, MATCHING);
      await renderAllView();
      fireEvent.click(screen.getAllByLabelText("Select row")[0]);
      expect(screen.queryByRole("button", { name: linkName })).toBeNull();

      fireEvent.click(screen.getByLabelText("Select all loaded (100)"));

      expect(screen.getByRole("button", { name: linkName })).toBeTruthy();
    });

    it("switches to all-matching mode with the count in bold (H2)", async () => {
      await selectAllMatching();

      expect(barText().textContent).toBe(modeText);
      expect(barText().querySelector("strong")?.textContent).toBe(
        `${MATCHING} keys matching these filters`,
      );
      expect(barText().getAttribute("aria-live")).toBe("polite");
      expect(screen.queryByRole("button", { name: linkName })).toBeNull();
    });

    it("counts unticked rows as exclusions and re-ticked ones back in (H3, H4)", async () => {
      await selectAllMatching();
      fireEvent.click(screen.getAllByLabelText("Select row")[0]);
      fireEvent.click(screen.getAllByLabelText("Select row")[1]);
      expect(barText().textContent).toBe(`All ${MATCHING - 2} keys matching these filters are selected.`);

      fireEvent.click(screen.getAllByLabelText("Select row")[0]);
      expect(barText().textContent).toBe(`All ${MATCHING - 1} keys matching these filters are selected.`);
    });

    it("ticks rows of later chunks unless they were excluded", async () => {
      const { rerender } = await selectAllMatching();
      fireEvent.click(screen.getAllByLabelText("Select row")[0]);

      setAllView(200, {}, MATCHING);
      rerender(<LanguageTable />);

      expect(barText().textContent).toBe(`All ${MATCHING - 1} keys matching these filters are selected.`);
      await waitFor(() =>
        expect(screen.getAllByLabelText("Select row")[0].getAttribute("data-state")).toBe(
          "unchecked",
        ),
      );
      expect(screen.getAllByLabelText("Select row")[1].getAttribute("data-state")).toBe("checked");
    });

    it("deletes by filter with the exclusions and expected count, and no IDs (H5, H9, H12)", async () => {
      bulkDeleteAsync.mockResolvedValue({ isSuccess: true, matchedCount: MATCHING - 1 });
      await selectAllMatching();
      fireEvent.click(screen.getAllByLabelText("Select row")[0]);

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText(
          `Are you sure you want to delete ${MATCHING - 1} language keys matching the current filters?`,
        ),
      ).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(bulkDeleteAsync).toHaveBeenCalledTimes(1));
      const payload = bulkDeleteAsync.mock.lastCall?.[0];
      expect(payload).not.toHaveProperty("itemIds");
      expect(payload).toEqual({
        filter: expect.objectContaining({
          searchKey: "",
          moduleIds: [],
          sortProperty: "KeyName",
          isDescending: false,
          isPartiallyTranslated: false,
        }),
        excludedItemIds: ["k0"],
        expectedCount: MATCHING - 1,
      });
      await waitFor(() => expect(screen.queryByText(/selected/)).toBeNull());
    });

    it("translates by filter with the exclusions and expected count (H5, H12)", async () => {
      bulkTranslateAsync.mockResolvedValue({ isSuccess: true, matchedCount: MATCHING });
      await selectAllMatching();

      fireEvent.click(screen.getByRole("button", { name: "Translate" }));
      const dialog = screen.getByRole("dialog");
      expect(
        within(dialog).getByText(
          `Are you sure you want to automatically translate ${MATCHING} language keys matching the current filters?`,
        ),
      ).toBeTruthy();
      fireEvent.click(within(dialog).getByRole("button", { name: "Translate" }));

      await waitFor(() => expect(bulkTranslateAsync).toHaveBeenCalledTimes(1));
      const payload = bulkTranslateAsync.mock.lastCall?.[0];
      expect(payload).not.toHaveProperty("keyIds");
      expect(payload).toMatchObject({
        excludedKeyIds: [],
        expectedCount: MATCHING,
        ProjectKey: "t1",
        defaultLanguage: "en-US",
        filter: expect.objectContaining({ sortProperty: "KeyName" }),
      });
    });

    it("returns to the loaded rows with Select loaded keys only (H10)", async () => {
      await selectAllMatching();

      fireEvent.click(screen.getByRole("button", { name: "Select loaded keys only" }));

      expect(barText().textContent).toBe(`100 of ${MATCHING} keys selected`);
      expect(screen.getByRole("button", { name: linkName })).toBeTruthy();
    });

    it("disables Bulk edit with a reason while all matching keys are selected (C11)", async () => {
      await selectAllMatching();

      const bulkEdit = screen.getByRole("button", { name: "Bulk edit" }) as HTMLButtonElement;
      expect(bulkEdit.disabled).toBe(true);
      const reasonId = bulkEdit.parentElement
        ?.querySelector('button[aria-disabled="true"]')
        ?.getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(reasonId)?.textContent).toBe(
        "Bulk edit works on loaded keys only.",
      );
    });

    it("shows the over-cap note instead of the link above 10,000 matches (C9)", async () => {
      await selectAllLoaded(12_345);

      expect(screen.queryByRole("button", { name: /^Select all .* matching/ })).toBeNull();
      expect(
        screen.getByText("More than 10,000 keys match. Narrow the filters to act on all of them."),
      ).toBeTruthy();
    });

    it("offers no link while the total is unknown (C10)", async () => {
      setAllView(100, {
        data: {
          pages: [{ totalCount: null, keys: keys(100), hasMore: true, nextCursor: "c1" }],
          pageParams: [null],
        },
      });
      await renderAllView();
      fireEvent.click(screen.getByLabelText("Select all loaded (100)"));

      expect(screen.queryByRole("button", { name: /^Select all .* matching/ })).toBeNull();
    });

    it("leaves the mode and clears the selection when the filters change (C12)", async () => {
      const { rerender } = await selectAllMatching();

      glossaryIssuesFilter = true;
      try {
        rerender(<LanguageTable />);
        await waitFor(() => expect(screen.queryByText(/selected/)).toBeNull());
      } finally {
        glossaryIssuesFilter = false;
      }
    });

    it("leaves the mode and clears the selection when the header checkbox is unticked", async () => {
      await selectAllMatching();

      fireEvent.click(screen.getByLabelText("Select all loaded (100)"));

      expect(screen.queryByText(/selected/)).toBeNull();
      expect(screen.getAllByLabelText("Select row")[0].getAttribute("data-state")).toBe("unchecked");
    });

    it("says the keys changed, leaves the mode and doesn't retry on KEY_SET_CHANGED (C13)", async () => {
      bulkDeleteAsync.mockRejectedValue(
        Object.assign(new Error("conflict"), {
          status: 409,
          errors: { Target: "KEY_SET_CHANGED", MatchedCount: "936" },
        }),
      );
      await selectAllMatching();

      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description:
              "The keys matching your filters changed (now 936). Review the selection and try again.",
          }),
        ),
      );
      expect(bulkDeleteAsync).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByText(modeText)).toBeNull());
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("shows the over-cap text on TOO_MANY_KEYS", async () => {
      bulkTranslateAsync.mockRejectedValue(
        Object.assign(new Error("too many"), { errors: { Target: "TOO_MANY_KEYS" } }),
      );
      await selectAllMatching();

      fireEvent.click(screen.getByRole("button", { name: "Translate" }));
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Translate" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "More than 10,000 keys match. Narrow the filters to act on all of them.",
          }),
        ),
      );
    });

    it("disables the link and the actions while a bulk request is in flight (C14)", async () => {
      setMutations(true);
      await selectAllLoaded();

      expect((screen.getByRole("button", { name: linkName }) as HTMLButtonElement).disabled).toBe(
        true,
      );
      for (const name of ["Bulk edit", "Translate", "Delete"]) {
        expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
      }
    });
  });

  it("exposes the full row count to assistive tech", async () => {
    setAllView(300);
    const { container } = await renderAllView();

    const rowCount = Number(container.querySelector("table")?.getAttribute("aria-rowcount"));
    expect(rowCount).toBeGreaterThanOrEqual(12345);
    expect(container.querySelector("tbody tr[aria-rowindex]")).toBeTruthy();
  });

  it("asks for the next chunk once the visible rows near the end of the loaded ones", async () => {
    setAllView(15);
    await renderAllView();

    await waitFor(() => expect(fetchNextPage).toHaveBeenCalled());
  });

  it("does not ask for more while the visible rows are far from the end", async () => {
    setAllView(300);
    await renderAllView();

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("shows a loading row while the next chunk is fetched", async () => {
    setAllView(15, { isFetchingNextPage: true });
    await renderAllView();

    expect(screen.getByText("Loading more keys…")).toBeTruthy();
  });

  it("keeps the loaded rows and offers Retry when a chunk fails", async () => {
    setAllView(15, { isFetchNextPageError: true, isError: true });
    await renderAllView();

    expect(screen.getByText("key_0")).toBeTruthy();
    expect(screen.getByText("Couldn't load more keys.")).toBeTruthy();
    expect(fetchNextPage).not.toHaveBeenCalled();
    screen.getByRole("button", { name: "Retry" }).click();
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it("restarts from the first chunk once when the server rejects the cursor", () => {
    const resetQueries = vi.spyOn(QueryClient.prototype, "resetQueries");
    setAllView(15, {
      isFetchNextPageError: true,
      isError: true,
      error: { status: 400, errors: { Cursor: "CURSOR_MISMATCH" } },
    });
    const { rerender } = renderWithProviders(<LanguageTable />);
    rerender(<LanguageTable />);

    expect(resetQueries).toHaveBeenCalledTimes(1);
    expect(resetQueries).toHaveBeenCalledWith({ queryKey: ["get-blocksLanguageKeys", "infinite"] });
    resetQueries.mockRestore();
  });

  it("offers Back to top once the oldest chunk has been evicted", async () => {
    setAllView(15, {
      data: {
        pages: [{ totalCount: 12345, keys: keys(15), hasMore: true, nextCursor: "c51" }],
        pageParams: ["c50"],
      },
    });
    await renderAllView();

    expect(screen.getByRole("button", { name: "Back to top" })).toBeTruthy();
  });

  it("shows twenty skeleton rows while the first chunk loads", () => {
    setAllView(0, { data: undefined, isLoading: true });
    const { container } = renderWithProviders(<LanguageTable />);

    expect(container.querySelectorAll("tbody tr")).toHaveLength(20);
  });

  it("shows the empty state and no footer when nothing matches", () => {
    setAllView(0, { hasNextPage: false }, 0);
    renderWithProviders(<LanguageTable />);

    expect(screen.getByText("No translation keys yet")).toBeTruthy();
    expect(screen.queryByText(/^Showing/)).toBeNull();
  });
});
