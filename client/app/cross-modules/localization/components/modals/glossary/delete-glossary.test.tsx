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
  useGetGlossaryUsageCount: vi.fn(),
  useDeleteGlossaryWithCascade: vi.fn(),
}));

const h = vi.mocked(hooks);

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

const mockUsage = (state: Partial<ReturnType<typeof hooks.useGetGlossaryUsageCount>>) => {
  h.useGetGlossaryUsageCount.mockReturnValue({
    data: undefined,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: refetchUsage,
    ...state,
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
  });

  it("should count usage for the glossary", () => {
    renderDialog();
    expect(h.useGetGlossaryUsageCount).toHaveBeenCalledWith("g1");
    expect(screen.getByText("Used by 3 keys")).toBeTruthy();
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

  it("should run the cascade with the known count, toast and close on success", async () => {
    cascadeAsync.mockResolvedValue({ status: "deleted" });
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(cascadeAsync).toHaveBeenCalledWith(
      expect.objectContaining({ glossaryId: "g1", initialCount: 3 }),
    );
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        description: "Glossary item deleted successfully.",
      }),
    );
  });

  it("should show progress while the cascade runs", async () => {
    let finish: (value: unknown) => void = () => {};
    cascadeAsync.mockImplementation(
      ({ onProgress }: { onProgress: (r: number, t: number) => void }) => {
        onProgress(1, 3);
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    );
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText("Removing from keys… 1 / 3")).toBeTruthy();
    finish({ status: "deleted" });
    await waitFor(() => expect(toast).toHaveBeenCalled());
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

  it("should keep the dialog open and report partial progress when a batch fails", async () => {
    cascadeAsync.mockResolvedValue({
      status: "keys-failed",
      reason: "save-failed",
      removedCount: 100,
      totalCount: 250,
    });
    const onClose = vi.fn();
    renderDialog(onClose);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Removed from 100 of 250 keys; glossary not deleted. Try again.",
        }),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(refetchUsage).toHaveBeenCalled();
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
});
