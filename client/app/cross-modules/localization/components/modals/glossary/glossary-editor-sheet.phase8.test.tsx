import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import GlossaryEditorSheet from "./glossary-editor-sheet";

const saveGlossaryAsync = vi.fn();
const suggest = vi.fn();
const suggestAll = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@/hooks/use-toast", () => ({
  toast: vi.fn(),
  showErrorToast: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveGlossary: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useSearchGlossaries: vi.fn(),
  useFetchLatestGlossary: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-glossary-term-suggestion", () => ({
  useGlossaryTermSuggestion: () => ({
    suggest,
    suggestAll,
    pendingCodes: new Set(),
    isSuggesting: false,
  }),
}));

const languages = [
  { itemId: "1", languageCode: "en-US", languageName: "English", isDefault: true },
  { itemId: "2", languageCode: "de-DE", languageName: "German" },
  { itemId: "3", languageCode: "fr-FR", languageName: "French" },
];

const renderSheet = (glossary?: IGlossary) =>
  render(<GlossaryEditorSheet open onOpenChange={vi.fn()} glossary={glossary} />);

const nameInput = () => screen.getByPlaceholderText("Enter glossary name") as HTMLInputElement;
const lastPayload = () => saveGlossaryAsync.mock.calls.at(-1)?.[0];

describe("glossary-editor-sheet (Phase 8)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveGlossaryAsync.mockResolvedValue({ success: true });
    vi.mocked(hooks.useSaveGlossary).mockReturnValue({
      isPending: false,
      mutateAsync: saveGlossaryAsync,
    } as never);
    vi.mocked(hooks.useFetchLatestGlossary).mockReturnValue(vi.fn());
    vi.mocked(hooks.useGetLanguages).mockReturnValue({ data: languages } as never);
    vi.mocked(hooks.useGetLanguageModules).mockReturnValue({
      data: [{ itemId: "m1", moduleName: "Billing" }],
    } as never);
    vi.mocked(hooks.useSearchGlossaries).mockReturnValue({
      data: { items: [], totalCount: 0 },
      isError: false,
    } as never);
  });

  it("presets a new term's Language to the project default (H9)", () => {
    renderSheet();
    expect(screen.getByRole("combobox", { name: "Language" }).textContent).toContain("English");
  });

  it("keeps an edited term's stored empty Language", async () => {
    renderSheet({
      itemId: "g1",
      name: "Workspace",
      language: "",
      isGlobal: true,
      createDate: "",
      lastUpdateDate: "",
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload().language).toBe("");
  });

  it("Save & add another keeps Language, Rule and Scope, empties the rest and focuses Name (H7)", async () => {
    renderSheet();
    fireEvent.click(screen.getByLabelText("Keep"));
    fireEvent.click(screen.getByLabelText("Specific modules"));
    fireEvent.click(screen.getByRole("combobox", { name: "Tag modules" }));
    fireEvent.click(screen.getByRole("option", { name: "Billing" }));
    fireEvent.change(nameInput(), { target: { value: "Invoice" } });
    fireEvent.change(screen.getByPlaceholderText("What the term means"), {
      target: { value: "A bill" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Save & add another" }));
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalledTimes(1));
    expect(lastPayload()).toMatchObject({ name: "Invoice", rule: "keep", moduleIds: ["m1"] });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Glossary item added successfully." }),
    );

    await waitFor(() => expect(nameInput().value).toBe(""));
    expect((screen.getByPlaceholderText("What the term means") as HTMLTextAreaElement).value).toBe(
      "",
    );
    expect((screen.getByLabelText("Keep") as HTMLButtonElement).getAttribute("data-state")).toBe(
      "checked",
    );
    expect(screen.getByRole("button", { name: "Remove module Billing" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(nameInput()));

    fireEvent.change(nameInput(), { target: { value: "Receipt" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & add another" }));
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalledTimes(2));
    expect(lastPayload()).toMatchObject({ name: "Receipt", language: "en-US", rule: "keep" });
  });

  it("keeps the entered values when Save & add another fails (C3)", async () => {
    saveGlossaryAsync.mockResolvedValue({ success: false, errorMessage: "Nope" });
    renderSheet();
    fireEvent.change(nameInput(), { target: { value: "Invoice" } });
    fireEvent.click(screen.getByRole("button", { name: "Save & add another" }));
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(nameInput().value).toBe("Invoice");
  });

  it("does not offer Save & add another when editing", () => {
    renderSheet({ itemId: "g1", name: "Workspace", createDate: "", lastUpdateDate: "" });
    expect(screen.queryByRole("button", { name: "Save & add another" })).toBeNull();
  });

  it("suggests a missing translation into the input without saving (H8)", async () => {
    suggest.mockResolvedValue("Arbeitsbereich");
    renderSheet();
    fireEvent.change(nameInput(), { target: { value: "Workspace" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest German translation" }));
    await waitFor(() =>
      expect((screen.getByLabelText("German (de-DE)") as HTMLInputElement).value).toBe(
        "Arbeitsbereich",
      ),
    );
    expect(suggest).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Workspace", defaultLanguage: languages[0] }),
      languages[1],
    );
    expect(saveGlossaryAsync).not.toHaveBeenCalled();
  });

  it("Suggest all asks for every empty target only", () => {
    renderSheet();
    fireEvent.change(nameInput(), { target: { value: "Workspace" } });
    fireEvent.change(screen.getByLabelText("French (fr-FR)"), { target: { value: "Espace" } });
    fireEvent.click(screen.getByRole("button", { name: "Suggest all" }));
    expect(suggestAll).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Workspace" }),
      [languages[1]],
      expect.any(Function),
    );
  });

  it("offers no Suggest without a name or under Keep", () => {
    renderSheet();
    expect(screen.queryByRole("button", { name: "Suggest German translation" })).toBeNull();
    fireEvent.change(nameInput(), { target: { value: "SELISE" } });
    fireEvent.click(screen.getByLabelText("Keep"));
    expect(screen.queryByRole("button", { name: "Suggest all" })).toBeNull();
  });

  it("saves part of speech and usage examples (H22)", async () => {
    renderSheet();
    fireEvent.change(nameInput(), { target: { value: "Save" } });
    fireEvent.click(screen.getByRole("combobox", { name: "Part of speech" }));
    fireEvent.click(screen.getByRole("option", { name: "Verb" }));
    fireEvent.click(screen.getByRole("button", { name: "Add example" }));
    fireEvent.change(screen.getByLabelText("Usage example 1"), {
      target: { value: " Save your changes. " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add example" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({
      partOfSpeech: "verb",
      usageExamples: ["Save your changes."],
    });
  });

  it("sends empty values to clear a stored part of speech and examples", async () => {
    renderSheet({
      itemId: "g1",
      name: "Save",
      isGlobal: true,
      createDate: "",
      lastUpdateDate: "",
      partOfSpeech: "verb",
      usageExamples: ["Save it."],
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Part of speech" }));
    fireEvent.click(screen.getByRole("option", { name: "Not set" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove usage example 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveGlossaryAsync).toHaveBeenCalled());
    expect(lastPayload()).toMatchObject({ partOfSpeech: "", usageExamples: [] });
  });

  it("allows at most 5 usage examples", () => {
    renderSheet();
    for (let index = 0; index < 5; index++) {
      fireEvent.click(screen.getByRole("button", { name: "Add example" }));
    }
    expect(screen.queryByRole("button", { name: "Add example" })).toBeNull();
  });
});
