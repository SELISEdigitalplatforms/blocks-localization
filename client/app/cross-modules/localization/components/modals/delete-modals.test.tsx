import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import DeleteLanguageKey from "./delete-language-key/delete-language-key";
import DeleteModuleModal from "./delete-module-modal/delete-module-modal";

const deleteKeyMock = vi.fn();
const deleteModuleMock = vi.fn();
const toastMock = vi.fn();
const navigateMock = vi.fn();
let tenantId = "t1";
const refetchKeyCountMock = vi.fn();
let keyCountState: { data?: number; isLoading: boolean; refetch: () => void } = {
  data: 0,
  isLoading: false,
  refetch: refetchKeyCountMock,
};

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId } }),
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("react-router", () => ({ useNavigate: () => navigateMock }));
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toastMock(...a) }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useDeleteLanguageKey: () => ({ isPending: false, mutateAsync: deleteKeyMock }),
  useDeleteLanguageModule: () => ({
    isPending: false,
    mutateAsync: deleteModuleMock,
  }),
  useGetModuleKeyCount: () => keyCountState,
}));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

describe("modals/delete-language-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tenantId = "t1";
  });

  it("should delete the key, toast success and navigate on success", async () => {
    deleteKeyMock.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(withDialog(<DeleteLanguageKey itemId="k1" onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(deleteKeyMock).toHaveBeenCalledWith({ itemId: "k1" });
    expect(navigateMock).toHaveBeenCalledWith("/scoped/services/language", {
      replace: true,
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: "success" }));
  });

  it("should guard against a missing key/tenant", async () => {
    render(withDialog(<DeleteLanguageKey itemId="" onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: expect.stringContaining("Missing") }),
      ),
    );
    expect(deleteKeyMock).not.toHaveBeenCalled();
  });

  it("should surface array errors joined by comma", async () => {
    deleteKeyMock.mockResolvedValue({ isSuccess: false, errors: ["a", "b"] });
    render(withDialog(<DeleteLanguageKey itemId="k1" onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: "a, b" })),
    );
  });

  it("should surface the first object error message", async () => {
    deleteKeyMock.mockResolvedValue({
      isSuccess: false,
      errors: { field: "bad value" },
    });
    render(withDialog(<DeleteLanguageKey itemId="k1" onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ description: "bad value" })),
    );
  });

  it("should handle a thrown error", async () => {
    deleteKeyMock.mockRejectedValue(new Error("network down"));
    render(withDialog(<DeleteLanguageKey itemId="k1" onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "network down" }),
      ),
    );
  });
});

describe("modals/delete-module-modal", () => {
  const module = { itemId: "m1", moduleName: "Alpha" } as never;
  const setKeyCount = (data: number | undefined, isLoading = false) => {
    keyCountState = { data, isLoading, refetch: refetchKeyCountMock };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setKeyCount(0);
  });

  it("should confirm and delete an empty module, then close on success", async () => {
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} onClose={onClose} />));
    expect(screen.getByText(/Are you sure you want to delete/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1" });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Module deleted" }),
    );
  });

  it("should disable delete while the key count is loading", () => {
    setKeyCount(undefined, true);
    render(withDialog(<DeleteModuleModal module={module} onClose={vi.fn()} />));
    expect(screen.getByText(/Checking keys in/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it.each([
    [1, "has 1 key."],
    [3, "has 3 keys."],
  ])("should block deletion when the module has %i key(s)", (count, text) => {
    setKeyCount(count);
    render(withDialog(<DeleteModuleModal module={module} onClose={vi.fn()} />));
    expect(screen.getByText(new RegExp(text))).toBeTruthy();
    expect(
      screen.getByText(/Please delete or move all keys to another module before deleting it\./),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(deleteModuleMock).not.toHaveBeenCalled();
  });

  it("should navigate to the module details from the blocked state", () => {
    setKeyCount(2);
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Go to module" }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(navigateMock).toHaveBeenCalledWith("/scoped/services/modules/m1");
  });

  it("should leave the decision to the server when the key count could not be loaded", async () => {
    setKeyCount(undefined);
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    render(withDialog(<DeleteModuleModal module={module} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1" }));
  });

  it("should toast an error when deletion is unsuccessful", async () => {
    deleteModuleMock.mockResolvedValue({ isSuccess: false });
    render(withDialog(<DeleteModuleModal module={module} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to delete module" }),
      ),
    );
  });

  it("should let the user cancel", () => {
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(deleteModuleMock).not.toHaveBeenCalled();
  });

  it("should toast a thrown error and re-check the key count", async () => {
    deleteModuleMock.mockRejectedValue(new Error("network down"));
    render(withDialog(<DeleteModuleModal module={module} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "network down" }),
      ),
    );
    expect(refetchKeyCountMock).toHaveBeenCalled();
  });
});
