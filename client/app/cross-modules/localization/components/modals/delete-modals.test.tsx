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

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId } }),
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
let locationState: unknown = null;
vi.mock("react-router", () => ({
  useNavigate: () => navigateMock,
  useLocation: () => ({ state: locationState, search: "" }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: (...a: unknown[]) => toastMock(...a) }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useDeleteLanguageKey: () => ({ isPending: false, mutateAsync: deleteKeyMock }),
  useDeleteLanguageModule: () => ({
    isPending: false,
    mutateAsync: deleteModuleMock,
  }),
}));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

describe("modals/delete-language-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    locationState = null;
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

  it("should return to the table with the filters it was opened from", async () => {
    deleteKeyMock.mockResolvedValue({ isSuccess: true });
    locationState = { returnSearch: "?duplicates=true&moduleIds=m1&pageNumber=1" };
    const onClose = vi.fn();
    render(withDialog(<DeleteLanguageKey itemId="k1" onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith(
      "/scoped/services/language?duplicates=true&moduleIds=m1&pageNumber=1",
      { replace: true },
    );
  });

  it.each([
    ["no state (glossary link, bookmark, direct URL)", null],
    ["a value that is not a query string", { returnSearch: "/elsewhere" }],
    ["a non-string value", { returnSearch: 42 }],
  ])("should return to the plain table when opened with %s", async (_label, state) => {
    deleteKeyMock.mockResolvedValue({ isSuccess: true });
    locationState = state;
    const onClose = vi.fn();
    render(withDialog(<DeleteLanguageKey itemId="k1" onClose={onClose} />));
    fireEvent.click(screen.getByRole("button", { name: "Delete Key" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(navigateMock).toHaveBeenCalledWith("/scoped/services/language", { replace: true });
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
  const allModules = [
    { itemId: "m1", moduleName: "Alpha" },
    { itemId: "m2", moduleName: "Beta" },
  ] as never;

  beforeEach(() => vi.clearAllMocks());

  it("should delete in cascade mode and close on success", async () => {
    deleteModuleMock.mockResolvedValue({ isSuccess: true });
    const onClose = vi.fn();
    render(
      withDialog(<DeleteModuleModal module={module} allModules={allModules} onClose={onClose} />),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(false));
    expect(deleteModuleMock).toHaveBeenCalledWith({ itemId: "m1" });
  });

  it("should toast an error when deletion is unsuccessful", async () => {
    deleteModuleMock.mockResolvedValue({ isSuccess: false });
    render(
      withDialog(<DeleteModuleModal module={module} allModules={allModules} onClose={vi.fn()} />),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to delete module" }),
      ),
    );
  });

  it("should disable delete in move mode until a target is chosen", () => {
    render(
      withDialog(<DeleteModuleModal module={module} allModules={allModules} onClose={vi.fn()} />),
    );
    fireEvent.click(screen.getByLabelText("Move keys to another module"));
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("should let the user cancel", () => {
    const onClose = vi.fn();
    render(
      withDialog(<DeleteModuleModal module={module} allModules={allModules} onClose={onClose} />),
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onClose).toHaveBeenCalledWith(false);
  });
});
