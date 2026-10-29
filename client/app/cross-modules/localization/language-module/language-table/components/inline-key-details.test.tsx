import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "@/test-utils/render";
import { toast } from "@/hooks/use-toast";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import {
  IBlocksLanguageKey,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { matchResponse } from "@blocks-localization/test-utils/helpers/glossary-matches";
import { InlineKeyDetails } from "./inline-key-details";

const suggestAsync = vi.fn();
const saveAsync = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
  useScopedPath: () => (sub: string) => `/app/p1/${sub}`,
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(),
  useGetTranslationSuggestion: vi.fn(),
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
      translations: { "de-DE": "Arbeitsbereich", "fr-FR": "Espace de travail" },
      forbidden: { "de-DE": ["Werkbereich"] },
    }),
};

const keyDetails: IBlocksLanguageKey = {
  itemId: "k1",
  keyName: "ws",
  moduleId: "M",
  routes: [],
  glossaryIds: ["g9"],
  resources: [{ culture: "en-US", value: "Open your Workspace" }],
  isPartiallyTranslated: false,
  lastUpdateDate: "",
  createDate: "",
  context: "Formal tone.",
};

const languages: ILanguageConfig[] = [
  { itemId: "de", languageName: "German", languageCode: "de-DE" },
  { itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "fr", languageName: "French", languageCode: "fr-FR" },
];

const renderEditor = () =>
  renderWithProviders(
    <InlineKeyDetails
      keyDetails={keyDetails}
      languageListData={languages}
      languageModules={[{ itemId: "M", moduleName: "Module M" }]}
      onTranslate={vi.fn()}
      onDelete={vi.fn()}
    />,
  );

const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;
const textbox = (name: string) => screen.getByRole("textbox", { name }) as HTMLTextAreaElement;

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

