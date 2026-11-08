import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { toGlossaryMatch } from "@blocks-localization/hooks/use-glossary-match";
import { GlossaryRuleDto, IGlossaryMatchDto } from "@blocks-localization/models/language";
import { maskPlaceholders } from "@blocks-localization/utils/glossary-placeholders";
import {
  findInTarget,
  GlossaryViolationKind,
  validateTranslation,
} from "@blocks-localization/utils/glossary-validation";

vi.mock("@seliseblocks/genesis-os", () => ({ useProjectStore: () => ({}) }));
vi.mock("@blocks-localization/services/language-manager.service", () => ({
  languageManagerService: {},
}));

interface VectorGlossary {
  id: string;
  name: string;
  rule?: GlossaryRuleDto;
  caseSensitive?: boolean;
  variants?: string[];
  translations?: Record<string, string>;
  forbidden?: Record<string, string[]>;
}

interface VectorMatch {
  glossaryId: string;
  start: number;
  surface: string;
}

interface VectorViolation {
  kind: GlossaryViolationKind;
  glossaryId: string;
  value: string;
}

interface Vector {
  id: string;
  source: string;
  sourceCulture?: string;
  target: string;
  culture: string;
  glossaries: VectorGlossary[];
  expectedMasked?: string;
  expectedMatches: VectorMatch[];
  expectedViolations: VectorViolation[];
}

/** Repo-root relative; Vitest runs from `client/`. */
const VECTORS_PATH = join(process.cwd(), "..", "testdata/glossary/validation-vectors.json");

const vectors: Vector[] = JSON.parse(readFileSync(VECTORS_PATH, "utf8"));

/**
 * The client does not match sources (the server owns matching), so the expected matches are
 * fed in as `/Glossary/Match` returns them: only the values active under the rule.
 */
const toMatchDto = (glossary: VectorGlossary, match: VectorMatch): IGlossaryMatchDto => {
  const rule = glossary.rule ?? "translate";
  const translations = glossary.translations ?? {};
  const forbidden = glossary.forbidden ?? {};
  const cultures = [...new Set([...Object.keys(translations), ...Object.keys(forbidden)])];
  return {
    glossaryId: glossary.id,
    start: match.start,
    length: match.surface.length,
    surface: match.surface,
    term: glossary.name,
    rule,
    status: "approved",
    caseSensitive: !!glossary.caseSensitive,
    variants: glossary.variants ?? [],
    scope: "global",
    definition: "",
    translations: cultures
      .map((language) => ({
        language,
        value: rule === "translate" ? (translations[language] ?? "") : "",
        forbiddenValues: rule === "keep" ? [] : (forbidden[language] ?? []),
      }))
      .filter((translation) => translation.value || translation.forbiddenValues.length > 0),
  };
};

const matchesOf = (vector: Vector) =>
  vector.expectedMatches.map((match) => {
    const glossary = vector.glossaries.find((item) => item.id === match.glossaryId);
    if (!glossary) throw new Error(`${vector.id}: no glossary ${match.glossaryId}`);
    return toGlossaryMatch(toMatchDto(glossary, match));
  });

describe("testdata/glossary/validation-vectors.json (shared with the server)", () => {
  it("has the shared vectors", () => {
    expect(vectors.length).toBeGreaterThanOrEqual(20);
    expect(new Set(vectors.map((vector) => vector.id)).size).toBe(vectors.length);
  });

  it.each(vectors.map((vector) => [vector.id, vector] as const))("%s", (_id, vector) => {
    if (vector.expectedMasked !== undefined)
      expect(maskPlaceholders(vector.source)).toBe(vector.expectedMasked);

    for (const match of vector.expectedMatches)
      expect(vector.source.slice(match.start, match.start + match.surface.length)).toBe(
        match.surface,
      );

    const violations = validateTranslation(vector.target, matchesOf(vector), vector.culture);
    expect(
      violations.map(({ kind, glossaryId, found, expected }) => ({
        kind,
        glossaryId,
        value: found ?? expected ?? "",
      })),
    ).toEqual(vector.expectedViolations);

    const target = vector.target.normalize("NFC");
    for (const violation of vector.expectedViolations) {
      if (violation.kind === "missing-keep")
        expect(
          findInTarget(target, violation.value, {
            caseInsensitive: false,
            targetCulture: vector.culture,
          }),
        ).toBeNull();
      if (violation.kind === "forbidden-used")
        expect(
          findInTarget(target, violation.value, {
            caseInsensitive: true,
            targetCulture: vector.culture,
          }),
        ).not.toBeNull();
    }
  });
});
