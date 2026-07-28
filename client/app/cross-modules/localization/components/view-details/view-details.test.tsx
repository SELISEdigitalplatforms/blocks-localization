import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import ViewDetails from "./view-details";

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetGlossaries: vi.fn(),
  useGetSuggestedGlossaries: vi.fn(),
  useGetGlobalGlossaries: vi.fn(),
  useGetModuleGlossaries: vi.fn(),
}));
vi.mock("../modals/edit-route/edit-route", () => ({ default: () => null }));
vi.mock("../modals/edit-translation/edit-translation", () => ({
  default: () => null,
}));
vi.mock("../modals/edit-key-glossary/edit-key-glossary", () => ({
  default: () => null,
}));

const h = vi.mocked(hooks);

const languages = [
  { itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "de", languageName: "German", languageCode: "de-DE", isDefault: false },
];

const keyDetails = {
  itemId: "k1",
  keyName: "greeting",
  moduleId: "m1",
  routes: ["/home"],
  glossaryIds: [],
  resources: [
    { culture: "en-US", value: "Hello" },
    { culture: "de-DE", value: "Hallo" },
  ],
  isPartiallyTranslated: false,
  createDate: "2026-01-01T00:00:00.000Z",
  lastUpdateDate: "2026-02-01T00:00:00.000Z",
  context: "A greeting",
} as never;

const setDefaults = () => {
  h.useSaveBlocksLanguageKey.mockReturnValue({ mutateAsync: vi.fn() } as never);
  h.useGetLanguageModules.mockReturnValue({
    data: [{ itemId: "m1", moduleName: "UILM" }],
  } as never);
  h.useGetGlossaries.mockReturnValue({ data: { items: [] } } as never);
  h.useGetSuggestedGlossaries.mockReturnValue({ data: undefined } as never);
  h.useGetGlobalGlossaries.mockReturnValue({ data: { items: [] } } as never);
  h.useGetModuleGlossaries.mockReturnValue({ data: { items: [] } } as never);
};

describe("components/view-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  it("should show a skeleton while languages load", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: true,
      isFetching: true,
      data: undefined,
    } as never);
    const { container } = renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
    expect(container.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("should render translations, module, context and dates", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: languages,
    } as never);
    renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
    expect(screen.getByText("Hello")).toBeTruthy();
    expect(screen.getByText("Hallo")).toBeTruthy();
    expect(screen.getByText("UILM")).toBeTruthy();
    expect(screen.getByText("A greeting")).toBeTruthy();
    expect(screen.getByText("/home")).toBeTruthy();
    // "No glossary added." shown because glossaryIds is empty.
    expect(screen.getByText("No glossary added.")).toBeTruthy();
  });

  it("should render tagged glossaries when the key has glossaryIds", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: languages,
    } as never);
    h.useGetGlossaries.mockReturnValue({
      data: { items: [{ itemId: "gl1", name: "Widget" }] },
    } as never);
    renderWithProviders(<ViewDetails keyDetails={{ ...keyDetails, glossaryIds: ["gl1"] }} />);
    expect(screen.getByText("Widget")).toBeTruthy();
  });

  it("should fall back to placeholders for missing translations/dates", () => {
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      isFetching: false,
      data: languages,
    } as never);
    renderWithProviders(
      <ViewDetails
        keyDetails={{
          ...keyDetails,
          resources: [],
          createDate: "",
          lastUpdateDate: "",
        }}
      />,
    );
    expect(screen.getAllByText("No translation available").length).toBeGreaterThan(0);
  });
});
