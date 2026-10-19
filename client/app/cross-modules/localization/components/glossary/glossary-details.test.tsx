import { fireEvent, screen } from "@testing-library/react";
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
vi.mock("@blocks-localization/components/modals/glossary/add-edit-glossary", () => ({
  default: () => null,
}));
vi.mock("@blocks-localization/components/modals/glossary/delete-glossary", () => ({
  default: () => null,
}));

const h = vi.mocked(hooks);

const setDefaults = () => {
  h.useGetLanguages.mockReturnValue({
    data: [{ languageCode: "en-US", languageName: "English", isDefault: true }],
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
    const names = screen
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
});
