import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import GlossaryDetails from "./glossary-details";

const navigate = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@seliseblocks/genesis-os", () => ({
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useGetGlossaryById: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useGetKeysByGlossaryId: vi.fn(),
  useRecheckGlossary: vi.fn(),
  useSaveGlossary: vi.fn(),
  useFetchLatestGlossary: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-glossary-term-suggestion", () => ({
  useGlossaryTermSuggestion: () => ({ suggest: vi.fn(), pendingCodes: new Set() }),
}));
vi.mock("@blocks-localization/components/modals/glossary/glossary-editor-sheet", () => ({
  default: ({ trigger }: { trigger?: React.ReactNode }) => <>{trigger}</>,
}));
vi.mock("@blocks-localization/components/modals/glossary/delete-glossary", () => ({
  default: () => null,
}));

const h = vi.mocked(hooks);

const setDefaults = () => {
  h.useGetLanguages.mockReturnValue({
    data: [
      { languageCode: "en-US", languageName: "English", isDefault: true },
      { languageCode: "de-DE", languageName: "German" },
      { languageCode: "fr-FR", languageName: "French" },
    ],
  } as never);
  h.useGetLanguageModules.mockReturnValue({
    data: [{ itemId: "m1", moduleName: "UILM" }],
  } as never);
  h.useGetKeysByGlossaryId.mockReturnValue({
    data: { keys: [], totalCount: 0 },
    isLoading: false,
    isError: false,
  } as never);
  h.useRecheckGlossary.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  h.useSaveGlossary.mockReturnValue({ mutateAsync: vi.fn(), isPending: false } as never);
  h.useFetchLatestGlossary.mockReturnValue(vi.fn() as never);
};

