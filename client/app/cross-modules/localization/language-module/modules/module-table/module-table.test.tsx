import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { useGetLanguageModules } from "@blocks-localization/hooks/use-language-manager";
import { useCurrentUser } from "@blocks-localization/hooks/use-user-lookup";
import { userLookupService } from "@blocks-localization/services/user-lookup.service";
import { ModuleTable } from "./module-table";

const navigate = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguageModules: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-user-lookup", () => ({
  useCurrentUser: vi.fn(),
}));
vi.mock("@blocks-localization/services/user-lookup.service", () => ({
  userLookupService: { getUsersByIds: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@blocks-localization/components/modals/new-module/new-module", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/components/modals/edit-module/edit-module", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/components/modals/tag-glossary-modal/tag-glossary-modal", () => ({
  default: () => null,
}));

const mockModules = vi.mocked(useGetLanguageModules);
const mockCurrentUser = vi.mocked(useCurrentUser);

describe("language-module/module-table", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockReturnValue({ data: undefined } as never);
  });
  afterEach(() => vi.useRealTimers());

  it("should render skeletons while loading", () => {
    mockModules.mockReturnValue({
      isLoading: true,
      data: undefined,
      refetch: vi.fn(),
    } as never);
    const { container } = renderWithProviders(<ModuleTable />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("should render an empty state", () => {
    mockModules.mockReturnValue({
      isLoading: false,
      data: [],
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    expect(screen.getByText(/No modules found/)).toBeTruthy();
  });

  it("should render module rows and navigate on click", () => {
    mockModules.mockReturnValue({
      isLoading: false,
      data: [{ itemId: "m1", moduleName: "UILM", createdBy: "u1", createDate: "2026-01-01" }],
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    fireEvent.click(screen.getByText("UILM"));
    expect(navigate).toHaveBeenCalledWith("/scoped/services/modules/m1");
    expect(userLookupService.getUsersByIds).toBeTypeOf("function");
  });

  it("should filter modules by search", () => {
    mockModules.mockReturnValue({
      isLoading: false,
      data: [
        { itemId: "m1", moduleName: "Alpha", createDate: "2026-01-01" },
        { itemId: "m2", moduleName: "Beta", createDate: "2026-01-01" },
      ],
      refetch: vi.fn(),
    } as never);
    vi.useFakeTimers();
    renderWithProviders(<ModuleTable />);
    fireEvent.change(screen.getByPlaceholderText("Search modules..."), {
      target: { value: "alpha" },
    });
    // The filter SearchInput debounces onChange by 300ms.
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("Alpha")).toBeTruthy();
    expect(screen.queryByText("Beta")).toBeNull();
  });

  it("should open the new module dialog", () => {
    mockModules.mockReturnValue({
      isLoading: false,
      data: [],
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    fireEvent.click(screen.getByText("New Module"));
    // NewModule is stubbed to null, so just assert no crash and title present.
    expect(screen.getByText("Modules")).toBeTruthy();
  });

  it("should show a no-match message when search finds nothing", () => {
    mockModules.mockReturnValue({
      isLoading: false,
      data: [{ itemId: "m1", moduleName: "Alpha", createDate: "2026-01-01" }],
      refetch: vi.fn(),
    } as never);
    vi.useFakeTimers();
    renderWithProviders(<ModuleTable />);
    fireEvent.change(screen.getByPlaceholderText("Search modules..."), {
      target: { value: "zzz" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("No modules match your search.")).toBeTruthy();
  });

  it("should render pagination when there are more items than page size", () => {
    const modules = Array.from({ length: 15 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    // Should show "Page 1 of 2" for 15 items with pageSize 10
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });

  it("should navigate to next page when next button is clicked", () => {
    const modules = Array.from({ length: 15 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    // Click next page button (ChevronRight)
    const nextButton = screen.getByRole("button", { name: /go to next page/i });
    fireEvent.click(nextButton);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });

  it("should navigate to previous page when previous button is clicked", () => {
    const modules = Array.from({ length: 15 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    // Go to page 2 first
    const nextButton = screen.getByRole("button", { name: /go to next page/i });
    fireEvent.click(nextButton);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    // Click previous page button (ChevronLeft)
    const prevButton = screen.getByRole("button", { name: /go to previous page/i });
    fireEvent.click(prevButton);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });

  it("should navigate to first page when first page button is clicked", () => {
    const modules = Array.from({ length: 15 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    // Go to page 2 first
    const nextButton = screen.getByRole("button", { name: /go to next page/i });
    fireEvent.click(nextButton);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    // Click first page button ( ChevronsLeft)
    const firstButton = screen.getByRole("button", { name: /go to first page/i });
    fireEvent.click(firstButton);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });

  it("should navigate to last page when last page button is clicked", () => {
    const modules = Array.from({ length: 15 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
    // Click last page button ( ChevronsRight)
    const lastButton = screen.getByRole("button", { name: /go to last page/i });
    fireEvent.click(lastButton);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
  });

  it("should reset to page 0 when page size is changed", async () => {
    const user = userEvent.setup();
    const modules = Array.from({ length: 25 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    // Go to page 2 first
    const nextButton = screen.getByRole("button", { name: /go to next page/i });
    fireEvent.click(nextButton);
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
    // Change page size to 25 (shows "All (25)")
    const rowsPerPageSelect = screen.getByRole("combobox");
    await user.click(rowsPerPageSelect);
    const allOption = screen.getByRole("option", { name: /All \(25\)/i });
    await user.click(allOption);
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
  });

  it("should reset to page 0 when search changes", () => {
    const modules = Array.from({ length: 15 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    vi.useFakeTimers();
    renderWithProviders(<ModuleTable />);
    // Go to page 2 first
    const nextButton = screen.getByRole("button", { name: /go to next page/i });
    fireEvent.click(nextButton);
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    // Type in search to reset page
    fireEvent.change(screen.getByPlaceholderText("Search modules..."), {
      target: { value: "Module" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });

  it("should not render pagination when total count is 0", () => {
    mockModules.mockReturnValue({
      isLoading: false,
      data: [],
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull();
  });

  it("should display only page size items per page", () => {
    const modules = Array.from({ length: 12 }, (_, i) => ({
      itemId: `m${i + 1}`,
      moduleName: `Module ${i + 1}`,
      createDate: "2026-01-01",
    }));
    mockModules.mockReturnValue({
      isLoading: false,
      data: modules,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ModuleTable />);
    // Page 1 should show Module 1-10
    expect(screen.getByText("Module 1")).toBeTruthy();
    expect(screen.getByText("Module 10")).toBeTruthy();
    expect(screen.queryByText("Module 11")).toBeNull();
    expect(screen.queryByText("Module 12")).toBeNull();
  });
});
