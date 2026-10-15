import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HttpError } from "@seliseblocks/genesis-os/lib";
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
  const modules = [
    { itemId: "m1", moduleName: "Alpha" },
    { itemId: "m2", moduleName: "Beta" },
  ];
  const pickTarget = (moduleName: string) => {
    fireEvent.click(screen.getByRole("combobox", { name: "Target module" }));
    fireEvent.click(screen.getByRole("option", { name: moduleName }));
  };
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
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={onClose} />));
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
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    expect(screen.getByText(/Checking keys in/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("should show a loading placeholder instead of the move step while the key count loads", () => {
    setKeyCount(undefined, true);
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    expect(screen.getByTestId("module-key-count-loading").getAttribute("aria-busy")).toBe("true");
    expect(screen.queryByRole("combobox", { name: "Target module" })).toBeNull();
    expect(screen.queryByRole("button", { name: "View keys" })).toBeNull();
  });

  it("should show the key count badge and View keys next to the key choice label", () => {
    setKeyCount(3);
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    expect(screen.getByText("What should happen to the keys?")).toBeTruthy();
    expect(screen.getByText("3 keys")).toBeTruthy();
    expect(screen.getByRole("button", { name: "View keys" })).toBeTruthy();
    expect(screen.queryByTestId("module-key-count-loading")).toBeNull();
  });

  it.each([
    [1, "has 1 key."],
    [3, "has 3 keys."],
  ])("should ask what to do with the keys when the module has %i key(s)", (count, text) => {
    setKeyCount(count);
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    expect(screen.getByText(new RegExp(text))).toBeTruthy();
    expect(
      screen.getByText(/Move them to another module or delete them together with the module\./),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("radio", { name: "Move all keys to another module" }) as HTMLButtonElement
      ).getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(deleteModuleMock).not.toHaveBeenCalled();
  });

  it("should offer every other module as a move target and require one to be picked", () => {
    setKeyCount(2);
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    const moveButton = screen.getByRole("button", {
      name: "Move keys & delete module",
    }) as HTMLButtonElement;
    expect(moveButton.disabled).toBe(true);

    fireEvent.click(screen.getByRole("combobox", { name: "Target module" }));
    expect(screen.queryByRole("option", { name: "Alpha" })).toBeNull();
    fireEvent.click(screen.getByRole("option", { name: "Beta" }));

    expect(moveButton.disabled).toBe(false);
  });

  it("should move the keys and delete the module in one request, then close", async () => {
    setKeyCount(2);
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={onClose} />));

    pickTarget("Beta");
    fireEvent.click(screen.getByRole("button", { name: "Move keys & delete module" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1", targetModuleId: "m2" });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "success",
        description: "Module deleted. Its keys were moved to Beta.",
      }),
    );
  });

  it("should show the server's reason and stay open when the move is rejected", async () => {
    setKeyCount(2);
    const reason =
      "Keys with these names already exist in Beta: about. Rename or delete them before moving";
    deleteModuleMock.mockRejectedValue(new HttpError(400, { errors: { TargetModuleId: reason } }));
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={onClose} />));

    pickTarget("Beta");
    fireEvent.click(screen.getByRole("button", { name: "Move keys & delete module" }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: reason }),
      ),
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(refetchKeyCountMock).toHaveBeenCalled();
  });

  it("should send no target when deleting an empty module", async () => {
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1" }));
  });

  it("should only offer deleting the keys when there is no other module to move them to", async () => {
    setKeyCount(2);
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(
      withDialog(<DeleteModuleModal module={module} modules={[modules[0]]} onClose={onClose} />),
    );
    expect(screen.getByText("There is no other module to move the keys to.")).toBeTruthy();
    const moveOption = screen.getByRole("radio", { name: "Move all keys to another module" });
    expect((moveOption as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen
        .getByRole("radio", { name: "Delete all keys with the module" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(screen.queryByRole("combobox", { name: "Target module" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move keys & delete module" })).toBeNull();
    expect(screen.getByRole("button", { name: "View keys" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete module & keys" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1", deleteKeys: true });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "Module and its keys deleted" }),
    );
  });

  it("should delete the keys with the module when the user chooses not to move them", async () => {
    setKeyCount(2);
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={onClose} />));

    fireEvent.click(screen.getByRole("radio", { name: "Delete all keys with the module" }));

    expect(screen.queryByRole("combobox", { name: "Target module" })).toBeNull();
    expect(
      screen.getByText(/2 keys and all of their translations are permanently deleted/),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Move keys & delete module" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete module & keys" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1", deleteKeys: true });
  });

  it("should bring back the target picker when switching back to moving the keys", () => {
    setKeyCount(2);
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("radio", { name: "Delete all keys with the module" }));
    fireEvent.click(screen.getByRole("radio", { name: "Move all keys to another module" }));

    expect(screen.getByRole("combobox", { name: "Target module" })).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Move keys & delete module" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.queryByRole("button", { name: "Delete module & keys" })).toBeNull();
  });

  it("should not offer the move step for an empty module", () => {
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    expect(screen.queryByRole("combobox", { name: "Target module" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Move keys & delete module" })).toBeNull();
  });

  it("should open the module's keys in the translations table from the blocked state", () => {
    setKeyCount(2);
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "View keys" }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(navigateMock).toHaveBeenCalledWith("/scoped/services/language?moduleIds=m1");
  });

  it("should leave the decision to the server when the key count could not be loaded", async () => {
    setKeyCount(undefined);
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1" }));
  });

  it("should toast an error when deletion is unsuccessful", async () => {
    deleteModuleMock.mockResolvedValue({ isSuccess: false });
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to delete module" }),
      ),
    );
  });

  it("should let the user cancel", () => {
    const onClose = vi.fn();
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledWith(false);
    expect(deleteModuleMock).not.toHaveBeenCalled();
  });

  it("should toast a thrown error and re-check the key count", async () => {
    deleteModuleMock.mockRejectedValue(new Error("network down"));
    render(withDialog(<DeleteModuleModal module={module} modules={modules} onClose={vi.fn()} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "network down" }),
      ),
    );
    expect(refetchKeyCountMock).toHaveBeenCalled();
  });
});
