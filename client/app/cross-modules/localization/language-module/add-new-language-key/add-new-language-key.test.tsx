import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { AddNewLanguageKey } from "./add-new-language-key";

const navigate = vi.fn();
const saveKeyAsync = vi.fn();

vi.mock("react-router-dom", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router-dom")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@seliseblocks/blocks-kit/hooks", () => ({
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

describe("language-module/add-new-language-key", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.useGetLanguageModules.mockReturnValue({
      data: [{ itemId: "m1", moduleName: "UILM" }],
    } as never);
    h.useGetLanguages.mockReturnValue({
      data: [
        { languageCode: "en-US", languageName: "English", isDefault: true },
        { languageCode: "de-DE", languageName: "German", isDefault: false },
      ],
    } as never);
    h.useGetTranslationSuggestion.mockReturnValue({ mutateAsync: vi.fn() } as never);
    h.useSaveBlocksLanguageKey.mockReturnValue({
      isPending: false,
      mutateAsync: saveKeyAsync,
    } as never);
  });

  it("should render the create-key form", () => {
    renderWithProviders(<AddNewLanguageKey />, {
      route: "/app/abc/services/language/translations/new-key",
    });
    expect(screen.getByText("Create new key")).toBeTruthy();
    expect(screen.getByText("About the key")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter key name")).toBeTruthy();
  });

  it("should render Translations and Routes sections", () => {
    renderWithProviders(<AddNewLanguageKey />, {
      route: "/app/abc/services/language/translations/new-key",
    });
    expect(screen.getByText("Translations")).toBeTruthy();
    expect(screen.getByText("Routes")).toBeTruthy();
  });

  it("should accept typing a key name", () => {
    renderWithProviders(<AddNewLanguageKey />, {
      route: "/app/abc/services/language/translations/new-key",
    });
    const input = screen.getByPlaceholderText("Enter key name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "greeting" } });
    expect(input.value).toBe("greeting");
  });

  it("should add a route field", () => {
    renderWithProviders(<AddNewLanguageKey />, {
      route: "/app/abc/services/language/translations/new-key",
    });
    const before = screen.queryAllByPlaceholderText("Enter route").length;
    fireEvent.click(screen.getByRole("button", { name: /Add Route/ }));
    expect(screen.queryAllByPlaceholderText("Enter route").length).toBe(before + 1);
  });

  it("should submit a valid new key", async () => {
    saveKeyAsync.mockResolvedValue({ success: true });
    renderWithProviders(<AddNewLanguageKey />, {
      route: "/app/abc/services/language/translations/new-key",
    });

    fireEvent.change(screen.getByPlaceholderText("Enter key name"), {
      target: { value: "greeting" },
    });
    // Select a module via the combobox popover.
    fireEvent.click(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: /UILM/ }));
    // Provide the required default value.
    fireEvent.change(screen.getByPlaceholderText("Enter default value"), {
      target: { value: "Hello" },
    });

    fireEvent.submit(screen.getByPlaceholderText("Enter key name").closest("form")!);

    await waitFor(() => expect(saveKeyAsync).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Language key added" }),
    );
    expect(navigate).toHaveBeenCalledWith("/scoped/services/language", {
      replace: true,
    });
  });
});
