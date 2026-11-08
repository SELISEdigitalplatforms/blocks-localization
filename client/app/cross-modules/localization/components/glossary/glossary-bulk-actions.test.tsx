import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { toast } from "@/hooks/use-toast";
import {
  useGetAllModuleGlossaries,
  useGetLanguageModules,
} from "@blocks-localization/hooks/use-language-manager";
import { useGlossaryBulk } from "@blocks-localization/hooks/use-glossary-bulk";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { IGlossary } from "@blocks-localization/models/language";
import GlossaryBulkActions from "./glossary-bulk-actions";

const run = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn(), showErrorToast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetAllModuleGlossaries: vi.fn(),
  useGetLanguageModules: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-glossary-bulk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@blocks-localization/hooks/use-glossary-bulk")>()),
  useGlossaryBulk: vi.fn(),
}));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { getGlossaryUsage: vi.fn() },
}));

const term = (itemId: string, name: string): IGlossary => ({
  itemId,
  name,
  createDate: "",
  lastUpdateDate: "",
});
const selected = [term("a", "Workspace"), term("b", "Invoice")];

const mockBulk = (state: Partial<ReturnType<typeof useGlossaryBulk>> = {}) =>
  vi.mocked(useGlossaryBulk).mockReturnValue({
    run,
    progress: null,
    isRunning: false,
    ...state,
  });

const renderBar = (props: Partial<Parameters<typeof GlossaryBulkActions>[0]> = {}) => {
  const onClearSelection = vi.fn();
  const onReload = vi.fn();
  renderWithProviders(
    <GlossaryBulkActions
      selected={selected}
      onClearSelection={onClearSelection}
      onReload={onReload}
      {...props}
    />,
  );
  return { onClearSelection, onReload };
};

