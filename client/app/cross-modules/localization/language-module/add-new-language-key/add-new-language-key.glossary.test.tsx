import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { matchResponse } from "@blocks-localization/test-utils/helpers/glossary-matches";
import { AddNewLanguageKey } from "./add-new-language-key";

const suggestAsync = vi.fn();

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useNavigate: () => vi.fn(),
}));
vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
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
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { matchGlossary: vi.fn() },
}));

const h = vi.mocked(hooks);
const matchGlossary = vi.mocked(languageManagerService.matchGlossary);

const APPLIED_G1 = [
  { glossaryId: "g1", term: "Workspace", rule: "translate", expected: "Arbeitsbereich" },
];
const FORBIDDEN = {
  glossaryId: "g1",
  term: "Workspace",
  kind: "forbidden-used",
  found: "Werkbereich",
};
const MISSING = {
  glossaryId: "g1",
  term: "Workspace",
  kind: "missing-translation",
  expected: "Arbeitsbereich",
};
const route = "/app/abc/services/language/translations/new-key";

const G1: IGlossary = {
  itemId: "g1",
  name: "Workspace",
  isGlobal: true,
  createDate: "",
  lastUpdateDate: "",
  additionalNote:
    GLOSSARY_META_PREFIX +
    JSON.stringify({
      rule: "translate",
      translations: { "de-DE": "Arbeitsbereich" },
      forbidden: { "de-DE": ["Werkbereich"] },
    }),
};
// Module-scoped: applies only when the form's module is selected.
const G3: IGlossary = {
  itemId: "g3",
  name: "Portal",
  moduleIds: ["m1"],
  createDate: "",
  lastUpdateDate: "",
  additionalNote:
    GLOSSARY_META_PREFIX +
    JSON.stringify({ rule: "translate", translations: { "de-DE": "Portal" } }),
};

const fillDefault = (value: string) =>
  fireEvent.change(screen.getByPlaceholderText("Enter default value"), { target: { value } });
const autoButtons = () => screen.getAllByRole("button", { name: /Auto-Translate|Loading/ });
const translationFields = () =>
  screen.getAllByPlaceholderText("Enter translation") as HTMLTextAreaElement[];

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

/**
 * No violation list and no info line. The polite live region stays mounted while empty, so
 * this checks that every status region is empty instead of that none exists.
 */
/** No row reports a glossary issue ("All glossary terms followed" is fine). */
const expectNoGlossaryIssues = () =>
  expect(
    screen.queryAllByRole("status").filter((region) => /issue/.test(region.textContent ?? "")),
  ).toEqual([]);

const glossaryRegion = (language: string) =>
  screen.findByRole("region", { name: `Glossary terms for ${language}` });

