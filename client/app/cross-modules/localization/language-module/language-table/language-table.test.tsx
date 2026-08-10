import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { useLanguageViewStore } from "@blocks-localization/store/use-language-view-store";
import { LanguageTable } from "./language-table";

const navigate = vi.fn();
const setQueryParams = vi.fn();
const setSortQueryParams = vi.fn();

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
    queryParams: {
      pageNumber: 0,
      pageSize: 10,
      search: "",
      moduleIds: [],
      missingLanguages: [],
      resourceSearch: "",
    },
    setQueryParams,
  }),
  useKeysSortQueryParams: () => ({
    sortQueryParams: { property: "KeyName", isDescending: false },
    setSortQueryParams,
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
  useGetGlossaries: vi.fn(),
  useGetModuleGlossaries: vi.fn(),
  useSearchGlossaries: vi.fn(),
  useSaveBlocksLanguageKeys: vi.fn(),
}));

const h = vi.mocked(hooks);

const mutationStub = { isPending: false, mutateAsync: vi.fn() };
const bulkDeleteAsync = vi.fn();
const bulkTranslateAsync = vi.fn();
const bulkSaveAsync = vi.fn();

const setBaseMocks = () => {
  h.useGetLanguageModules.mockReturnValue({
    data: [{ itemId: "m1", moduleName: "UILM" }],
    isLoading: false,
  } as never);
  h.useGetLanguages.mockReturnValue({
    data: [
      { languageCode: "en-US", languageName: "English", isDefault: true },
      { languageCode: "de-DE", languageName: "German", isDefault: false },
    ],
  } as never);
  h.useDeleteLanguageKey.mockReturnValue(mutationStub as never);
  h.useDeleteLanguageKeys.mockReturnValue({
    isPending: false,
    mutateAsync: bulkDeleteAsync,
  } as never);
  h.useGenerateUilmFile.mockReturnValue(mutationStub as never);
  h.useTranslateKey.mockReturnValue(mutationStub as never);
  h.useTranslateLanguageKeys.mockReturnValue({
    isPending: false,
    mutateAsync: bulkTranslateAsync,
  } as never);
  h.useTranslateKeyWithPolling.mockReturnValue(undefined as never);
  h.useGetGlossaries.mockReturnValue({ data: { items: [] }, isLoading: false } as never);
  h.useGetModuleGlossaries.mockReturnValue({ data: { items: [] }, isLoading: false } as never);
  h.useSearchGlossaries.mockReturnValue({ data: { items: [] } } as never);
  h.useSaveBlocksLanguageKeys.mockReturnValue({
    isPending: false,
    mutateAsync: bulkSaveAsync,
  } as never);
};