describe("components/glossary/glossary-bulk-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBulk();
    vi.mocked(useGetLanguageModules).mockReturnValue({
      data: [{ itemId: "m1", moduleName: "Billing" }],
    } as never);
    vi.mocked(useGetAllModuleGlossaries).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    } as never);
  });

  it("renders nothing without a selection", () => {
    renderBar({ selected: [] });
    expect(screen.queryByRole("toolbar")).toBeNull();
  });

  it("offers the bulk actions with the selection count (H19)", () => {
    renderBar();
    expect(screen.getByText("2 selected")).toBeTruthy();
    ["Approve", "Deprecate", "Tag to module", "Set whole project", "Delete"].forEach((name) =>
      expect(screen.getByRole("button", { name })).toBeTruthy(),
    );
  });

  it("clears the selection from the bar", () => {
    const { onClearSelection } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(onClearSelection).toHaveBeenCalled();
  });

  it("shows the progress and disables every action while running", () => {
    mockBulk({ progress: { done: 1, total: 2 }, isRunning: true });
    renderBar();
    expect(screen.getByText("Updating 1 / 2…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Approve" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("toasts 'Updated x of N terms' and lists the failed names with Reload (C8)", async () => {
    run.mockResolvedValue({
      total: 2,
      succeeded: 1,
      failed: [{ itemId: "b", name: "Invoice", message: "The term was changed." }],
    });
    const { onClearSelection, onReload } = renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Updated 1 of 2 glossaries" }),
      ),
    );
    expect(run).toHaveBeenCalledWith({ kind: "status", status: "approved" }, selected);
    expect(onClearSelection).toHaveBeenCalled();
    expect(screen.getByText("Invoice")).toBeTruthy();
    expect(screen.getByText(/The term was changed\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalled();
    expect(screen.queryByText(/The term was changed\./)).toBeNull();
  });

  it("toasts success without an Alert when every term saved", async () => {
    run.mockResolvedValue({ total: 2, succeeded: 2, failed: [] });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Deprecate" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", description: "Updated 2 of 2 glossaries" }),
      ),
    );
    expect(run).toHaveBeenCalledWith({ kind: "status", status: "deprecated" }, selected);
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
  });

  it("confirms Set whole project before running it", async () => {
    run.mockResolvedValue({ total: 2, succeeded: 2, failed: [] });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Set whole project" }));
    expect(screen.getByText(/Removes their module links/)).toBeTruthy();
    expect(run).not.toHaveBeenCalled();
    const buttons = screen.getAllByRole("button", { name: "Set whole project" });
    fireEvent.click(buttons[buttons.length - 1]);
    await waitFor(() => expect(run).toHaveBeenCalledWith({ kind: "set-project" }, selected));
  });

  it("requires typing 'delete N glossaries' when the summed usage is 50 or more", async () => {
    vi.mocked(languageManagerService.getGlossaryUsage).mockImplementation(
      async ({ itemId }) =>
        ({ keyCount: itemId === "a" ? 30 : 20, keys: [], moduleIds: [] }) as never,
    );
    run.mockResolvedValue({ total: 2, succeeded: 2, failed: [] });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Used by up to 50 keys in total.")).toBeTruthy();
    expect(screen.getByText("Workspace")).toBeTruthy();
    const confirm = () =>
      screen.getAllByRole("button", { name: "Delete" }).at(-1) as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);
    const input = screen.getByLabelText(/to confirm/);
    fireEvent.change(input, { target: { value: "delete 2 term" } });
    expect(confirm().disabled).toBe(true);
    fireEvent.change(input, { target: { value: "delete 2 glossaries" } });
    expect(confirm().disabled).toBe(false);
    fireEvent.click(confirm());
    await waitFor(() => expect(run).toHaveBeenCalledWith({ kind: "delete" }, selected));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Deleted 2 of 2 glossaries" }),
    );
  });

  it("requires the typed phrase when a Usage call is forbidden (SPEC15 H22)", async () => {
    vi.mocked(languageManagerService.getGlossaryUsage).mockImplementation(async ({ itemId }) => {
      if (itemId === "b") throw { status: 403, errors: {} };
      return { keyCount: 1, keys: [], moduleIds: [] } as never;
    });
    run.mockResolvedValue({ total: 2, succeeded: 2, failed: [] });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText(
        "You can't see how many keys use these glossaries. Deleting removes them from every key that uses them.",
      ),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    const confirm = () =>
      screen.getAllByRole("button", { name: "Delete" }).at(-1) as HTMLButtonElement;
    expect(confirm().disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Type "delete 2 glossaries" to confirm'), {
      target: { value: "delete 2 glossaries" },
    });
    expect(confirm().disabled).toBe(false);
    fireEvent.click(confirm());
    await waitFor(() => expect(run).toHaveBeenCalledWith({ kind: "delete" }, selected));
  });

  it("keeps Retry and a disabled Delete for any other Usage error (SPEC15 C24)", async () => {
    vi.mocked(languageManagerService.getGlossaryUsage).mockRejectedValue({ status: 500 });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(
      await screen.findByText("Failed to check how many keys use these glossaries."),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByLabelText(/to confirm/)).toBeNull();
    expect(
      (screen.getAllByRole("button", { name: "Delete" }).at(-1) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("asks for the phrase at a summed 50 keys but not at 49 (SPEC15 C37)", async () => {
    vi.mocked(languageManagerService.getGlossaryUsage).mockImplementation(
      async ({ itemId }) => ({ keyCount: itemId === "a" ? 30 : 19, keys: [], moduleIds: [] }) as never,
    );
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Used by up to 49 keys in total.")).toBeTruthy();
    expect(screen.queryByLabelText(/to confirm/)).toBeNull();
  });

  it("deletes without typing when the summed usage is below 50", async () => {
    vi.mocked(languageManagerService.getGlossaryUsage).mockResolvedValue({
      keyCount: 1,
      keys: [],
      moduleIds: [],
      violationKeyCount: 0,
    });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Used by up to 2 keys in total.")).toBeTruthy();
    expect(screen.queryByLabelText(/to confirm/)).toBeNull();
    expect(
      (screen.getAllByRole("button", { name: "Delete" }).at(-1) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("disables Tag when the module's glossaries can't be loaded (C7)", () => {
    vi.mocked(useGetAllModuleGlossaries).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Tag to module" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Module" }));
    fireEvent.click(screen.getByRole("option", { name: "Billing" }));
    expect(screen.getByText("Couldn't load the module's glossaries")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Tag" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables Tag while the module's glossaries are only cached or refetching", () => {
    vi.mocked(useGetAllModuleGlossaries).mockReturnValue({
      data: [term("x", "Existing")],
      isLoading: false,
      isError: false,
      isFetching: true,
      isFetchedAfterMount: false,
    } as never);
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Tag to module" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Module" }));
    fireEvent.click(screen.getByRole("option", { name: "Billing" }));
    expect(screen.getByText("Loading the module's glossaries…")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Tag" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("tags with the module's existing glossary ids once they are loaded", async () => {
    vi.mocked(useGetAllModuleGlossaries).mockReturnValue({
      data: [term("x", "Existing")],
      isLoading: false,
      isError: false,
      isFetching: false,
      isFetchedAfterMount: true,
    } as never);
    run.mockResolvedValue({ total: 2, succeeded: 2, failed: [] });
    renderBar();
    fireEvent.click(screen.getByRole("button", { name: "Tag to module" }));
    expect((screen.getByRole("button", { name: "Tag" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("combobox", { name: "Module" }));
    fireEvent.click(screen.getByRole("option", { name: "Billing" }));
    fireEvent.click(screen.getByRole("button", { name: "Tag" }));
    await waitFor(() =>
      expect(run).toHaveBeenCalledWith(
        { kind: "tag-module", moduleId: "m1", existingIds: ["x"] },
        selected,
      ),
    );
  });
});
