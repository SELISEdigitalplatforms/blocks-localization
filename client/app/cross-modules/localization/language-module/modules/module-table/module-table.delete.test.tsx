import { act, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { useGetLanguageModules } from "@blocks-localization/hooks/use-language-manager";
import { useCurrentUser } from "@blocks-localization/hooks/use-user-lookup";
import { ModuleTable } from "./module-table";

const deleteModalProps = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
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
// Capture the props so the test can assert which modules the dialog receives.
vi.mock("@blocks-localization/components/modals/delete-module-modal/delete-module-modal", () => ({
  default: (props: { module: { moduleName: string }; onClose: () => void }) => {
    deleteModalProps(props);
    return (
      <div>
        delete-dialog-{props.module.moduleName}
        <button onClick={props.onClose}>close-delete-dialog</button>
      </div>
    );
  },
}));

const mockModules = vi.mocked(useGetLanguageModules);
const mockCurrentUser = vi.mocked(useCurrentUser);

// More modules than one page (10) so pagination and search both narrow the visible rows.
const modulesData = Array.from({ length: 12 }, (_, i) => ({
  itemId: `m${i + 1}`,
  moduleName: `Module ${i + 1}`,
  createDate: "2026-01-01",
}));

const openRowMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const trigger = screen.getAllByRole("button").find((b) => b.className.includes("h-8 w-8 p-0"))!;
  await user.click(trigger);
};

describe("module-table (delete module)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockReturnValue({ data: undefined } as never);
    mockModules.mockReturnValue({
      isLoading: false,
      data: modulesData,
      refetch: vi.fn(),
    } as never);
  });

  it("opens the delete dialog with the full, unfiltered module list as move targets", async () => {
    vi.useFakeTimers();
    renderWithProviders(<ModuleTable />);

    // Narrow the table to a single row via search (the input debounces by 300ms).
    fireEvent.change(screen.getByPlaceholderText("Search modules..."), {
      target: { value: "Module 12" },
    });
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByText("Module 1")).toBeNull();
    vi.useRealTimers();

    const user = userEvent.setup();
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete"));

    expect(await screen.findByText("delete-dialog-Module 12")).toBeTruthy();
    const props = deleteModalProps.mock.lastCall![0];
    expect(props.module).toBe(modulesData[11]);
    expect(props.modules).toBe(modulesData);
  });

  it("closes the delete dialog when the modal calls onClose", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ModuleTable />);

    await openRowMenu(user);
    await user.click(await screen.findByText("Delete"));
    expect(await screen.findByText("delete-dialog-Module 1")).toBeTruthy();

    await user.click(screen.getByText("close-delete-dialog"));
    expect(screen.queryByText("delete-dialog-Module 1")).toBeNull();
  });
});
