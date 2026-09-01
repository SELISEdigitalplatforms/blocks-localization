import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { useSaveBlocksLanguageKey } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { IBlocksLanguageKey } from "@blocks-localization/models/language";
import GptPrompt from "./gpt-prompt";

const saveKeyAsync = vi.fn();

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(() => ({
    isPending: false,
    mutateAsync: saveKeyAsync,
  })),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));

const keyDetails: IBlocksLanguageKey = {
  itemId: "key-1",
  keyName: "greeting",
  moduleId: "module-1",
  routes: [],
  glossaryIds: [],
  resources: [{ culture: "en-US", value: "Hello" }],
  isPartiallyTranslated: false,
  lastUpdateDate: "",
  createDate: "",
  context: "",
};

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

describe("components/modals/gpt-prompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
  });

  describe("H2 — Success closes dialog", () => {
    it("shows a success toast and closes the dialog", async () => {
      saveKeyAsync.mockResolvedValue({ success: true });
      const onClose = vi.fn();
      render(
        withDialog(
          <GptPrompt defaultValue="Translate this." keyDetails={keyDetails} onClose={onClose} />,
        ),
      );

      const textarea = screen.getByRole("textbox");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "Translate this, updated." } });
      });

      const saveBtn = screen.getByRole("button", { name: "Save" });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(saveKeyAsync).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "key-1", context: "Translate this, updated." }),
      );
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", title: "Success" }),
      );
      expect(onClose).toHaveBeenCalledWith(false);
    });
  });

  describe("H4 — Failure keeps dialog open", () => {
    it("shows an error toast and does not close the dialog", async () => {
      saveKeyAsync.mockResolvedValue({ success: false, errorMessage: "Save failed" });
      const onClose = vi.fn();
      render(
        withDialog(
          <GptPrompt defaultValue="Translate this." keyDetails={keyDetails} onClose={onClose} />,
        ),
      );

      const textarea = screen.getByRole("textbox");
      await act(async () => {
        fireEvent.change(textarea, { target: { value: "Translate this, updated." } });
      });

      const saveBtn = screen.getByRole("button", { name: "Save" });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Error",
          description: "Save failed",
        }),
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("C4 — Exception keeps dialog open", () => {
    it("shows an error toast on a thrown exception and does not close the dialog", async () => {
      saveKeyAsync.mockRejectedValue(new Error("Network timeout"));
      const onClose = vi.fn();
      render(
        withDialog(
          <GptPrompt defaultValue="Translate this." keyDetails={keyDetails} onClose={onClose} />,
        ),
      );

      const saveBtn = screen.getByRole("button", { name: "Save" });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          title: "Error",
          description: "Network timeout",
        }),
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("C2 — Save button disabled while pending", () => {
    it("disables the Save and Cancel-adjacent state while isPending is true", () => {
      vi.mocked(useSaveBlocksLanguageKey).mockReturnValue({
        isPending: true,
        mutateAsync: saveKeyAsync,
      } as never);
      const onClose = vi.fn();
      render(
        withDialog(
          <GptPrompt defaultValue="Translate this." keyDetails={keyDetails} onClose={onClose} />,
        ),
      );

      const saveBtn = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });
  });
});