describe("language-module/language-table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setBaseMocks();
  });

  it("should render skeleton rows while loading", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: true,
      data: undefined,
    } as never);
    const { container } = renderWithProviders(<LanguageTable />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("should render an empty state when there are no keys", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, keys: [] },
    } as never);
    renderWithProviders(<LanguageTable />);
    expect(screen.getByText("No results.")).toBeTruthy();
  });

  it("should render a New Key action", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, keys: [] },
    } as never);
    renderWithProviders(<LanguageTable />);
    expect(screen.getByText("New Key")).toBeTruthy();
  });

  const oneKey = {
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
        createDate: "2026-01-01",
        lastUpdateDate: "2026-01-02",
        context: "",
      },
    ],
  };

  it("should render key rows with their names", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    const { container } = renderWithProviders(<LanguageTable />);
    const keyName = within(container).getByText("greeting");
    expect(keyName).toBeTruthy();
    expect(keyName.className).toContain("w-full");
    expect(keyName.className).not.toContain("w-[150px]");
    expect(keyName.className).not.toContain("md:w-[200px]");
  });

  it("should preserve the rendered table dimensions when filter loading starts", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    const { container, rerender } = renderWithProviders(<LanguageTable />);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(container.querySelector("table")?.className).toContain("table-fixed");
    expect(container.querySelectorAll("colgroup col").length).toBeGreaterThan(0);
    const tableViewport = container.querySelector("table")?.parentElement?.parentElement;
    expect(tableViewport?.style.minHeight).toBe("520px");

    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: true,
      data: undefined,
    } as never);
    rerender(<LanguageTable />);

    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    const skeletons = Array.from(container.querySelectorAll("tbody .animate-pulse"));
    expect(skeletons.some((skeleton) => skeleton.className.includes("w-[150px]"))).toBe(true);
    expect(skeletons.every((skeleton) => !skeleton.className.includes("w-full"))).toBe(true);
    expect(tableViewport?.style.minHeight).toBe("520px");
    expect(
      container.querySelector('[aria-hidden="true"].invisible.pointer-events-none')?.textContent,
    ).toContain("Page 1 of 1");
  });

  it("should navigate to the new-key page", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, keys: [] },
    } as never);
    renderWithProviders(<LanguageTable />);
    fireEvent.click(screen.getByText("New Key"));
    expect(navigate).toHaveBeenCalledWith("/scoped/services/language/translations/new-key");
  });

  it("should render a language column value when a language is selected", () => {
    useLanguageViewStore.setState({ selectedLanguages: ["en-US"] });
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    renderWithProviders(<LanguageTable />);
    // The en-US resource value renders in its language column.
    expect(screen.getByText("Hello")).toBeTruthy();
    useLanguageViewStore.setState({ selectedLanguages: [] });
  });

  it("should navigate to key details on row click", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    renderWithProviders(<LanguageTable />);
    fireEvent.click(screen.getByText("greeting"));
    expect(navigate).toHaveBeenCalledWith("/scoped/services/language/translations/k1");
  });

  it("should show the bulk action bar when a row is selected", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    renderWithProviders(<LanguageTable />);
    fireEvent.click(screen.getByLabelText("Select row"));
    expect(screen.getByText("1 key selected")).toBeTruthy();
  });

  it("should open bulk edit for selected keys", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    renderWithProviders(<LanguageTable />);
    fireEvent.click(screen.getByLabelText("Select row"));
    fireEvent.click(screen.getByRole("button", { name: "Bulk edit" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Bulk edit 1 key")).toBeTruthy();
  });

  it("should open the auto-translate dialog", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: { totalCount: 0, keys: [] },
    } as never);
    renderWithProviders(<LanguageTable />);
    // Clicking Auto-translate all toggles dialog state without crashing.
    fireEvent.click(screen.getByText("Auto-translate all"));
    expect(screen.getByText("Translations")).toBeTruthy();
  });

  it("should bulk-delete selected keys through the confirmation dialog", async () => {
    bulkDeleteAsync.mockResolvedValue({ isSuccess: true });
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    renderWithProviders(<LanguageTable />);
    fireEvent.click(screen.getByLabelText("Select row"));
    // Open the bulk delete dialog from the selection bar.
    fireEvent.click(screen.getByText("Delete"));
    expect(screen.getByText("Delete language keys?")).toBeTruthy();
    // Confirm inside the dialog (the last "Delete" button).
    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);
    await waitFor(() => expect(bulkDeleteAsync).toHaveBeenCalled());
  });

  it("should bulk-translate selected keys through the confirmation dialog", async () => {
    bulkTranslateAsync.mockResolvedValue({ isSuccess: true });
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    renderWithProviders(<LanguageTable />);
    fireEvent.click(screen.getByLabelText("Select row"));
    fireEvent.click(screen.getByText("Translate"));
    expect(screen.getByText("Auto-translate selected keys?")).toBeTruthy();
    const translateButtons = screen.getAllByRole("button", { name: "Translate" });
    fireEvent.click(translateButtons[translateButtons.length - 1]);
    await waitFor(() => expect(bulkTranslateAsync).toHaveBeenCalled());
  });

  it("should clear the selection", () => {
    h.useGetBlocksLanguageKey.mockReturnValue({
      isLoading: false,
      data: oneKey,
    } as never);
    renderWithProviders(<LanguageTable />);
    fireEvent.click(screen.getByLabelText("Select row"));
    expect(screen.getByText("1 key selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(screen.queryByText("1 key selected")).toBeNull();
  });
});
