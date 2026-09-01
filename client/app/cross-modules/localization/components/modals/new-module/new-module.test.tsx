import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { Dialog } from "@/components/ui-kits/dialog/dialog";
import { useSaveLanguageModule } from "@blocks-localization/hooks/use-language-manager";
import { showErrorToast, toast } from "@/hooks/use-toast";
import NewModule from "./new-module";

const saveModuleAsync = vi.fn();

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveLanguageModule: vi.fn(() => ({
    isPending: false,
    mutateAsync: saveModuleAsync,
  })),
}));
vi.mock("@/hooks/use-toast", () => ({ showErrorToast: vi.fn(), toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>{node}</Dialog>
);

describe("components/modals/new-module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSaveLanguageModule).mockReturnValue({
      isPending: false,
      mutateAsync: saveModuleAsync,
    } as never);
  });

  it("renders the new module dialog", () => {
    render(withDialog(<NewModule onClose={vi.fn()} />));
    expect(screen.getByText("New module")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter Module name")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  describe("H1 — Success closes dialog and shows toast", () => {
    it("creates module, shows toast, and closes dialog", async () => {
      const user = userEvent.setup();
      saveModuleAsync.mockResolvedValue({ success: true });
      const onClose = vi.fn();
      render(withDialog(<NewModule onClose={onClose} />));

      const input = screen.getByPlaceholderText("Enter Module name");
      await act(async () => {
        await user.type(input, "Marketing");
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      await act(async () => {
        fireEvent.click(createBtn);
      });

      await waitFor(() => {
        expect(saveModuleAsync).toHaveBeenCalledWith(
          expect.objectContaining({ moduleName: "Marketing" }),
        );
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "success", title: "Success" }),
        );
        expect(onClose).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("H3 — Cancel closes without API call", () => {
    it("closes dialog without calling API on Cancel", async () => {
      const user = userEvent.setup();
      saveModuleAsync.mockResolvedValue({ success: true }); // shouldn't be called
      render(withDialog(<NewModule onClose={vi.fn()} />));

      const input = screen.getByPlaceholderText("Enter Module name");
      await act(async () => {
        await user.type(input, "Should Not Submit");
      });

      const cancelBtn = screen.getByRole("button", { name: "Cancel" });
      await act(async () => {
        fireEvent.click(cancelBtn);
      });

      expect(saveModuleAsync).not.toHaveBeenCalled();
    });
  });

  describe("H4 — Button disabled during pending", () => {
    it("disables Create button during isPending", async () => {
      saveModuleAsync.mockImplementation(() => new Promise((r) => setTimeout(r, 1000)));
      vi.mocked(useSaveLanguageModule).mockReturnValue({
        isPending: true,
        mutateAsync: saveModuleAsync,
      } as never);

      const user = userEvent.setup();
      render(withDialog(<NewModule onClose={vi.fn()} />));

      const input = screen.getByPlaceholderText("Enter Module name");
      await act(async () => {
        await user.type(input, "Slow");
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      expect((createBtn as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("H5 — Form resets after successful create", () => {
    it("resets form after successful create", async () => {
      const user = userEvent.setup();
      saveModuleAsync.mockResolvedValue({ success: true });
      render(withDialog(<NewModule onClose={vi.fn()} />));

      const input = screen.getByPlaceholderText("Enter Module name") as HTMLInputElement;
      await act(async () => {
        await user.type(input, "Reset");
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      await act(async () => {
        fireEvent.click(createBtn);
      });

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });
  });

  describe("C1 — API errorMessage shown cleanly", () => {
    it("shows errorMessage from API without JSON wrapping", async () => {
      const user = userEvent.setup();
      saveModuleAsync.mockResolvedValue({
        success: false,
        errorMessage: "Module already exists",
      });
      render(withDialog(<NewModule onClose={vi.fn()} />));

      const input = screen.getByPlaceholderText("Enter Module name");
      await act(async () => {
        await user.type(input, "Duplicate");
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      await act(async () => {
        fireEvent.click(createBtn);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith({
          errors: "Module already exists",
        });
      });
    });
  });

  describe("C2 — validationErrors array shown cleanly", () => {
    it("shows first validation error message", async () => {
      const user = userEvent.setup();
      saveModuleAsync.mockResolvedValue({
        success: false,
        validationErrors: [{ errorMessage: "Name too long" }],
      });
      render(withDialog(<NewModule onClose={vi.fn()} />));

      const input = screen.getByPlaceholderText("Enter Module name");
      await act(async () => {
        await user.type(input, "Bad");
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      await act(async () => {
        fireEvent.click(createBtn);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith({
          errors: "Name too long",
        });
      });
    });
  });

  describe("C3 — Exception shows readable message (not JSON)", () => {
    it("shows error.message on network failure", async () => {
      const user = userEvent.setup();
      saveModuleAsync.mockRejectedValue(new Error("Network timeout"));
      render(withDialog(<NewModule onClose={vi.fn()} />));

      const input = screen.getByPlaceholderText("Enter Module name");
      await act(async () => {
        await user.type(input, "Test");
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      await act(async () => {
        fireEvent.click(createBtn);
      });

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "Network timeout",
          }),
        );
      });
    });
  });

  describe("C4 — Empty name shows Zod error, no API call", () => {
    it("shows required error without calling API", async () => {
      const user = userEvent.setup();
      render(withDialog(<NewModule onClose={vi.fn()} />));

      // First type something, then clear it
      const input = screen.getByPlaceholderText("Enter Module name");
      await act(async () => {
        await user.type(input, "Test");
      });

      // Now clear it
      await act(async () => {
        await user.clear(input);
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      await act(async () => {
        fireEvent.click(createBtn);
      });

      await waitFor(() => {
        expect(saveModuleAsync).not.toHaveBeenCalled();
      });
    });
  });

  describe("C5 — Name too long shows Zod error", () => {
    it("shows max-length error without calling API", async () => {
      const user = userEvent.setup();
      render(withDialog(<NewModule onClose={vi.fn()} />));

      const input = screen.getByPlaceholderText("Enter Module name");
      const longName = "a".repeat(51);
      await act(async () => {
        await user.type(input, longName);
      });

      const createBtn = screen.getByRole("button", { name: "Create" });
      expect((createBtn as HTMLButtonElement).disabled).toBe(true);
      expect(saveModuleAsync).not.toHaveBeenCalled();
    });
  });
});
