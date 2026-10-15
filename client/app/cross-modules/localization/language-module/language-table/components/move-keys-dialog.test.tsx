import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@seliseblocks/genesis-os/lib";
import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { toast } from "@/hooks/use-toast";
import { FORBIDDEN_ERROR_MESSAGE } from "@/lib/error";
import { MoveKeysDialog } from "./move-keys-dialog";

const moveKeysAsync = vi.fn();
let isPending = false;

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useMoveLanguageKeys: () => ({ isPending, mutateAsync: moveKeysAsync }),
}));

const modules = [
  { itemId: "m1", moduleName: "Alpha" },
  { itemId: "m2", moduleName: "Beta" },
  { itemId: "m3", moduleName: "Gamma" },
];
const keysFromAlpha = [
  { itemId: "k1", moduleId: "m1" },
  { itemId: "k2", moduleId: "m1" },
];

const renderDialog = (
  props: Partial<React.ComponentProps<typeof MoveKeysDialog>> = {},
): { onMoved: ReturnType<typeof vi.fn>; onCancel: ReturnType<typeof vi.fn> } => {
  const onMoved = vi.fn();
  const onCancel = vi.fn();
  render(
    <Dialog open onOpenChange={() => {}}>
      <MoveKeysDialog
        keys={keysFromAlpha}
        modules={modules}
        onCancel={onCancel}
        onMoved={onMoved}
        {...props}
      />
    </Dialog>,
  );
  return { onMoved, onCancel };
};

const moveButton = () => screen.getByRole("button", { name: "Move" }) as HTMLButtonElement;

const pickTarget = (moduleName: string) => {
  fireEvent.click(screen.getByRole("combobox", { name: "Target module" }));
  fireEvent.click(screen.getByRole("option", { name: moduleName }));
};

describe("language-table/move-keys-dialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPending = false;
  });

  it("names the source module and offers every other module as a target", () => {
    renderDialog();
    expect(screen.getByText("Move 2 keys to another module")).toBeTruthy();
    expect(screen.getByText("Alpha")).toBeTruthy();

    fireEvent.click(screen.getByRole("combobox", { name: "Target module" }));
    expect(screen.queryByRole("option", { name: "Alpha" })).toBeNull();
    expect(screen.getByRole("option", { name: "Beta" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Gamma" })).toBeTruthy();
  });

  it("offers every module when the keys come from different modules", () => {
    renderDialog({
      keys: [
        { itemId: "k1", moduleId: "m1" },
        { itemId: "k2", moduleId: "m2" },
      ],
    });
    expect(screen.getByText("Choose the module to move the selected keys to.")).toBeTruthy();

    fireEvent.click(screen.getByRole("combobox", { name: "Target module" }));
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("keeps Move disabled until a target is chosen", () => {
    renderDialog();
    expect(moveButton().disabled).toBe(true);
    pickTarget("Beta");
    expect(moveButton().disabled).toBe(false);
  });

  it("moves the keys, toasts success and closes", async () => {
    moveKeysAsync.mockResolvedValue({ success: true, errorMessage: null });
    const { onMoved } = renderDialog();

    pickTarget("Beta");
    fireEvent.click(moveButton());

    await waitFor(() => expect(onMoved).toHaveBeenCalled());
    expect(moveKeysAsync).toHaveBeenCalledWith({ itemIds: ["k1", "k2"], targetModuleId: "m2" });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success", description: "2 keys moved to Beta." }),
    );
  });

  it("shows the server's reason and stays open when the move is rejected", async () => {
    const reason =
      "Keys with these names already exist in Beta or are selected more than once: about. Rename or delete them before moving.";
    moveKeysAsync.mockResolvedValue({ success: false, errorMessage: reason });
    const { onMoved } = renderDialog();

    pickTarget("Beta");
    fireEvent.click(moveButton());

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: reason }),
      ),
    );
    expect(onMoved).not.toHaveBeenCalled();
  });

  it("falls back to a generic message when the rejection has no reason", async () => {
    moveKeysAsync.mockResolvedValue({ success: false, errorMessage: null });
    renderDialog();

    pickTarget("Beta");
    fireEvent.click(moveButton());

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "The selected keys could not be moved. Please try again.",
        }),
      ),
    );
  });

  it.each([
    ["a 403 → the forbidden message", new HttpError(403, { errors: {} }), FORBIDDEN_ERROR_MESSAGE],
    ["an Error → its message", new Error("network down"), "network down"],
  ])("toasts %s", async (_label, rejection, expected) => {
    moveKeysAsync.mockRejectedValue(rejection);
    const { onMoved } = renderDialog();

    pickTarget("Beta");
    fireEvent.click(moveButton());

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: expected }),
      ),
    );
    expect(onMoved).not.toHaveBeenCalled();
  });

  it("explains when there is no other module to move to", () => {
    renderDialog({ modules: [{ itemId: "m1", moduleName: "Alpha" }] });
    expect(
      screen.getByText("There is no other module to move these keys to. Create a module first."),
    ).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Target module" })).toBeNull();
    expect(moveButton().disabled).toBe(true);
  });

  it("disables the actions while the move is in progress", () => {
    isPending = true;
    renderDialog();
    expect((screen.getByRole("button", { name: "Moving..." }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("lets the user cancel", () => {
    const { onCancel } = renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
    expect(moveKeysAsync).not.toHaveBeenCalled();
  });
});
