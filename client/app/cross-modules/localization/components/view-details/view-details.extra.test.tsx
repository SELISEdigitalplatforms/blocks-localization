import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import ViewDetails from "./view-details";

const saveKey = vi.fn();

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
  resources: [{ culture: "en-US", value: "Hello" }],
  isPartiallyTranslated: false,
  createDate: "2026-01-01T00:00:00.000Z",
  lastUpdateDate: "2026-02-01T00:00:00.000Z",
  context: "A greeting",
} as never;

const setDefaults = () => {
  h.useSaveBlocksLanguageKey.mockReturnValue({ mutateAsync: saveKey } as never);
  h.useGetLanguageModules.mockReturnValue({
    data: [{ itemId: "m1", moduleName: "UILM" }],
  } as never);
  h.useGetLanguages.mockReturnValue({
    isLoading: false,
    isFetching: false,
    data: languages,
  } as never);
  h.useGetGlossaries.mockReturnValue({ data: { items: [] } } as never);
  h.useGetSuggestedGlossaries.mockReturnValue({ data: undefined } as never);
  h.useGetGlobalGlossaries.mockReturnValue({ data: { items: [] } } as never);
  h.useGetModuleGlossaries.mockReturnValue({ data: { items: [] } } as never);
};

describe("view-details (extra coverage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  it("renders global and module context glossaries when the key is untagged", () => {
    h.useGetGlobalGlossaries.mockReturnValue({
      data: { items: [{ itemId: "gg1", name: "GlobalTerm" }] },
    } as never);
    h.useGetModuleGlossaries.mockReturnValue({
      data: { items: [{ itemId: "mg1", name: "ModuleTerm" }] },
    } as never);
    renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
    expect(screen.getByText("GlobalTerm")).toBeTruthy();
    expect(screen.getByText("ModuleTerm")).toBeTruthy();
    expect(screen.getAllByText(/Global & module glossaries/).length).toBeGreaterThan(0);
  });

  it("renders context glossaries alongside tagged glossaries", () => {
    h.useGetGlossaries.mockReturnValue({
      data: { items: [{ itemId: "gl1", name: "TaggedTerm" }] },
    } as never);
    h.useGetGlobalGlossaries.mockReturnValue({
      data: { items: [{ itemId: "gg1", name: "GlobalTerm" }] },
    } as never);
    renderWithProviders(<ViewDetails keyDetails={{ ...keyDetails, glossaryIds: ["gl1"] }} />);
    expect(screen.getByText("TaggedTerm")).toBeTruthy();
    expect(screen.getByText("GlobalTerm")).toBeTruthy();
  });

  it("does not duplicate a glossary that is already tagged", () => {
    h.useGetGlossaries.mockReturnValue({
      data: { items: [{ itemId: "gl1", name: "TaggedTerm" }] },
    } as never);
    // The same id appears as a global glossary but should be filtered out.
    h.useGetGlobalGlossaries.mockReturnValue({
      data: { items: [{ itemId: "gl1", name: "TaggedTerm" }] },
    } as never);
    renderWithProviders(<ViewDetails keyDetails={{ ...keyDetails, glossaryIds: ["gl1"] }} />);
    // Only the tagged badge renders it once.
    expect(screen.getAllByText("TaggedTerm").length).toBe(1);
  });

  it("renders suggested glossaries and tags one to the key", async () => {
    h.useGetSuggestedGlossaries.mockReturnValue({
      data: { suggestedGlossaries: [{ itemId: "sg1", name: "SuggestedTerm" }] },
    } as never);
    renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
    expect(screen.getByText("Suggested glossaries")).toBeTruthy();
    expect(screen.getByText("SuggestedTerm")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Tag to key"));
    await waitFor(() => expect(saveKey).toHaveBeenCalled());
    expect(saveKey).toHaveBeenCalledWith(expect.objectContaining({ glossaryIds: ["sg1"] }));
  });
});