describe("InlineKeyDetails — glossary-aware suggestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchGlossary.mockImplementation(async (request) => matchResponse([G1], request.text));
    h.useSaveBlocksLanguageKey.mockReturnValue({
      isPending: false,
      mutateAsync: saveAsync,
    } as never);
    h.useGetTranslationSuggestion.mockReturnValue({ mutateAsync: suggestAsync } as never);
  });

  describe("glossary-aware", () => {
    it("sends one request with the key's own prompt, tags and module (H4)", async () => {
      suggestAsync.mockResolvedValue({ content: "Öffnen Sie Ihren Arbeitsbereich" });
      renderEditor();
      fireEvent.click(button("Auto-translate German"));
      await waitFor(() =>
        expect(textbox("German translation").value).toBe("Öffnen Sie Ihren Arbeitsbereich"),
      );
      expect(suggestAsync.mock.calls[0][0]).toStrictEqual({
        sourceText: "Open your Workspace",
        destinationLanguage: "German",
        currentLanguage: "English",
        currentLanguageCode: "en-US",
        temperature: 0.1,
        elementDetailContext: "Formal tone.",
        glossaryIds: ["g9"],
        moduleId: "M",
        destinationLanguageCode: "de-DE",
      });
      expect(suggestAsync).toHaveBeenCalledTimes(1);
    });

    it("shows the server's violations under the row, Fix replaces the text, editing clears it (H5, C11)", async () => {
      suggestAsync.mockResolvedValue({
        content: "Öffnen Sie Ihren Werkbereich",
        appliedTerms: APPLIED_G1,
        glossaryViolations: [MISSING, FORBIDDEN],
      });
      renderEditor();
      await glossaryRegion("German");
      fireEvent.click(button("Auto-translate German"));
      await screen.findByText(/"Werkbereich" is not allowed/);
      expect(textbox("German translation").value).toBe("Öffnen Sie Ihren Werkbereich");
      expect(button("Save changes").disabled).toBe(false);

      fireEvent.click(button("Fix"));
      expect(textbox("German translation").value).toBe("Öffnen Sie Ihren Arbeitsbereich");
      expect(screen.queryByText(/"Werkbereich" is not allowed/)).toBeNull();
      expectNoGlossaryIssues();

      fireEvent.click(button("Auto-translate German"));
      await screen.findByText(/"Werkbereich" is not allowed/);
      fireEvent.change(textbox("German translation"), { target: { value: "Hallo" } });
      expectNoGlossaryIssues();
    });

    it("shows no issues when the server returns empty arrays (C1)", async () => {
      suggestAsync.mockResolvedValue({
        content: "Öffnen Sie Ihren Werkbereich",
        appliedTerms: [],
        glossaryViolations: [],
      });
      renderEditor();
      await glossaryRegion("German");
      fireEvent.click(button("Auto-translate German"));
      await waitFor(() =>
        expect(textbox("German translation").value).toBe("Öffnen Sie Ihren Werkbereich"),
      );
      expectNoGlossaryIssues();
      expect(screen.queryByRole("region", { name: "Glossary terms for German" })).toBeNull();
    });

    it("keeps the in-flight state per row (C22)", async () => {
      const german = deferred<{ content: string }>();
      suggestAsync.mockImplementation(({ destinationLanguageCode }) =>
        destinationLanguageCode === "de-DE"
          ? german.promise
          : Promise.resolve({ content: "Ouvrez votre Espace de travail" }),
      );
      renderEditor();

      fireEvent.click(button("Auto-translate German"));
      await waitFor(() => expect(button("Auto-translate German").disabled).toBe(true));
      expect(button("Auto-translate French").disabled).toBe(false);

      fireEvent.click(button("Auto-translate French"));
      await waitFor(() =>
        expect(textbox("French translation").value).toBe("Ouvrez votre Espace de travail"),
      );
      expect(button("Auto-translate German").disabled).toBe(true);

      await act(async () => german.resolve({ content: "Öffnen Sie Ihren Arbeitsbereich" }));
      expect(textbox("German translation").value).toBe("Öffnen Sie Ihren Arbeitsbereich");
      expect(button("Auto-translate German").disabled).toBe(false);
    });

    it("ignores a response that arrives after the row collapsed (C22)", async () => {
      const german = deferred<{ content: string }>();
      suggestAsync.mockReturnValue(german.promise);
      const { unmount } = renderEditor();
      fireEvent.click(button("Auto-translate German"));
      await waitFor(() => expect(suggestAsync).toHaveBeenCalledTimes(1));

      unmount();
      await act(async () => german.resolve({ content: "Öffnen Sie Ihren Werkbereich" }));
      expect(suggestAsync).toHaveBeenCalledTimes(1);
      expect(toast).not.toHaveBeenCalled();
    });
  });

  describe("per-language glossary checklist and live checks (Phase 4)", () => {
    it("lists each row's approved values and follows source edits (H12)", async () => {
      renderEditor();
      const german = await glossaryRegion("German");
      expect(within(german).getByText("Arbeitsbereich")).toBeTruthy();
      expect(within(german).getByText("Use these terms in this translation")).toBeTruthy();
      const french = await glossaryRegion("French");
      expect(within(french).getByText("Espace de travail")).toBeTruthy();
      expect(screen.queryByRole("button", { name: /Insert/ })).toBeNull();

      fireEvent.change(textbox("English translation"), { target: { value: "Hello" } });
      await waitFor(() =>
        expect(screen.queryByRole("region", { name: "Glossary terms for German" })).toBeNull(),
      );
    });

    it("marks a term followed once the row uses it (H13)", async () => {
      renderEditor();
      const german = await glossaryRegion("German");
      fireEvent.change(textbox("German translation"), {
        target: { value: "Öffnen Sie Ihren Arbeitsbereich" },
      });
      expect(await within(german).findByText("Followed:")).toBeTruthy();
    });

    it("checks each target row live without Retry and keeps Save enabled (H5, C6)", async () => {
      renderEditor();
      await glossaryRegion("German");
      fireEvent.change(textbox("German translation"), { target: { value: "Ihr Werkbereich" } });
      expect(
        await screen.findByText('"Werkbereich" is not allowed · use "Arbeitsbereich"'),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
      expect(button("Save changes").disabled).toBe(false);
      fireEvent.click(button("Fix"));
      expect(textbox("German translation").value).toBe("Ihr Arbeitsbereich");
      expectNoGlossaryIssues();
    });
  });
});
