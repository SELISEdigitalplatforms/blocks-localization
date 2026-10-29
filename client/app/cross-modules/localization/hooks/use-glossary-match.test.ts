import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { IGlossaryMatchDto } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import {
  MATCH_MAX_TEXT_LENGTH,
  MATCH_STALE_TIME,
  toGlossaryMatch,
  useGlossaryMatch,
  UseGlossaryMatchOptions,
} from "./use-glossary-match";

const project = vi.hoisted(() => ({ tenantId: "tenant-1" }));

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: project.tenantId } }),
}));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: { matchGlossary: vi.fn() },
}));

const matchGlossary = vi.mocked(languageManagerService.matchGlossary);

const dto = (overrides: Partial<IGlossaryMatchDto> = {}): IGlossaryMatchDto => ({
  glossaryId: "g1",
  start: 10,
  length: 9,
  surface: "Workspace",
  term: "Workspace",
  rule: "translate",
  status: "approved",
  caseSensitive: false,
  scope: "key",
  definition: "A shared area ⟦rule: de-DE→Arbeitsbereich⟧",
  translations: [{ language: "de-DE", value: "Arbeitsbereich", forbiddenValues: ["Werkbereich"] }],
  ...overrides,
});

const options = (overrides: Partial<UseGlossaryMatchOptions> = {}): UseGlossaryMatchOptions => ({
  text: "Open your Workspace",
  sourceCulture: "en-US",
  keyId: "k1",
  moduleId: "m1",
  ...overrides,
});

const renderMatch = (initial: UseGlossaryMatchOptions, wrapper = createQueryWrapper().wrapper) =>
  renderHook((props: UseGlossaryMatchOptions) => useGlossaryMatch(props), {
    wrapper,
    initialProps: initial,
  });

describe("toGlossaryMatch", () => {
  it("maps a /Match item to the Phase 4 match shape", () => {
    const match = toGlossaryMatch(dto({ status: "draft" }));
    expect(match).toMatchObject({
      start: 10,
      length: 9,
      surface: "Workspace",
      scope: "key",
      status: "draft",
      definition: "A shared area",
      glossary: { itemId: "g1", name: "Workspace", status: "draft" },
      meta: {
        rule: "translate",
        caseSensitive: false,
        translations: { "de-DE": "Arbeitsbereich" },
        forbidden: { "de-DE": ["Werkbereich"] },
      },
    });
  });
});

describe("toGlossaryMatch (Phase 8)", () => {
  it("carries part of speech and usage examples onto the glossary", () => {
    const match = toGlossaryMatch({
      ...dto(),
      partOfSpeech: "noun",
      usageExamples: ["Open your workspace."],
    });
    expect(match.glossary).toMatchObject({
      partOfSpeech: "noun",
      usageExamples: ["Open your workspace."],
    });
  });
});

describe("useGlossaryMatch", () => {
  beforeEach(() => {
    project.tenantId = "tenant-1";
    matchGlossary.mockReset();
    matchGlossary.mockResolvedValue({ matches: [dto()] });
  });

  it("sends one request with the text, culture, key and module and returns the matches (H6)", async () => {
    const { result } = renderMatch(options({ glossaryIds: ["g1", ""] }));
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    expect(matchGlossary).toHaveBeenCalledTimes(1);
    expect(matchGlossary.mock.calls[0][0]).toEqual({
      text: "Open your Workspace",
      language: "en-US",
      keyId: "k1",
      moduleId: "m1",
      glossaryIds: ["g1"],
    });
    expect(result.current.matchedText).toBe("Open your Workspace");
  });

  it.each([
    ["empty text", { text: "   " }],
    ["text over 5,000 characters (C4)", { text: "a".repeat(MATCH_MAX_TEXT_LENGTH + 1) }],
    ["no source culture", { sourceCulture: "" }],
    ["disabled", { enabled: false }],
  ])("makes no request for %s", async (_, overrides) => {
    const { result } = renderMatch(options(overrides));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(matchGlossary).not.toHaveBeenCalled();
    expect(result.current.matches).toEqual([]);
  });

  it("makes no request without a project", async () => {
    project.tenantId = "";
    renderMatch(options());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(matchGlossary).not.toHaveBeenCalled();
  });

  it("matches text of exactly 5,000 characters", async () => {
    renderMatch(options({ text: "a".repeat(MATCH_MAX_TEXT_LENGTH) }));
    await waitFor(() => expect(matchGlossary).toHaveBeenCalledTimes(1));
  });

  it("reuses the cached match for the same text within 5 minutes (C11)", async () => {
    expect(MATCH_STALE_TIME).toBe(5 * 60_000);
    const { wrapper } = createQueryWrapper();
    const first = renderMatch(options(), wrapper);
    await waitFor(() => expect(first.result.current.matches).toHaveLength(1));
    first.unmount();

    const second = renderMatch(options(), wrapper);
    expect(second.result.current.matches).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(matchGlossary).toHaveBeenCalledTimes(1);
  });

  it("requests again for a different text, key or culture", async () => {
    const { result, rerender } = renderMatch(options());
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    rerender(options({ text: "Open the Portal" }));
    await waitFor(() => expect(matchGlossary).toHaveBeenCalledTimes(2));
    rerender(options({ text: "Open the Portal", keyId: "k2" }));
    await waitFor(() => expect(matchGlossary).toHaveBeenCalledTimes(3));
    rerender(options({ text: "Open the Portal", keyId: "k2", sourceCulture: "de-DE" }));
    await waitFor(() => expect(matchGlossary).toHaveBeenCalledTimes(4));
  });

  it("keeps the previous matches while a new text loads, with their own matchedText", async () => {
    const { result, rerender } = renderMatch(options());
    await waitFor(() => expect(result.current.matches).toHaveLength(1));
    let resolve!: (value: { matches: IGlossaryMatchDto[] }) => void;
    matchGlossary.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    rerender(options({ text: "Open your Workspace today" }));
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.matchedText).toBe("Open your Workspace");
    resolve({ matches: [] });
    await waitFor(() => expect(result.current.matchedText).toBe("Open your Workspace today"));
    expect(result.current.matches).toEqual([]);
  });

  it("returns no matches on failure, without retrying (C2)", async () => {
    matchGlossary.mockRejectedValue(new Error("down"));
    const { result } = renderMatch(options());
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.matches).toEqual([]);
    expect(result.current.matchedText).toBeUndefined();
    expect(matchGlossary).toHaveBeenCalledTimes(1);
  });
});
