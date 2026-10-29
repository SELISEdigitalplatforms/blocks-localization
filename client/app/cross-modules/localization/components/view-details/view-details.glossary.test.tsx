import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import ViewDetails from "./view-details";

const saveKey = vi.fn();
const editTranslationProps = vi.fn();

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (p: string) => `/scoped/${p}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(),
  useGetLanguageModules: vi.fn(),
  useGetLanguages: vi.fn(),
  useGetGlossaries: vi.fn(),
  useGetGlossariesByIds: vi.fn(() => []),
  useGetSuggestedGlossaries: vi.fn(),
  useGetGlobalGlossaries: vi.fn(),
  useGetModuleGlossaries: vi.fn(),
}));
vi.mock("../modals/edit-route/edit-route", () => ({ default: () => null }));
vi.mock("../modals/edit-translation/edit-translation", () => ({
  default: (props: unknown) => {
    editTranslationProps(props);
    return null;
  },
}));
vi.mock("../modals/edit-key-glossary/edit-key-glossary", () => ({
  default: () => null,
}));

const h = vi.mocked(hooks);

const term = (itemId: string, name: string, extra: Partial<IGlossary> = {}): IGlossary => ({
  itemId,
  name,
  createDate: "",
  lastUpdateDate: "",
  ...extra,
});

/** What the server's matcher suggests for the key (untagged, other modules, not Deprecated). */
const suggested = [
  term("g-other", "Customer Portal", { moduleIds: ["m2"] }),
  term("g-other2", "Dashboard"),
];
const suggest = (items: IGlossary[]) =>
  h.useGetSuggestedGlossaries.mockReturnValue({ data: { suggestedGlossaries: items } } as never);

const keyDetails = {
  itemId: "k1",
  keyName: "greeting",
  moduleId: "m1",
  routes: ["/home"],
  glossaryIds: ["g-tagged"],
  resources: [
    { culture: "de-DE", value: "Kundenportal" },
    { culture: "en-US", value: "Open the Workspace Settings in the Customer Portal Dashboard" },
  ],
  isPartiallyTranslated: false,
  createDate: "2026-01-01T00:00:00.000Z",
  lastUpdateDate: "2026-02-01T00:00:00.000Z",
  context: "Formal tone.",
} as never;

const setDefaults = () => {
  h.useSaveBlocksLanguageKey.mockReturnValue({ mutateAsync: saveKey } as never);
  h.useGetLanguageModules.mockReturnValue({ data: [{ itemId: "m1", moduleName: "M" }] } as never);
  h.useGetLanguages.mockReturnValue({
    isLoading: false,
    isFetching: false,
    data: [
      { itemId: "de", languageName: "German", languageCode: "de-DE", isDefault: false },
      { itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true },
    ],
  } as never);
  h.useGetGlossaries.mockReturnValue({
    data: { items: [{ itemId: "g-tagged", name: "Workspace" }] },
  } as never);
  suggest(suggested);
  h.useGetGlobalGlossaries.mockReturnValue({ data: { items: [] } } as never);
  h.useGetModuleGlossaries.mockReturnValue({ data: { items: [] } } as never);
  saveKey.mockResolvedValue({ success: true });
};

const expectedSave = (glossaryIds: string[]) => ({
  itemId: "k1",
  keyName: "greeting",
  moduleId: "m1",
  resources: [
    { culture: "de-DE", value: "Kundenportal" },
    { culture: "en-US", value: "Open the Workspace Settings in the Customer Portal Dashboard" },
  ],
  routes: ["/home"],
  context: "Formal tone.",
  glossaryIds,
  isPartiallyTranslated: false,
});

describe("view-details — glossary suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setDefaults();
  });

  describe("glossary-aware", () => {
    it("shows the server's suggestions although the key has tags (H9)", () => {
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      expect(h.useGetSuggestedGlossaries).toHaveBeenCalledWith("k1", true);
      expect(screen.queryByTitle("Tag to key")).toBeNull();

      expect(screen.getAllByText("Suggested")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Tag Customer Portal to key" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Tag Dashboard to key" })).toBeTruthy();
    });

    it("hides a suggestion the key is already tagged with", () => {
      suggest([...suggested, term("g-tagged", "Workspace")]);
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      expect(screen.queryByRole("button", { name: "Tag Workspace to key" })).toBeNull();
    });

    it("Add saves the full key with context, routes and resources unchanged (H11)", async () => {
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      fireEvent.click(screen.getByRole("button", { name: "Tag Customer Portal to key" }));
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(1));
      expect(saveKey.mock.calls[0][0]).toStrictEqual(expectedSave(["g-tagged", "g-other"]));
    });

    it("Add all tags every candidate in one save and disables the buttons meanwhile", async () => {
      let finish!: (value: unknown) => void;
      saveKey.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      const addAll = screen.getByRole("button", { name: "Add all suggested" }) as HTMLButtonElement;
      fireEvent.click(addAll);
      await waitFor(() => expect(addAll.disabled).toBe(true));
      expect(
        (screen.getByRole("button", { name: "Tag Dashboard to key" }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      finish({ success: true });
      // Every candidate is now tagged, so the section goes away (M1) instead of re-enabling.
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Add all suggested" })).toBeNull(),
      );
      expect(saveKey).toHaveBeenCalledTimes(1);
      expect(saveKey.mock.calls[0][0]).toStrictEqual(
        expectedSave(["g-tagged", "g-other", "g-other2"]),
      );
    });

    it("keeps a just-added tag when another is added before the key refetch lands (M1)", async () => {
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      fireEvent.click(screen.getByRole("button", { name: "Tag Customer Portal to key" }));
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(1));
      // The added term leaves the suggestions although keyDetails is still the old snapshot.
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Tag Customer Portal to key" })).toBeNull(),
      );
      const addDashboard = screen.getByRole("button", {
        name: "Tag Dashboard to key",
      }) as HTMLButtonElement;
      await waitFor(() => expect(addDashboard.disabled).toBe(false));
      fireEvent.click(addDashboard);
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(2));
      expect(saveKey.mock.calls[1][0]).toStrictEqual(
        expectedSave(["g-tagged", "g-other", "g-other2"]),
      );
    });

    it("Add all after Add keeps the earlier tag without duplicates (M1)", async () => {
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      fireEvent.click(screen.getByRole("button", { name: "Tag Customer Portal to key" }));
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(1));
      const addAll = screen.getByRole("button", { name: "Add all suggested" }) as HTMLButtonElement;
      await waitFor(() => expect(addAll.disabled).toBe(false));
      fireEvent.click(addAll);
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(2));
      expect(saveKey.mock.calls[1][0]).toStrictEqual(
        expectedSave(["g-tagged", "g-other", "g-other2"]),
      );
    });

    it("does not keep a tag whose save failed (M1)", async () => {
      saveKey.mockResolvedValueOnce({ success: false, errorMessage: "nope" });
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      fireEvent.click(screen.getByRole("button", { name: "Tag Customer Portal to key" }));
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(1));
      const addDashboard = screen.getByRole("button", {
        name: "Tag Dashboard to key",
      }) as HTMLButtonElement;
      await waitFor(() => expect(addDashboard.disabled).toBe(false));
      expect(screen.getByRole("button", { name: "Tag Customer Portal to key" })).toBeTruthy();
      fireEvent.click(addDashboard);
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(2));
      expect(saveKey.mock.calls[1][0]).toStrictEqual(expectedSave(["g-tagged", "g-other2"]));
    });

    it("drops the local tag once the refetched key has it, so a later removal shows again (M1)", async () => {
      const { rerender } = renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      fireEvent.click(screen.getByRole("button", { name: "Tag Customer Portal to key" }));
      await waitFor(() =>
        expect(screen.queryByRole("button", { name: "Tag Customer Portal to key" })).toBeNull(),
      );
      // The refetch lands with the tag.
      rerender(
        <ViewDetails
          keyDetails={{ ...(keyDetails as object), glossaryIds: ["g-tagged", "g-other"] } as never}
        />,
      );
      expect(screen.queryByRole("button", { name: "Tag Customer Portal to key" })).toBeNull();
      // The tag is later removed (e.g. in the Tag Glossary dialog): it is suggested again.
      rerender(<ViewDetails keyDetails={keyDetails} />);
      expect(screen.getByRole("button", { name: "Tag Customer Portal to key" })).toBeTruthy();
    });

    it("shows at most 10 suggestions plus a +N more text", () => {
      suggest(Array.from({ length: 12 }, (_, i) => term(`x${i}`, `Term${i}`)));
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      expect(screen.getAllByRole("button", { name: /^Tag Term\d+ to key$/ })).toHaveLength(10);
      expect(screen.getByText("+2 more suggested")).toBeTruthy();
    });

    it("hides the section when the server suggests nothing", () => {
      suggest([]);
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      expect(screen.queryByText("Suggested")).toBeNull();
    });

    it("passes no glossary loader to Edit translation (it asks /Glossary/Match itself)", () => {
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      expect(editTranslationProps).toHaveBeenCalled();
      expect(editTranslationProps.mock.calls[0][0]).not.toHaveProperty("loadGlossaries");
    });
  });

  describe("term cards (Phase 8 H12, C20)", () => {
    it("shows one merged list in Tagged, Module, Global, Suggested order, each term once", () => {
      h.useGetModuleGlossaries.mockReturnValue({
        data: { items: [term("g-mod", "Billing"), term("g-tagged", "Workspace")] },
      } as never);
      h.useGetGlobalGlossaries.mockReturnValue({
        data: { items: [term("g-glob", "SELISE"), term("g-mod", "Billing")] },
      } as never);
      suggest([term("g-other", "Customer Portal")]);
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      const list = screen.getByRole("list", { name: "Glossary terms for this key" });
      const cards = within(list).getAllByRole("listitem");
      expect(cards.map((card) => within(card).getByRole("link").textContent)).toEqual([
        "Workspace",
        "Billing",
        "SELISE",
        "Customer Portal",
      ]);
      expect(
        cards.map(
          (card) => within(card).getAllByText(/^(Tagged|Module|Global|Suggested)$/)[0].textContent,
        ),
      ).toEqual(["Tagged", "Module", "Global", "Suggested"]);
      expect(screen.getByText("These terms are applied when translating this key.")).toBeTruthy();
    });

    it("removes a tagged term with the full key payload unchanged otherwise (C20)", async () => {
      renderWithProviders(<ViewDetails keyDetails={keyDetails} />);
      fireEvent.click(screen.getByRole("button", { name: "Remove Workspace from key" }));
      await waitFor(() => expect(saveKey).toHaveBeenCalledTimes(1));
      expect(saveKey.mock.calls[0][0]).toStrictEqual(expectedSave([]));
    });
  });
});
