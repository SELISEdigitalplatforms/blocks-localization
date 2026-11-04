import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import DeleteGlossary from "./delete-glossary";

const cascadeAsync = vi.fn();
const refetchUsage = vi.fn();

vi.mock("@seliseblocks/genesis-os", async () => ({
  ...(await import("@/test-utils/i18n-mock")).i18nMock,
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
  useFetchLatestGlossary: vi.fn(),
}));

const h = vi.mocked(hooks);

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

const saveAsync = vi.fn();
const fetchLatest = vi.fn();

/** `data` is the key count; `moduleIds` the Usage response's modules. */
const mockUsage = (
  state: { data?: number; isLoading?: boolean; isFetching?: boolean; isError?: boolean },
  moduleIds: string[] = [],
  scope: { affectedKeyCount?: number; isGlobal?: boolean } = {},
) => {
  h.useGetGlossaryUsage.mockReturnValue({
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: refetchUsage,
    ...state,
    data:
      typeof state.data === "number"
        ? { keyCount: state.data, keys: [], moduleIds, violationKeyCount: 0, ...scope }
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
    h.useFetchLatestGlossary.mockReturnValue(fetchLatest);
  });

  it("should count usage for the glossary", () => {
    renderDialog();
    expect(h.useGetGlossaryUsage).toHaveBeenCalledWith("g1");
    expect(screen.getByText("Used by 3 keys.")).toBeTruthy();
    expect(screen.getByText("Deleting removes it from those keys.")).toBeTruthy();
  });

  it("counts every key a global glossary applies to, not only tagged ones", () => {
    mockUsage({ data: 0 }, [], { affectedKeyCount: 1200, isGlobal: true });
    renderDialog();
    expect(screen.getByText("Applies to every key in the project (1200 keys).")).toBeTruthy();
    expect(screen.queryByText("Not used by any keys.")).toBeNull();
    expect(screen.getByLabelText('Type "Widget" to confirm')).toBeTruthy();
  });

  it("counts the keys in a module glossary's modules", () => {
    mockUsage({ data: 1 }, ["m1"], { affectedKeyCount: 40 });
    renderDialog();
    expect(screen.getByText("Used by 40 keys in 1 module.")).toBeTruthy();
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

  it("should show the server's reason when the delete request throws", async () => {
    cascadeAsync.mockRejectedValue({
      status: 400,
      errors: { Error: "Could not remove the glossary from keys. Nothing was deleted." },
    });
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Could not remove the glossary from keys. Nothing was deleted.",
        }),
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

    it("accepts the typed name in another Unicode normalization form", () => {
      mockUsage({ data: 120 });
      const composed = "Caf\u00e9";
      render(withDialog(<DeleteGlossary itemId="g1" glossaryName={composed} onClose={vi.fn()} />));
      fireEvent.change(screen.getByLabelText(`Type "${composed}" to confirm`), {
        target: { value: "Cafe\u0301" },
      });
      expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
        false,
      );
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
          description: "Glossary deprecated. It no longer reaches the AI or highlights.",
        }),
      );
    });

    it("reloads the term after a version conflict and deprecates the latest version", async () => {
      saveAsync.mockResolvedValueOnce({
        success: false,
        validationErrors: [{ propertyName: "Version", errorMessage: "Changed" }],
      });
      fetchLatest.mockResolvedValue({ ...glossary, name: "Widget v5", version: 5 });
      const onClose = vi.fn();
      mockUsage({ data: 3 });
      renderWithTerm(onClose);
      fireEvent.click(screen.getByRole("button", { name: "Deprecate instead" }));
      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description:
              "This glossary was changed by someone else. The latest version is loaded; try again.",
          }),
        ),
      );
      expect(fetchLatest).toHaveBeenCalledWith("g1");
      expect(onClose).not.toHaveBeenCalled();

      saveAsync.mockResolvedValueOnce({ success: true });
      fireEvent.click(screen.getByRole("button", { name: "Deprecate instead" }));
      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(saveAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({ name: "Widget v5", version: 5, status: "deprecated" }),
      );
    });

    it("does not offer Deprecate instead for a glossary saved by a newer version", () => {
      mockUsage({ data: 3 });
      render(
        withDialog(
          <DeleteGlossary
            itemId="g1"
            glossaryName="Widget"
            glossary={{ ...glossary, additionalNote: '@@glossary-meta:v9@@{"x":1}' }}
            onClose={vi.fn()}
          />,
        ),
      );
      expect(screen.queryByRole("button", { name: "Deprecate instead" })).toBeNull();
    });

    it("does not offer Deprecate instead for an unused term", () => {
      mockUsage({ data: 0 });
      renderWithTerm();
      expect(screen.queryByRole("button", { name: "Deprecate instead" })).toBeNull();
    });
  });
});
