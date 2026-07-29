import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { Configure } from "./configure";

const saveWebhookAsync = vi.fn();
const deleteAsync = vi.fn();
const setDefaultAsync = vi.fn();

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@blocks-localization/components/modals/new-language/new-language", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguages: vi.fn(),
  useGetWebhook: vi.fn(),
  useSaveWebhook: vi.fn(),
  useSetDefaultLanguage: vi.fn(),
  useDeleteLanguage: vi.fn(),
}));

const h = vi.mocked(hooks);

const setDefaults = () => {
  h.useGetLanguages.mockReturnValue({
    isLoading: false,
    data: [
      {
        itemId: "en",
        languageName: "English",
        languageCode: "en-US",
        isDefault: true,
      },
      {
        itemId: "de",
        languageName: "German",
        languageCode: "de-DE",
        isDefault: false,
      },
    ],
  } as never);
  h.useGetWebhook.mockReturnValue({ data: undefined } as never);
  h.useSaveWebhook.mockReturnValue({
    isPending: false,
    mutateAsync: saveWebhookAsync,
  } as never);
  h.useSetDefaultLanguage.mockReturnValue({
    isPending: false,
    mutateAsync: setDefaultAsync,
  } as never);
  h.useDeleteLanguage.mockReturnValue({
    isPending: false,
    mutateAsync: deleteAsync,
  } as never);
};

// Open the first row's action menu (the German, non-default row).
const openRowMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  const triggers = screen.getAllByRole("button").filter((b) => b.className.includes("h-8 w-8 p-0"));
  await user.click(triggers[triggers.length - 1]);
};

describe("configure (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  it("makes a language default through the confirmation dialog", async () => {
    const user = userEvent.setup();
    setDefaultAsync.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Make default language"));
    expect(await screen.findByText("Make default language")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(setDefaultAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Make default successful" }),
    );
  });

  it("toasts an error when make-default returns errors", async () => {
    const user = userEvent.setup();
    setDefaultAsync.mockResolvedValue({ isSuccess: false, errors: ["nope"] });
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Make default language"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("handles a thrown error from make-default", async () => {
    const user = userEvent.setup();
    setDefaultAsync.mockRejectedValue(new Error("boom"));
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Make default language"));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("deletes a language successfully", async () => {
    const user = userEvent.setup();
    deleteAsync.mockResolvedValue({ isSuccess: true });
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete language"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(deleteAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Deleted successfully" }),
    );
  });

  it("surfaces an array error message on delete", async () => {
    const user = userEvent.setup();
    deleteAsync.mockResolvedValue({ isSuccess: false, errors: ["a", "b"] });
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete language"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive", description: "a, b" }),
      ),
    );
  });

  it("surfaces string values from an object error on delete", async () => {
    const user = userEvent.setup();
    deleteAsync.mockResolvedValue({
      isSuccess: false,
      errors: { first: "too many", second: "in use" },
    });
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete language"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "too many, in use",
        }),
      ),
    );
  });

  it("stringifies a non-string object error on delete", async () => {
    const user = userEvent.setup();
    deleteAsync.mockResolvedValue({
      isSuccess: false,
      errors: { count: 3 },
    });
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete language"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: JSON.stringify({ count: 3 }),
        }),
      ),
    );
  });

  it("handles a thrown error message on delete", async () => {
    const user = userEvent.setup();
    deleteAsync.mockRejectedValue(new Error("delete failed"));
    renderWithProviders(<Configure />);
    await openRowMenu(user);
    await user.click(await screen.findByText("Delete language"));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "delete failed",
        }),
      ),
    );
  });

  it("handles a thrown error from the webhook save", async () => {
    saveWebhookAsync.mockRejectedValue(new Error("network"));
    const { container } = renderWithProviders(<Configure />);
    fireEvent.change(screen.getByPlaceholderText("https://example.com/webhook"), {
      target: { value: "https://hooks.example.com/x" },
    });
    fireEvent.change(screen.getByPlaceholderText("application/json"), {
      target: { value: "application/json" },
    });
    fireEvent.change(screen.getByPlaceholderText("X-Webhook-Secret"), {
      target: { value: "X-Key" },
    });
    fireEvent.change(screen.getByPlaceholderText("********"), {
      target: { value: "s3cret" },
    });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });
});
