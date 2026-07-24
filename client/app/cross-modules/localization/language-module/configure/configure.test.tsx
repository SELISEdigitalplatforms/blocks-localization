import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { toast } from "@/hooks/use-toast";
import { Configure } from "./configure";

const saveWebhookAsync = vi.fn();

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
  h.useGetWebhook.mockReturnValue({ data: undefined } as never);
  h.useSaveWebhook.mockReturnValue({
    isPending: false,
    mutateAsync: saveWebhookAsync,
  } as never);
  h.useSetDefaultLanguage.mockReturnValue({ mutateAsync: vi.fn() } as never);
  h.useDeleteLanguage.mockReturnValue({
    isPending: false,
    mutateAsync: vi.fn(),
  } as never);
};

describe("language-module/configure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  it("should show a loading skeleton while languages load", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: true,
      data: undefined,
    } as never);
    const { container } = renderWithProviders(<Configure />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("should render the languages table and webhook form", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      data: [
        { itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true },
        { itemId: "de", languageName: "German", languageCode: "de-DE", isDefault: false },
      ],
    } as never);
    renderWithProviders(<Configure />);
    expect(screen.getByText("Configure Languages")).toBeTruthy();
    expect(screen.getByText("Languages")).toBeTruthy();
    expect(screen.getByText("Webhooks")).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("German")).toBeTruthy();
  });

  it("should submit the webhook form", async () => {
    saveWebhookAsync.mockResolvedValue({ success: true });
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      data: [{ itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true }],
    } as never);
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
    await waitFor(() => expect(saveWebhookAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Webhook saved successfully" }),
    );
  });

  it("should toast an error when the webhook save fails", async () => {
    saveWebhookAsync.mockResolvedValue({ success: false, errorMessage: "bad" });
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      data: [{ itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true }],
    } as never);
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

  it("should prefill the webhook form from existing config", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      data: [{ itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true }],
    } as never);
    h.useGetWebhook.mockReturnValue({
      data: {
        url: "https://saved.example.com",
        contentType: "application/json",
        blocksWebhookSecret: { headerKey: "X-Saved", secret: "sv" },
        isDisabled: false,
      },
    } as never);
    renderWithProviders(<Configure />);
    expect(
      (screen.getByPlaceholderText("https://example.com/webhook") as HTMLInputElement).value,
    ).toBe("https://saved.example.com");
  });
});
