import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
// Render identifiable content so opening the edit / tag dialogs is observable.
vi.mock("@blocks-localization/components/modals/edit-module/edit-module", () => ({
  default: ({ module }: { module: { moduleName: string } }) => (
    <div>edit-dialog-{module.moduleName}</div>
  ),
}));
vi.mock("@blocks-localization/components/modals/tag-glossary-modal/tag-glossary-modal", () => ({
  default: ({ module }: { module: { moduleName: string } }) => (
    <div>tag-dialog-{module.moduleName}</div>
  ),
}));

const mockModules = vi.mocked(useGetLanguageModules);
const mockCurrentUser = vi.mocked(useCurrentUser);
const getUsersByIds = vi.mocked(userLookupService.getUsersByIds);

const rowModule = {
  itemId: "m1",
  moduleName: "UILM",
  createdBy: "u1",
  createDate: "2026-01-01",
};

const setModules = (data: unknown) =>
  mockModules.mockReturnValue({
    isLoading: false,
    data,
    refetch: vi.fn().mockResolvedValue(undefined),
  } as never);

const openRowMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const trigger = screen.getAllByRole("button").find((b) => b.className.includes("h-8 w-8 p-0"))!;
  await user.click(trigger);
};

describe("module-table (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockReturnValue({ data: undefined } as never);
    getUsersByIds.mockResolvedValue({});
  });

  it("opens the edit-module dialog from the row menu", async () => {
    const user = userEvent.setup();
    setModules([rowModule]);
    renderWithProviders(<ModuleTable />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Edit"));
    expect(await screen.findByText("edit-dialog-UILM")).toBeTruthy();
  });

  it("opens the tag-glossary dialog from the row menu", async () => {
    const user = userEvent.setup();
    setModules([rowModule]);
    renderWithProviders(<ModuleTable />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Tag glossary"));
    expect(await screen.findByText("tag-dialog-UILM")).toBeTruthy();
  });

  it("shows a full name when the creator has first and last names", async () => {
    getUsersByIds.mockResolvedValue({
      u1: { firstName: "Ada", lastName: "Lovelace" },
    } as never);
    setModules([rowModule]);
    renderWithProviders(<ModuleTable />);
    expect(await screen.findByText("Ada Lovelace")).toBeTruthy();
  });

  it("falls back to email when names are missing", async () => {
    getUsersByIds.mockResolvedValue({
      u1: { email: "ada@example.com" },
    } as never);
    setModules([rowModule]);
    renderWithProviders(<ModuleTable />);
    expect(await screen.findByText("ada@example.com")).toBeTruthy();
  });

  it("falls back to username when name and email are missing", async () => {
    getUsersByIds.mockResolvedValue({
      u1: { userName: "ada99" },
    } as never);
    setModules([rowModule]);
    renderWithProviders(<ModuleTable />);
    expect(await screen.findByText("ada99")).toBeTruthy();
  });

  it("shows a dash when the creator is not in the resolved user map", async () => {
    getUsersByIds.mockResolvedValue({ someone: { firstName: "X" } } as never);
    setModules([rowModule]);
    renderWithProviders(<ModuleTable />);
    // The user query resolves without u1, so the cell renders an em dash.
    await waitFor(() => expect(getUsersByIds).toHaveBeenCalled());
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("shows the current user when a new module has no createdBy ID", async () => {
    mockCurrentUser.mockReturnValue({
      data: {
        itemId: "current-user",
        firstName: "Current",
        lastName: "User",
        email: "current@example.com",
        userName: "current.user",
      },
    } as never);
    setModules([{ ...rowModule, createdBy: null }]);

    renderWithProviders(<ModuleTable />);

    expect(await screen.findByText("Current User")).toBeTruthy();
  });

  it("shows a dash when a module has no creator", async () => {
    setModules([{ itemId: "m2", moduleName: "NoCreator", createDate: null }]);
    renderWithProviders(<ModuleTable />);
    expect(await screen.findByText("NoCreator")).toBeTruthy();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
