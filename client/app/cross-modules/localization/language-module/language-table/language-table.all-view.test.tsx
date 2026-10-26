import { screen, waitFor } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { useLanguageImportProgress } from "./hooks/use-language-import-progress";
import { LanguageTable } from "./language-table";

const setQueryParams = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-utilities/notification", () => ({ useNotificationListener: vi.fn() }));
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
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
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
  useEnforceUniqueness: vi.fn(() => ({ mutate: vi.fn() })),
}));

const h = vi.mocked(hooks);
const mutationStub = { isPending: false, mutateAsync: vi.fn() };

const keys = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
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
    expect(h.useGetBlocksLanguageKeysInfinite.mock.lastCall?.[8]).toBe(true);
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
