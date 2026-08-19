import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { useTranslateAll } from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import AutoTranslate from "./auto-translate";

const translateAllAsync = vi.fn();

vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useTranslateAll: vi.fn(() => ({
    isPending: false,
    mutateAsync: translateAllAsync,
  })),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));

const withDialog = (node: React.ReactNode) => (
  <Dialog open onOpenChange={() => {}}>
    {node}
  </Dialog>
);

describe("components/modals/auto-translate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTranslateAll).mockReturnValue({
      isPending: false,
      mutateAsync: translateAllAsync,
    } as never);
  });

  it("renders the auto-translate dialog", () => {
    render(withDialog(<AutoTranslate />));
    expect(screen.getByText("Auto-translate all keys")).toBeTruthy();
    expect(screen.getByText("Are you sure you want to automatically translate all keys?")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Yes" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  describe("H1 — Success closes dialog", () => {
    it("calls onClose after successful translation", async () => {
      translateAllAsync.mockResolvedValue({ isSuccess: true });
      const onClose = vi.fn();
      render(withDialog(<AutoTranslate onClose={onClose} />));

      fireEvent.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ variant: "success" }),
        );
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onClose).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("H5 — onClose optional", () => {
    it("does not throw when onClose is not provided", async () => {
      translateAllAsync.mockResolvedValue({ isSuccess: true });
      render(withDialog(<AutoTranslate />));

      expect(() => {
        fireEvent.click(screen.getByRole("button", { name: "Yes" }));
      }).not.toThrow();
    });
  });

  describe("C1 — API failure keeps dialog open", () => {
    it("shows error and keeps dialog open when API returns isSuccess: false", async () => {
      translateAllAsync.mockResolvedValue({
        isSuccess: false,
        errors: { itemId: "No keys to translate" },
      });
      const onClose = vi.fn();
      render(withDialog(<AutoTranslate onClose={onClose} />));

      fireEvent.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
        expect(onClose).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "No keys to translate",
          }),
        );
      });
    });
  });

  describe("C2 — Exception keeps dialog open", () => {
    it("shows error message on network failure", async () => {
      translateAllAsync.mockRejectedValue(new Error("Network failure"));
      const onClose = vi.fn();
      render(withDialog(<AutoTranslate onClose={onClose} />));

      fireEvent.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
        expect(onClose).not.toHaveBeenCalled();
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "Network failure",
          }),
        );
      });
    });
  });

  describe("C3 — Object errors joined", () => {
    it("joins multiple error values with semicolon", async () => {
      translateAllAsync.mockResolvedValue({
        isSuccess: false,
        errors: { a: "First", b: "Second" },
      });
      render(withDialog(<AutoTranslate />));

      fireEvent.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "First; Second",
          }),
        );
      });
    });
  });

  describe("C4 — String errors displayed directly", () => {
    it("displays string error without extra quotes", async () => {
      translateAllAsync.mockResolvedValue({
        isSuccess: false,
        errors: "Just a string error",
      });
      render(withDialog(<AutoTranslate />));

      fireEvent.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Just a string error",
          }),
        );
      });
    });
  });

  describe("C5 — Error object message extracted", () => {
    it("shows error.message instead of {}", async () => {
      translateAllAsync.mockRejectedValue(new Error("timeout"));
      render(withDialog(<AutoTranslate />));

      fireEvent.click(screen.getByRole("button", { name: "Yes" }));

      await waitFor(() => {
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "timeout",
          }),
        );
      });
    });
  });

  describe("H2 — isPending disables buttons", () => {
    it("disables Yes button during API call", async () => {
      translateAllAsync.mockImplementation(() => new Promise((r) => setTimeout(r, 1000)));
      vi.mocked(useTranslateAll).mockReturnValue({
        isPending: true,
        mutateAsync: translateAllAsync,
      } as never);
      render(withDialog(<AutoTranslate />));

      expect((screen.getByRole("button", { name: "Yes" }) as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe("H4 — Cancel closes without API call", () => {
    it("does not call API on Cancel", async () => {
      translateAllAsync.mockResolvedValue({ isSuccess: true });
      const onClose = vi.fn();
      render(withDialog(<AutoTranslate onClose={onClose} />));

      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

      expect(translateAllAsync).not.toHaveBeenCalled();
    });
  });
});
