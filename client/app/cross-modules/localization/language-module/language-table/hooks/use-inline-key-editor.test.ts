import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "@/test-utils/query-wrapper";
import * as hooks from "@blocks-localization/hooks/use-language-manager";
import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import {
  IBlocksLanguageKey,
  IGlossary,
  ILanguageConfig,
} from "@blocks-localization/models/language";
import { useInlineKeyEditor } from "./use-inline-key-editor";

const suggestAsync = vi.fn();
const loadGlossaries = vi.fn();

vi.mock("@/hooks/use-toast", () => ({ toast: vi.fn() }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "t1" } }),
}));
vi.mock("@blocks-localization/hooks/use-language-manager", () => ({
  useSaveBlocksLanguageKey: vi.fn(),
  useGetTranslationSuggestion: vi.fn(),
}));
vi.mock("@blocks-localization/hooks/use-glossary-aware-suggestion", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@blocks-localization/hooks/use-glossary-aware-suggestion")
  >()),
  useLoadAllGlossaries: () => loadGlossaries,
}));

const h = vi.mocked(hooks);

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
    loadGlossaries.mockResolvedValue([G1]);
    suggestAsync.mockResolvedValue({ content: "Öffnen Sie Ihren Werkbereich" });
    h.useSaveBlocksLanguageKey.mockReturnValue({ isPending: false, mutateAsync: vi.fn() } as never);
    h.useGetTranslationSuggestion.mockReturnValue({ mutateAsync: suggestAsync } as never);
  });

  it("fills the row, keeps its violations and fixes them in the draft (H7, H8)", async () => {
    const { result } = setup();
    await act(async () => {
      await result.current.autoTranslate("de-DE");
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
