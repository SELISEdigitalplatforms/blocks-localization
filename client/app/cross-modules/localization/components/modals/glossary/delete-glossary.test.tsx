import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import DeleteGlossary from "./delete-glossary";

const cascadeAsync = vi.fn();
const refetchUsage = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetGlossaryUsage: vi.fn(),
  useDeleteGlossaryWithCascade: vi.fn(),
  useSaveGlossary: vi.fn(),
}));

const h = vi.mocked(hooks);

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

const saveAsync = vi.fn();

/** `data` is the key count; `moduleIds` the Usage response's modules. */
const mockUsage = (
  state: { data?: number; isLoading?: boolean; isFetching?: boolean; isError?: boolean },
  moduleIds: string[] = [],
) => {
  h.useGetGlossaryUsage.mockReturnValue({
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: refetchUsage,
    ...state,
    data:
      typeof state.data === "number"
        ? { keyCount: state.data, keys: [], moduleIds, violationKeyCount: 0 }
        : undefined,
  } as never);
};

const mockCascade = (isPending = false) => {
  h.useDeleteGlossaryWithCascade.mockReturnValue({
    isPending,
    mutateAsync: cascadeAsync,
  } as never);
};

const renderDialog = (onClose = vi.fn()) =>
  render(withDialog(<DeleteGlossary itemId="g1" glossaryName="Widget" onClose={onClose} />));

describe("modals/glossary/delete-glossary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsage({ data: 3 });
    mockCascade();
    h.useSaveGlossary.mockReturnValue({ isPending: false, mutateAsync: saveAsync } as never);
  });

  it("should count usage for the glossary", () => {
    renderDialog();
    expect(h.useGetGlossaryUsage).toHaveBeenCalledWith("g1");
    expect(screen.getByText("Used by 3 keys.")).toBeTruthy();
    expect(screen.getByText("Deleting removes it from those keys.")).toBeTruthy();
  });

  it("should disable confirm and show 'Checking usage…' while counting", () => {
    mockUsage({ isLoading: true, isFetching: true });
    renderDialog();
    const confirm = screen.getByRole("button", { name: "Checking usage…" }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it("should not show the usage badge for unused glossaries", () => {
    mockUsage({ data: 0 });
    renderDialog();
    expect(screen.queryByText(/Used by/)).toBeNull();
    expect(screen.getByText("Not used by any keys.")).toBeTruthy();
  });

  it("should disable confirm and offer Retry when the count fails", () => {
    mockUsage({ isError: true });
    renderDialog();
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetchUsage).toHaveBeenCalled();
    expect(cascadeAsync).not.toHaveBeenCalled();
  });

  it("should send only the glossary id, toast and close on success", async () => {
    cascadeAsync.mockResolvedValue({ status: "deleted" });
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    // The server removes the glossary from its keys; the dialog sends no count or progress callback.
    expect(cascadeAsync).toHaveBeenCalledWith({ glossaryId: "g1" });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        description: "Glossary item deleted successfully.",
      }),
    );
  });

  it("should show 'Deleting…' while the delete runs", () => {
    mockCascade(true);
    renderDialog();
    expect(screen.getByText("Deleting…")).toBeTruthy();
    expect(screen.queryByText(/Removing from keys/)).toBeNull();
  });

  it("should ignore repeated confirm clicks so only one cascade runs", async () => {
    cascadeAsync.mockImplementation(() => new Promise(() => {}));
    renderDialog();
    const confirm = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(cascadeAsync).toHaveBeenCalledTimes(1);
  });

  it("should disable both buttons while the cascade is pending", () => {
    mockCascade(true);
    renderDialog();
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("should toast the server error when the glossary delete fails", async () => {
    cascadeAsync.mockResolvedValue({ status: "delete-failed", errors: {} });
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(refetchUsage).toHaveBeenCalled();
  });

  it("should handle a thrown error", async () => {
    cascadeAsync.mockRejectedValue(new Error("x"));
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to delete glossary item" }),
      ),
    );
  });

  describe("Phase 8", () => {
    const glossary = {
      itemId: "g1",
      name: "Widget",
      createDate: "2026-01-01",
      lastUpdateDate: "2026-01-01",
      version: 4,
      rule: "translate" as const,
      status: "approved" as const,
      isGlobal: false,
      moduleIds: ["m1"],
      translations: [],
    };

    const renderWithTerm = (onClose = vi.fn()) =>
      render(
        withDialog(
          <DeleteGlossary itemId="g1" glossaryName="Widget" glossary={glossary} onClose={onClose} />,
        ),
      );

    it("says how many keys in how many modules use the term (H23)", () => {
      mockUsage({ data: 3 }, ["m1", "m2"]);
      renderDialog();
      expect(screen.getByText("Used by 3 keys in 2 modules.")).toBeTruthy();
    });

    it("requires the exact name from 50 keys before Delete is enabled (H10)", () => {
      mockUsage({ data: 120 });
      renderDialog();
      const confirm = screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(true);
      const input = screen.getByLabelText('Type "Widget" to confirm');
      fireEvent.change(input, { target: { value: "widget" } });
      expect(confirm.disabled).toBe(true);
      fireEvent.change(input, { target: { value: " Widget " } });
      expect(confirm.disabled).toBe(false);
    });

    it("does not ask for the name below 50 keys", () => {
      mockUsage({ data: 49 });
      renderDialog();
      expect(screen.queryByLabelText('Type "Widget" to confirm')).toBeNull();
      expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });

    it("offers Deprecate instead for a used term and saves it as deprecated (H24)", async () => {
      saveAsync.mockResolvedValue({ success: true });
      const onClose = vi.fn();
      mockUsage({ data: 3 });
      renderWithTerm(onClose);
      fireEvent.click(screen.getByRole("button", { name: "Deprecate instead" }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(saveAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: "g1",
          name: "Widget",
          moduleIds: ["m1"],
          version: 4,
          status: "deprecated",
        }),
      );
      expect(cascadeAsync).not.toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Term deprecated. It no longer reaches the AI or highlights.",
        }),
      );
    });

    it("does not offer Deprecate instead for an unused term", () => {
      mockUsage({ data: 0 });
      renderWithTerm();
      expect(screen.queryByRole("button", { name: "Deprecate instead" })).toBeNull();
    });
  });
});