describe("components/glossary/glossary-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  it("should render skeletons while loading", () => {
    h.useGetGlossaryById.mockReturnValue({ data: undefined, isLoading: true } as never);
    const { container } = renderWithProviders(<GlossaryDetails itemId="g1" />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("should render a not-found message when the glossary is absent", () => {
    h.useGetGlossaryById.mockReturnValue({ data: undefined, isLoading: false } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />);
    expect(screen.getByText("Glossary item not found.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to glossary" }));
    expect(navigate).toHaveBeenCalledWith("/scoped/services/glossary");
  });

  it("should render glossary details with tagged modules", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: {
        itemId: "g1",
        name: "Widget",
        language: "en-US",
        type: "Acronym",
        isGlobal: true,
        context: "some context",
        additionalNote: "a note",
        createDate: "2026-01-01",
        moduleIds: ["m1"],
      },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    // "Widget" also appears in the breadcrumb, so target the heading.
    expect(screen.getByRole("heading", { name: "Widget" })).toBeTruthy();
    expect(screen.getByText("English")).toBeTruthy();
    expect(screen.getByText("some context")).toBeTruthy();
    expect(screen.getByText("a note")).toBeTruthy();
    // Tagged module badge resolves to the module name.
    expect(screen.getByText("UILM")).toBeTruthy();
    // Empty tagged keys state.
    expect(screen.getByText("No keys are tagged with this glossary.")).toBeTruthy();
  });

  it("should label empty fields instead of leaving them blank", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: {
        itemId: "g1",
        name: "Customer Portal",
        language: "",
        type: "",
        isGlobal: false,
        context: "  ",
        createDate: "not-a-date",
        lastUpdateDate: "",
        moduleIds: [],
      },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />);
    // Language, Type, Part of speech, Created on and Last updated.
    expect(screen.getAllByText("Not provided")).toHaveLength(5);
    expect(screen.getByText("No modules tagged.")).toBeTruthy();
    expect(screen.getByText("No definition provided.")).toBeTruthy();
    expect(screen.getByText("No internal note.")).toBeTruthy();
  });

  it("should render tagged keys and navigate on row click", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01", moduleIds: ["m1"] },
      isLoading: false,
    } as never);
    h.useGetKeysByGlossaryId.mockReturnValue({
      data: {
        keys: [
          {
            itemId: "k1",
            keyName: "greeting",
            moduleId: "m1",
            resources: [{ culture: "en-US", value: "Hello" }],
          },
        ],
        totalCount: 1,
      },
      isLoading: false,
      isError: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    fireEvent.click(screen.getByText("greeting"));
    expect(navigate).toHaveBeenCalledWith("/scoped/services/language/translations/k1");
  });

  it("should open a tagged key with Enter on the focused row (H11)", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01", moduleIds: ["m1"] },
      isLoading: false,
    } as never);
    h.useGetKeysByGlossaryId.mockReturnValue({
      data: {
        keys: [{ itemId: "k1", keyName: "greeting", moduleId: "m1", resources: [] }],
        totalCount: 1,
      },
      isLoading: false,
      isError: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    const row = screen.getByText("greeting").closest("tr")!;
    expect(row.getAttribute("tabindex")).toBe("0");
    fireEvent.keyDown(screen.getByText("greeting"), { key: "Enter" });
    expect(navigate).not.toHaveBeenCalled();
    fireEvent.keyDown(row, { key: "Enter" });
    expect(navigate).toHaveBeenCalledWith("/scoped/services/language/translations/k1");
  });

  it("should request tagged keys by glossary id with page 0 and size 10", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01", moduleIds: ["m1"] },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    expect(h.useGetKeysByGlossaryId).toHaveBeenLastCalledWith("g1", 0, 10, {
      searchKey: "",
      moduleIds: [],
    });
  });

  it("should show the empty state (not the error) for a global-only glossary", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01", isGlobal: true },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    expect(screen.getByText("No keys are tagged with this glossary.")).toBeTruthy();
    expect(screen.queryByText("Failed to load tagged keys.")).toBeNull();
  });

  it("should list keys in server order and page through the shared Pagination", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01", isGlobal: true },
      isLoading: false,
    } as never);
    h.useGetKeysByGlossaryId.mockReturnValue({
      data: {
        keys: [
          { itemId: "k2", keyName: "zeta", moduleId: "m1", resources: [] },
          { itemId: "k1", keyName: "alpha", moduleId: "m1", resources: [] },
        ],
        totalCount: 25,
      },
      isLoading: false,
      isError: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    const taggedKeysTable = screen.getByText("Key Name").closest("table")!;
    const names = within(taggedKeysTable)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(names[0]).toContain("zeta");
    expect(names[1]).toContain("alpha");
    expect(screen.getByText("25 keys total")).toBeTruthy();
    expect(screen.getByText("Page 1 of 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(h.useGetKeysByGlossaryId).toHaveBeenLastCalledWith("g1", 1, 10, {
      searchKey: "",
      moduleIds: [],
    });
  });

  it("should show an error state when tagged keys fail to load", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01" },
      isLoading: false,
    } as never);
    const refetch = vi.fn();
    h.useGetKeysByGlossaryId.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    expect(screen.getByText("Failed to load tagged keys.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
    // The rest of the page stays usable.
    expect(screen.getByRole("heading", { name: "Widget" })).toBeTruthy();
    expect(screen.getByText("Edit")).toBeTruthy();
  });

  describe("terminology display", () => {
    const renderGlossary = (overrides: Record<string, unknown>) => {
      h.useGetGlossaryById.mockReturnValue({
        data: { itemId: "g1", name: "Workspace", createDate: "2026-01-01", ...overrides },
        isLoading: false,
      } as never);
      return renderWithProviders(<GlossaryDetails itemId="g1" />, {
        route: "/app/abc/services/glossary/g1",
      });
    };

    it("should show rule and scope badges instead of Is Global (H9)", () => {
      renderGlossary({
        isGlobal: true,
        rule: "keep",
        caseSensitive: true,
        variants: ["SELISE AG"],
      });
      expect(screen.getByText("Keep")).toBeTruthy();
      expect(screen.getByText("Whole project")).toBeTruthy();
      expect(screen.queryByText("Is Global")).toBeNull();
      expect(screen.getByText("Kept as-is in all languages.")).toBeTruthy();
    });

    it("should show the Case-sensitive badge and Variants chips (H14)", () => {
      renderGlossary({
        isGlobal: true,
        rule: "keep",
        caseSensitive: true,
        variants: ["SELISE AG", "Selise"],
      });
      expect(screen.getByText("Keep")).toBeTruthy();
      expect(screen.getByText("Whole project")).toBeTruthy();
      expect(screen.getByText("Case-sensitive")).toBeTruthy();
      expect(screen.getByText("Variants:")).toBeTruthy();
      expect(screen.getByText("SELISE AG")).toBeTruthy();
      expect(screen.getByText("Selise")).toBeTruthy();
    });

    it("should render duplicate stored variants without duplicate React keys (m7)", () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      try {
        renderGlossary({
          isGlobal: true,
          rule: "keep",
          variants: ["workspaces", "workspaces"],
        });
        expect(screen.getAllByText("workspaces")).toHaveLength(2);
        const keyWarnings = consoleError.mock.calls.filter((args) =>
          args.some((arg) => String(arg).includes("same key")),
        );
        expect(keyWarnings).toEqual([]);
      } finally {
        consoleError.mockRestore();
      }
    });

    it("should hide the Case-sensitive badge and Variants row when unset (H14)", () => {
      renderGlossary({
        isGlobal: false,
        moduleIds: ["m1"],
        rule: "translate",
        caseSensitive: false,
      });
      expect(screen.getByText("1 module")).toBeTruthy();
      expect(screen.queryByText("Case-sensitive")).toBeNull();
      expect(screen.queryByText("Variants:")).toBeNull();
    });

    it("should show the module count as scope", () => {
      renderGlossary({ isGlobal: false, moduleIds: ["m1"] });
      expect(screen.getByText("1 module")).toBeTruthy();
    });

    it("should show the Translations card first with values, Missing and forbidden (H7, H9)", () => {
      renderGlossary({
        rule: "translate",
        translations: [
          { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] },
        ],
      });
      const titles = screen
        .getAllByText(/^(Translations|Details|Definition|Internal Note|Tagged Keys)$/)
        .map((element) => element.textContent);
      expect(titles[0]).toBe("Translations");
      expect(screen.getByText("German (de-DE)")).toBeTruthy();
      expect(screen.getByText("Arbeitsbereich")).toBeTruthy();
      expect(screen.getByText("Werkbereich")).toBeTruthy();
      expect(screen.getByText("French (fr-FR)")).toBeTruthy();
      expect(screen.getByText("Missing")).toBeTruthy();
      expect(screen.queryByText("English (en-US)")).toBeNull();
    });

    it("should show the definition without the marker and the parsed internal note (H8)", () => {
      renderGlossary({
        context: "A container. ⟦rule: de-DE→Arbeitsbereich⟧",
        additionalNote: '@@glossary-meta:v1@@{"rule":"translate","note":"team only"}',
      });
      expect(screen.getByText("A container.")).toBeTruthy();
      expect(screen.queryByText(/⟦rule/)).toBeNull();
      expect(screen.getByText("team only")).toBeTruthy();
      expect(screen.queryByText(/@@glossary-meta/)).toBeNull();
    });

    it("should show a migrated term's note and translations from the API fields (H14, C15)", () => {
      renderGlossary({
        schemaVersion: 2,
        additionalNote: "Approved by marketing",
        rule: "translate",
        translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: [] }],
      });
      expect(screen.getByText("Approved by marketing")).toBeTruthy();
      expect(screen.getByText("Arbeitsbereich")).toBeTruthy();
      expect(screen.getByText("Translate")).toBeTruthy();
    });

    it("should show the note inside the JSON of a Track A save, never the raw JSON (Example 8)", () => {
      renderGlossary({
        schemaVersion: 2,
        rule: "keep",
        additionalNote: '@@glossary-meta:v1@@{"rule":"keep","note":"brand"}',
      });
      expect(screen.getByText("brand")).toBeTruthy();
      expect(screen.getByText("Keep")).toBeTruthy();
      expect(screen.queryByText(/@@glossary-meta/)).toBeNull();
    });

    it.each([
      [undefined, "Approved"],
      ["draft", "Draft"],
      ["deprecated", "Deprecated"],
    ])("should show the %s status badge in the header (C12)", (status, label) => {
      renderGlossary({ status });
      expect(screen.getByText(label)).toBeTruthy();
    });

    it("should keep showing a legacy plain note", () => {
      renderGlossary({ additionalNote: "legacy note" });
      expect(screen.getByText("legacy note")).toBeTruthy();
      expect(screen.getByText("Translate")).toBeTruthy();
    });

    it("should not guess the terminology of a newer format", () => {
      renderGlossary({ additionalNote: "@@glossary-meta:v2@@{}" });
      expect(screen.queryByText("Translate")).toBeNull();
      expect(
        screen.getByText("This term was saved by a newer version and can't be shown here."),
      ).toBeTruthy();
    });
  });

  describe("Phase 8", () => {
    const glossary = {
      itemId: "g1",
      name: "Workspace",
      language: "en-US",
      type: "Phrase",
      context: "Where a team works",
      additionalNote: "",
      isGlobal: true,
      moduleIds: [],
      createDate: "2026-01-01",
      lastUpdateDate: "2026-01-02",
      version: 3,
      rule: "translate",
      caseSensitive: false,
      variants: [],
      translations: [
        { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] },
      ],
      status: "approved",
    };

    const renderDetails = (overrides: Record<string, unknown> = {}) => {
      h.useGetGlossaryById.mockReturnValue({
        data: { ...glossary, ...overrides },
        isLoading: false,
      } as never);
      return renderWithProviders(<GlossaryDetails itemId="g1" />, {
        route: "/app/abc/services/glossary/g1",
      });
    };

    it("puts Delete, Deprecate and Re-check in a More actions menu and keeps Edit visible (H6)", async () => {
      const user = userEvent.setup();
      renderDetails();
      expect(screen.getByRole("button", { name: "Edit" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "More actions" }));
      expect(screen.getByRole("menuitem", { name: /Delete/ })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Deprecate/ })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: /Re-check keys/ })).toBeTruthy();
    });

    it("queues a re-check and hides the action after a permission error", async () => {
      const user = userEvent.setup();
      const mutateAsync = vi
        .fn()
        .mockResolvedValueOnce({ queued: true })
        .mockRejectedValueOnce({ status: 403 });
      h.useRecheckGlossary.mockReturnValue({ mutateAsync, isPending: false } as never);
      renderDetails();
      await user.click(screen.getByRole("button", { name: "More actions" }));
      await user.click(screen.getByRole("menuitem", { name: /Re-check keys/ }));
      expect(mutateAsync).toHaveBeenCalledWith({ itemId: "g1" });
      await user.click(screen.getByRole("button", { name: "More actions" }));
      await user.click(screen.getByRole("menuitem", { name: /Re-check keys/ }));
      await user.click(screen.getByRole("button", { name: "More actions" }));
      expect(screen.queryByRole("menuitem", { name: /Re-check keys/ })).toBeNull();
    });

    it("searches and filters Tagged Keys after a 300 ms pause, from page 0 (H4)", () => {
      vi.useFakeTimers();
      try {
        renderDetails();
        fireEvent.change(screen.getByRole("textbox", { name: "Search keys" }), {
          target: { value: " e2e.ws " },
        });
        act(() => vi.advanceTimersByTime(299));
        expect(h.useGetKeysByGlossaryId).not.toHaveBeenLastCalledWith("g1", 0, 10, {
          searchKey: "e2e.ws",
          moduleIds: [],
        });
        act(() => vi.advanceTimersByTime(1));
        expect(h.useGetKeysByGlossaryId).toHaveBeenLastCalledWith("g1", 0, 10, {
          searchKey: "e2e.ws",
          moduleIds: [],
        });
      } finally {
        vi.useRealTimers();
      }
    });

    it("shows each tagged key's value in the chosen target language and its issues (H5, H21)", () => {
      h.useGetKeysByGlossaryId.mockReturnValue({
        data: {
          totalCount: 1,
          keys: [
            {
              itemId: "k1",
              keyName: "app.workspace",
              moduleId: "m1",
              resources: [
                { culture: "en-US", value: "Open your Workspace" },
                { culture: "de-DE", value: "Öffne deinen Werkbereich" },
              ],
              glossaryViolations: [
                {
                  culture: "de-DE",
                  glossaryId: "g1",
                  term: "Workspace",
                  kind: "forbidden-used",
                  found: "Werkbereich",
                  detectedAt: "2026-01-01",
                },
                {
                  culture: "de-DE",
                  glossaryId: "other",
                  term: "Other",
                  kind: "forbidden-used",
                  found: "x",
                  detectedAt: "2026-01-01",
                },
              ],
            },
          ],
        },
        isLoading: false,
        isError: false,
      } as never);
      renderDetails();
      expect(screen.getByRole("columnheader", { name: "German" })).toBeTruthy();
      expect(screen.getByText("Öffne deinen Werkbereich")).toBeTruthy();
      expect(screen.getAllByText("Issue")).toHaveLength(1);
    });

    it("saves one edited translation with the full term and its version (H20)", async () => {
      const user = userEvent.setup();
      const mutateAsync = vi.fn().mockResolvedValue({ success: true });
      h.useSaveGlossary.mockReturnValue({ mutateAsync, isPending: false } as never);
      renderDetails();
      await user.click(screen.getByRole("button", { name: "Edit French translation" }));
      await user.type(screen.getByRole("textbox", { name: "French translation" }), "Espace");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: "g1",
          name: "Workspace",
          type: "Phrase",
          isGlobal: true,
          version: 3,
          status: "approved",
          translations: [
            { language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] },
            { language: "fr-FR", value: "Espace", forbiddenValues: [] },
          ],
        }),
      );
    });

    it("keeps the edited value and offers Reload latest on a version conflict (C11)", async () => {
      const user = userEvent.setup();
      const fetchLatest = vi.fn().mockResolvedValue({});
      h.useFetchLatestGlossary.mockReturnValue(fetchLatest as never);
      h.useSaveGlossary.mockReturnValue({
        mutateAsync: vi.fn().mockResolvedValue({
          success: false,
          validationErrors: [{ propertyName: "Version", errorMessage: "Changed" }],
        }),
        isPending: false,
      } as never);
      renderDetails();
      await user.click(screen.getByRole("button", { name: "Edit French translation" }));
      await user.type(screen.getByRole("textbox", { name: "French translation" }), "Espace");
      await user.click(screen.getByRole("button", { name: "Save" }));
      expect(await screen.findByText(/changed by someone else/)).toBeTruthy();
      expect(
        (screen.getByRole("textbox", { name: "French translation" }) as HTMLInputElement).value,
      ).toBe("Espace");
      await user.click(screen.getByRole("button", { name: "Reload latest" }));
      await waitFor(() => expect(fetchLatest).toHaveBeenCalledWith("g1"));
    });

    it("shows the part of speech and usage examples (H22)", () => {
      renderDetails({ partOfSpeech: "noun", usageExamples: ["Open your workspace."] });
      expect(screen.getByText("Noun")).toBeTruthy();
      expect(screen.getByText("Open your workspace.")).toBeTruthy();
    });
  });
});
