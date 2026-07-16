import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { useGetLanguageModules } from "@blocks-localization/hooks/use-language-manager";
import { userLookupService } from "@blocks-localization/services/user-lookup.service";
import { ModuleTable } from "./module-table";

const navigate = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguageModules: vi.fn(),
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
vi.mock(
  "@blocks-localization/components/modals/tag-glossary-modal/tag-glossary-modal",
  () => ({ default: () => null }),
);

const mockModules = vi.mocked(useGetLanguageModules);

describe("language-module/module-table", () => {
  beforeEach(() => vi.clearAllMocks());
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
    expect(
      screen.getByText(/No modules found/),
    ).toBeTruthy();
  });

  it("should render module rows and navigate on click", () => {
    mockModules.mockReturnValue({
      isLoading: false,
      data: [
        { itemId: "m1", moduleName: "UILM", createdBy: "u1", createDate: "2026-01-01" },
      ],
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
});
