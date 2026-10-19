import { fireEvent, screen, within } from "@testing-library/react";
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

  it("should request tagged keys by glossary id with page 0 and size 10", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01", moduleIds: ["m1"] },
      isLoading: false,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    expect(h.useGetKeysByGlossaryId).toHaveBeenLastCalledWith("g1", 0, 10);
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
    expect(h.useGetKeysByGlossaryId).toHaveBeenLastCalledWith("g1", 1, 10);
  });

  it("should show an error state when tagged keys fail to load", () => {
    h.useGetGlossaryById.mockReturnValue({
      data: { itemId: "g1", name: "Widget", createDate: "2026-01-01" },
      isLoading: false,
    } as never);
    h.useGetKeysByGlossaryId.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as never);
    renderWithProviders(<GlossaryDetails itemId="g1" />, {
      route: "/app/abc/services/glossary/g1",
    });
    expect(screen.getByText("Failed to load tagged keys.")).toBeTruthy();
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

    it("should show rule, scope and case-sensitive badges instead of Is Global (H9)", () => {
      renderGlossary({
        isGlobal: true,
        additionalNote:
          '@@glossary-meta:v1@@{"rule":"keep","caseSensitive":true,"variants":["SELISE AG"]}',
      });
      expect(screen.getByText("Keep")).toBeTruthy();
      expect(screen.getByText("Whole project")).toBeTruthy();
      expect(screen.getByText("Case-sensitive")).toBeTruthy();
      expect(screen.getByText("SELISE AG")).toBeTruthy();
      expect(screen.queryByText("Is Global")).toBeNull();
      expect(screen.getByText("Kept as-is in all languages.")).toBeTruthy();
    });

    it("should show the module count as scope and hide case-sensitive when unset", () => {
      renderGlossary({ isGlobal: false, moduleIds: ["m1"] });
      expect(screen.getByText("1 module")).toBeTruthy();
      expect(screen.queryByText("Case-sensitive")).toBeNull();
    });

    it("should show the Translations card first with values, Missing and forbidden (H7, H9)", () => {
      renderGlossary({
        additionalNote:
          '@@glossary-meta:v1@@{"rule":"translate","translations":{"de-DE":"Arbeitsbereich"},"forbidden":{"de-DE":["Werkbereich"]}}',
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
});