describe("add-new-language-key — glossary-aware suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchGlossary.mockImplementation(async (request) =>
      matchResponse([G1, G3], request.text, { moduleId: request.moduleId }),
    );
    h.useGetLanguageModules.mockReturnValue({
      isLoading: false,
      data: [{ itemId: "m1", moduleName: "UILM" }],
    } as never);
    // Not default-first on purpose.
    h.useGetLanguages.mockReturnValue({
      isLoading: false,
      data: [
        { languageCode: "de-DE", languageName: "German", isDefault: false },
        { languageCode: "en-US", languageName: "English", isDefault: true },
        { languageCode: "fr-FR", languageName: "French", isDefault: false },
      ],
    } as never);
    h.useGetTranslationSuggestion.mockReturnValue({ mutateAsync: suggestAsync } as never);
    h.useSaveBlocksLanguageKey.mockReturnValue({ isPending: false, mutateAsync: vi.fn() } as never);
  });

  it("keeps exactly one Auto-Translate button per row", () => {
    renderWithProviders(<AddNewLanguageKey />, { route });
    expect(screen.getAllByRole("button", { name: /Auto-Translate/ })).toHaveLength(2);
  });

  describe("glossary-aware", () => {
    it("sends one request with the form context and module (H4)", async () => {
      suggestAsync.mockResolvedValue({ content: "Öffnen Sie Ihr Arbeitsbereich Portal" });
      renderWithProviders(<AddNewLanguageKey />, { route });
      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.click(screen.getByRole("option", { name: /UILM/ }));
      fillDefault("Open your Workspace Portal");
      fireEvent.change(screen.getByPlaceholderText("Enter key context (optional)"), {
        target: { value: "Formal tone." },
      });
      fireEvent.click(autoButtons()[0]);
      await waitFor(() =>
        expect(translationFields()[0].value).toBe("Öffnen Sie Ihr Arbeitsbereich Portal"),
      );
      expect(suggestAsync).toHaveBeenCalledTimes(1);
      expect(suggestAsync.mock.calls[0][0]).toStrictEqual({
        sourceText: "Open your Workspace Portal",
        destinationLanguage: "German",
        currentLanguage: "English",
        currentLanguageCode: "en-US",
        temperature: 0.1,
        elementDetailContext: "Formal tone.",
        glossaryIds: [],
        moduleId: "m1",
        destinationLanguageCode: "de-DE",
      });
    });

    it("lists the server's violations under the row; Fix and editing update it (H5, C11)", async () => {
      suggestAsync.mockResolvedValue({
        content: "Öffnen Sie Ihren Werkbereich",
        appliedTerms: APPLIED_G1,
        glossaryViolations: [MISSING, FORBIDDEN],
      });
      renderWithProviders(<AddNewLanguageKey />, { route });
      fillDefault("Open your Workspace");
      await glossaryRegion("German");
      fireEvent.click(autoButtons()[0]);
      await screen.findByText(/"Werkbereich" is not allowed/);
      expect(suggestAsync).toHaveBeenCalledTimes(1);
      expect(translationFields()[0].value).toBe("Öffnen Sie Ihren Werkbereich");
      expect(screen.getByText("Not used yet")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Fix" }));
      expect(translationFields()[0].value).toBe("Öffnen Sie Ihren Arbeitsbereich");
      expectNoGlossaryIssues();

      fireEvent.click(autoButtons()[0]);
      await screen.findByText(/"Werkbereich" is not allowed/);
      fireEvent.change(translationFields()[0], { target: { value: "Hallo" } });
      expectNoGlossaryIssues();
    });

    it("Retry re-sends the row's one request", async () => {
      suggestAsync
        .mockResolvedValueOnce({
          content: "Öffnen Sie Ihren Bereich",
          appliedTerms: APPLIED_G1,
          glossaryViolations: [MISSING],
        })
        .mockResolvedValueOnce({
          content: "Öffnen Sie Ihren Arbeitsbereich",
          appliedTerms: APPLIED_G1,
        });
      renderWithProviders(<AddNewLanguageKey />, { route });
      fillDefault("Open your Workspace");
      await glossaryRegion("German");
      fireEvent.click(autoButtons()[0]);
      fireEvent.click(await screen.findByRole("button", { name: "Retry" }));
      await waitFor(() =>
        expect(translationFields()[0].value).toBe("Öffnen Sie Ihren Arbeitsbereich"),
      );
      expect(suggestAsync).toHaveBeenCalledTimes(2);
      expectNoGlossaryIssues();
    });

    it("disables only the running row and drops its response after unmount (C22)", async () => {
      const german = deferred<{ content: string }>();
      suggestAsync.mockImplementation(({ destinationLanguageCode }) =>
        destinationLanguageCode === "de-DE"
          ? german.promise
          : Promise.resolve({ content: "Ouvrez votre espace" }),
      );
      const { unmount } = renderWithProviders(<AddNewLanguageKey />, { route });
      fillDefault("Hello");
      fireEvent.click(autoButtons()[0]);
      await waitFor(() => expect((autoButtons()[0] as HTMLButtonElement).disabled).toBe(true));
      expect(autoButtons()[0].textContent).toContain("Loading...");
      expect((autoButtons()[1] as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(autoButtons()[1]);
      await waitFor(() => expect(translationFields()[1].value).toBe("Ouvrez votre espace"));
      expect((autoButtons()[0] as HTMLButtonElement).disabled).toBe(true);

      unmount();
      await act(async () => german.resolve({ content: "Hallo" }));
      expect(suggestAsync).toHaveBeenCalledTimes(2);
    });
  });

  describe("per-language glossary checklist and live checks (Phase 4)", () => {
    it("matches the default value without a key, 300 ms after typing stops (C18)", async () => {
      renderWithProviders(<AddNewLanguageKey />, { route });
      for (const value of ["O", "Op", "Open", "Open your", "Open your Workspace"])
        fillDefault(value);
      await glossaryRegion("German");
      expect(matchGlossary).toHaveBeenCalledTimes(1);
      expect(matchGlossary.mock.calls[0][0]).toEqual({
        text: "Open your Workspace",
        language: "en-US",
      });
    });

    it("lists the typed default value's terms, module-scoped after choosing the module (H12)", async () => {
      renderWithProviders(<AddNewLanguageKey />, { route });
      fillDefault("Open your Workspace Portal");
      const german = await glossaryRegion("German");
      expect(within(german).getByText("Arbeitsbereich")).toBeTruthy();
      expect(within(german).queryByText("Portal")).toBeNull();
      fireEvent.click(screen.getByRole("combobox"));
      fireEvent.click(screen.getByRole("option", { name: /UILM/ }));
      await waitFor(() => expect(within(german).getAllByText("Portal").length).toBeGreaterThan(0));
      expect(screen.queryByRole("button", { name: /Insert/ })).toBeNull();
    });

    it("shows each row's own value, or that the glossary has none (H13)", async () => {
      renderWithProviders(<AddNewLanguageKey />, { route });
      fillDefault("Open your Workspace");
      expect(within(await glossaryRegion("German")).getByText("Arbeitsbereich")).toBeTruthy();
      expect(
        within(await glossaryRegion("French")).getByText(/No translation in the glossary/),
      ).toBeTruthy();
    });

    it("warns live under the target and Fix replaces the forbidden word (H5, H6)", async () => {
      renderWithProviders(<AddNewLanguageKey />, { route });
      fillDefault("Open your Workspace");
      await glossaryRegion("German");
      fireEvent.change(translationFields()[0], { target: { value: "Ihr Werkbereich" } });
      expect(await screen.findByText(/"Werkbereich" is not allowed/)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Fix" }));
      expect(translationFields()[0].value).toBe("Ihr Arbeitsbereich");
      expectNoGlossaryIssues();
    });
  });
});
