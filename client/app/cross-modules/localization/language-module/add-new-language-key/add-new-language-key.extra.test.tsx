import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { AddNewLanguageKey } from "./add-new-language-key";

const navigate = vi.fn();
const saveKeyAsync = vi.fn();
const autoTranslateAsync = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@seliseblocks/genesis-os/hooks", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-localization/components/modals/new-module/new-module", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetLanguageModules: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetTranslationSuggestion: vi.fn(),
  useSaveBlocksLanguageKey: vi.fn(),
}));

const h = vi.mocked(hooks);
const route = "/app/abc/services/language/translations/new-key";

const fillValidForm = () => {
  fireEvent.change(screen.getByPlaceholderText("Enter key name"), {
    target: { value: "greeting" },
  });
  fireEvent.click(screen.getByRole("combobox"));
  fireEvent.click(screen.getByRole("option", { name: /UILM/ }));
  fireEvent.change(screen.getByPlaceholderText("Enter default value"), {
    target: { value: "Hello" },
  });
};

const submitForm = () =>
  fireEvent.submit(screen.getByPlaceholderText("Enter key name").closest("form")!);

describe("add-new-language-key (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetLanguageModules.mockReturnValue({
      isLoading: false,
      data: [{ itemId: "m1", moduleName: "UILM" }],
    } as never);
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      data: [
        { languageCode: "en-US", languageName: "English", isDefault: true },
        { languageCode: "de-DE", languageName: "German", isDefault: false },
      ],
    } as never);
    h.useGetTranslationSuggestion.mockReturnValue({
      mutateAsync: autoTranslateAsync,
    } as never);
    h.useSaveBlocksLanguageKey.mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
  });

  it("renders a skeleton while languages load", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: true,
      data: undefined,
    } as never);
    const { container } = renderWithProviders(<AddNewLanguageKey />, { route });
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("surfaces validation errors from a failed save", async () => {
    saveKeyAsync.mockResolvedValue({
      success: false,
      validationErrors: [{ errorMessage: "Name taken" }, { errorMessage: "Bad module" }],
    });
    renderWithProviders(<AddNewLanguageKey />, { route });
    fillValidForm();
    submitForm();
    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "destructive",
        description: "Name taken\nBad module",
      }),
    );
  });

  it("falls back to the response error message when there are no validation errors", async () => {
    saveKeyAsync.mockResolvedValue({
      success: false,
      errorMessage: "Server rejected the key",
    });
    renderWithProviders(<AddNewLanguageKey />, { route });
    fillValidForm();
    submitForm();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Server rejected the key",
        }),
      ),
    );
  });

  it("uses a generic message when the response has no details", async () => {
    saveKeyAsync.mockResolvedValue({ success: false });
    renderWithProviders(<AddNewLanguageKey />, { route });
    fillValidForm();
    submitForm();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Unable to save language key",
        }),
      ),
    );
  });

  it("uses 'Something went wrong' when the response is empty", async () => {
    saveKeyAsync.mockResolvedValue(undefined);
    renderWithProviders(<AddNewLanguageKey />, { route });
    fillValidForm();
    submitForm();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "Something went wrong",
        }),
      ),
    );
  });

  it("handles a thrown error during save", async () => {
    saveKeyAsync.mockRejectedValue(new Error("network"));
    renderWithProviders(<AddNewLanguageKey />, { route });
    fillValidForm();
    submitForm();
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("auto-translates a translation field successfully", async () => {
    autoTranslateAsync.mockResolvedValue({ content: "Hallo" });
    renderWithProviders(<AddNewLanguageKey />, { route });
    // The auto-translate button is enabled once the default value is present.
    fireEvent.change(screen.getByPlaceholderText("Enter default value"), {
      target: { value: "Hello" },
    });
    const autoBtn = await screen.findByRole("button", { name: /Auto-Translate/ });
    fireEvent.click(autoBtn);
    await waitFor(() => expect(autoTranslateAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Translated successfully" }),
    );
  });

  it("toasts an error when auto-translate returns no content", async () => {
    autoTranslateAsync.mockResolvedValue({ content: "", errors: ["x"] });
    renderWithProviders(<AddNewLanguageKey />, { route });
    fireEvent.change(screen.getByPlaceholderText("Enter default value"), {
      target: { value: "Hello" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Auto-Translate/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("handles a thrown error during auto-translate", async () => {
    autoTranslateAsync.mockRejectedValue(new Error("boom"));
    renderWithProviders(<AddNewLanguageKey />, { route });
    fireEvent.change(screen.getByPlaceholderText("Enter default value"), {
      target: { value: "Hello" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Auto-Translate/ }));
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" })),
    );
  });

  it("adds and removes a route field", () => {
    renderWithProviders(<AddNewLanguageKey />, { route });
    fireEvent.click(screen.getByRole("button", { name: /Add Route/ }));
    const routeInput = screen.getByPlaceholderText("Enter route");
    const removeRouteButton = screen.getByRole("button", { name: "Remove Route" });

    expect(routeInput.getAttribute("aria-required")).toBe("true");
    expect(document.querySelector('label[for="routes.0.value"] span')?.textContent).toBe("*");
    expect(routeInput.parentElement?.contains(removeRouteButton)).toBe(true);
    expect(removeRouteButton.getAttribute("type")).toBe("button");

    fireEvent.click(removeRouteButton);
    expect(screen.queryAllByPlaceholderText("Enter route").length).toBe(0);
  });

  it("toggles a module selection off when reselected", () => {
    renderWithProviders(<AddNewLanguageKey />, { route });
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /UILM/ }));
    // Reopen and select the same module to clear it.
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /UILM/ }));
    expect(screen.getByText("Select Module...")).toBeTruthy();
  });
});
