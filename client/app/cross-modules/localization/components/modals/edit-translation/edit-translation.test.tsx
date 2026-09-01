import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import {
  useGetTranslationSuggestion,
  useSaveBlocksLanguageKey,
} from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { IBlocksLanguageKey, ILanguageConfig } from "@blocks-localization/models/language";
import EditTranslation from "./edit-translation";

const saveKeyAsync = vi.fn();
const autoTranslateAsync = vi.fn();

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(() => ({
    isPending: false,
    mutateAsync: saveKeyAsync,
  })),
  useGetTranslationSuggestion: vi.fn(() => ({
    isPending: false,
    mutateAsync: autoTranslateAsync,
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
  resources: [
    { culture: "en-US", value: "Hello" },
    { culture: "de-DE", value: "Hallo" },
  ],
  isPartiallyTranslated: false,
  lastUpdateDate: "",
  createDate: "",
  context: "",
};

const languageListData: ILanguageConfig[] = [
  { itemId: "l1", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "l2", languageName: "German", languageCode: "de-DE" },
];

const withDialog = (node: React.ReactNode, onOpenChange: (open: boolean) => void = () => {}) => (
  <Dialog open onOpenChange={onOpenChange}>
    {node}
  </Dialog>
);

describe("components/modals/edit-translation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveBlocksLanguageKey).mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
    vi.mocked(useGetTranslationSuggestion).mockReturnValue({
      isPending: false,
      mutateAsync: autoTranslateAsync,
    } as never);
  });

  describe("H1 — Success closes dialog", () => {
    it("shows a success toast and closes the dialog", async () => {
      saveKeyAsync.mockResolvedValue({ success: true });
      const onClose = vi.fn();
      render(
        withDialog(
          <EditTranslation
            dialogTitle="Edit"
            keyDetails={keyDetails}
            destinationLanguageCode="de-DE"
            languageListData={languageListData}
            onClose={onClose}
          />,
        ),
      );

      const saveBtn = screen.getByRole("button", { name: "Save" });
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(saveKeyAsync).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "key-1", keyName: "greeting" }),
      );
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success", title: "Success" }),
      );
      expect(onClose).toHaveBeenCalledWith(false);
    });
  });

  describe("H3 — Failure keeps dialog open", () => {
    it("shows an error toast and does not close the dialog", async () => {
      saveKeyAsync.mockResolvedValue({ success: false, errorMessage: "Validation failed" });
      const onClose = vi.fn();
      render(
        withDialog(
          <EditTranslation
            dialogTitle="Edit"
            keyDetails={keyDetails}
            destinationLanguageCode="de-DE"
            languageListData={languageListData}
            onClose={onClose}
          />,
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
          description: "Validation failed",
        }),
      );
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("C3 — Exception keeps dialog open", () => {
    it("shows an error toast on a thrown exception and does not close the dialog", async () => {
      saveKeyAsync.mockRejectedValue(new Error("Network timeout"));
      const onClose = vi.fn();
      render(
        withDialog(
          <EditTranslation
            dialogTitle="Edit"
            keyDetails={keyDetails}
            destinationLanguageCode="de-DE"
            languageListData={languageListData}
            onClose={onClose}
          />,
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

  describe("C5 — Cancel closes without calling the API", () => {
    it("does not call the save API when Cancel is clicked", async () => {
      const onClose = vi.fn();
      render(
        withDialog(
          <EditTranslation
            dialogTitle="Edit"
            keyDetails={keyDetails}
            destinationLanguageCode="de-DE"
            languageListData={languageListData}
            onClose={onClose}
          />,
        ),
      );

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      expect(saveKeyAsync).not.toHaveBeenCalled();
    });
  });

  describe("H5 — Save button re-enabled once the pending mutation resolves", () => {
    it("is not disabled once isPending returns to false after a resolved save", async () => {
      saveKeyAsync.mockResolvedValue({ success: true });
      vi.mocked(useSaveBlocksLanguageKey).mockReturnValue({
        isPending: false,
        mutateAsync: saveKeyAsync,
      } as never);
      const onClose = vi.fn();
      render(
        withDialog(
          <EditTranslation
            dialogTitle="Edit"
            keyDetails={keyDetails}
            destinationLanguageCode="de-DE"
            languageListData={languageListData}
            onClose={onClose}
          />,
        ),
      );

      const saveBtn = screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;
      await act(async () => {
        fireEvent.click(saveBtn);
      });

      expect(onClose).toHaveBeenCalledWith(false);
      expect(saveBtn.disabled).toBe(false);
    });
  });
});
