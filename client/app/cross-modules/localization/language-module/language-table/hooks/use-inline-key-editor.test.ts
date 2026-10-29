import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "@/test-utils/query-wrapper";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import {
  IBlocksLanguageKey,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { MATCH_DEBOUNCE_MS } from "@blocks-localization/hooks/use-glossary-match";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { matchResponse } from "@blocks-localization/test-utils/helpers/glossary-matches";
import { useInlineKeyEditor } from "./use-inline-key-editor";

const suggestAsync = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
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

const keyDetails: IBlocksLanguageKey = {
  itemId: "k1",
  keyName: "ws",
  moduleId: "M",
  routes: [],
  glossaryIds: [],
  resources: [{ culture: "en-US", value: "Open your Workspace" }],
  isPartiallyTranslated: false,
  lastUpdateDate: "",
  createDate: "",
  context: "",
};

const languages: ILanguageConfig[] = [
  { itemId: "en", languageName: "English", languageCode: "en-US", isDefault: true },
  { itemId: "de", languageName: "German", languageCode: "de-DE" },
];

const setup = () =>
  renderHook(() => useInlineKeyEditor(keyDetails, languages), {
    wrapper: createQueryWrapper().wrapper,
  });

describe("useInlineKeyEditor — glossary rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    matchGlossary.mockImplementation(async (request) => matchResponse([G1], request.text));
    suggestAsync.mockResolvedValue({
      content: "Öffnen Sie Ihren Werkbereich",
      appliedTerms: [
        { glossaryId: "g1", term: "Workspace", rule: "translate", expected: "Arbeitsbereich" },
      ],
      glossaryViolations: [
        {
          glossaryId: "g1",
          term: "Workspace",
          kind: "missing-translation",
          expected: "Arbeitsbereich",
        },
        { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
      ],
    });
    h.useSaveBlocksLanguageKey.mockReturnValue({ isPending: false, mutateAsync: vi.fn() } as never);
    h.useGetTranslationSuggestion.mockReturnValue({ mutateAsync: suggestAsync } as never);
  });

  it("fills the row with one request, keeps the server's violations and fixes them (H4, H5)", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.autoTranslate("de-DE");
    });
    expect(suggestAsync).toHaveBeenCalledTimes(1);
    expect(suggestAsync.mock.calls[0][0]).toMatchObject({
      sourceText: "Open your Workspace",
      currentLanguageCode: "en-US",
      destinationLanguageCode: "de-DE",
      glossaryIds: [],
      moduleId: "M",
    });
    expect(result.current.draftTranslations["de-DE"]).toBe("Öffnen Sie Ihren Werkbereich");
    const row = result.current.getGlossaryRow("de-DE");
    expect(row.violations.map((v) => v.kind)).toEqual(["missing-translation", "forbidden-used"]);
    expect(result.current.isAutoTranslating("de-DE")).toBe(false);

    act(() => result.current.fixViolation("de-DE", row.violations[1]));
    expect(result.current.draftTranslations["de-DE"]).toBe("Öffnen Sie Ihren Arbeitsbereich");
    expect(result.current.getGlossaryRow("de-DE").violations).toEqual([]);
  });

  it("clears the row's violations on a user edit and on discard (C11)", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.autoTranslate("de-DE");
    });
    act(() => result.current.setTranslation("de-DE", "Hallo"));
    expect(result.current.getGlossaryRow("de-DE").violations).toEqual([]);

    await act(async () => {
      await result.current.autoTranslate("de-DE");
    });
    expect(result.current.getGlossaryRow("de-DE").violations).toHaveLength(2);
    act(() => result.current.discardChanges());
    expect(result.current.getGlossaryRow("de-DE").violations).toEqual([]);
    expect(result.current.draftTranslations["de-DE"]).toBe("");
  });
});

describe("useInlineKeyEditor — /Glossary/Match", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    matchGlossary.mockImplementation(async (request) => matchResponse([G1], request.text));
    h.useSaveBlocksLanguageKey.mockReturnValue({ isPending: false, mutateAsync: vi.fn() } as never);
    h.useGetTranslationSuggestion.mockReturnValue({ mutateAsync: suggestAsync } as never);
  });
  afterEach(() => vi.useRealTimers());

  it("matches the source with the key and sends one request after typing stops (C18)", async () => {
    const { result } = setup();
    act(() => {
      vi.advanceTimersByTime(MATCH_DEBOUNCE_MS);
    });
    await waitFor(() => expect(result.current.sourceMatches).toHaveLength(1));
    expect(matchGlossary).toHaveBeenCalledTimes(1);
    expect(matchGlossary.mock.calls[0][0]).toMatchObject({ keyId: "k1", moduleId: "M" });

    for (const character of "Open your Workspace now!".slice(19)) {
      act(() =>
        result.current.setTranslation(
          "en-US",
          `${result.current.draftTranslations["en-US"]}${character}`,
        ),
      );
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(matchGlossary).toHaveBeenCalledTimes(1);
    act(() => {
      vi.advanceTimersByTime(MATCH_DEBOUNCE_MS);
    });
    await waitFor(() => expect(matchGlossary).toHaveBeenCalledTimes(2));
    expect(matchGlossary.mock.calls[1][0]).toMatchObject({ text: "Open your Workspace now!" });
  });
});
