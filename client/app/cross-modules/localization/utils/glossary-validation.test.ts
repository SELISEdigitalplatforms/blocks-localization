import { describe, expect, it } from "vitest";

import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import { buildGlossaryMatcher, GlossaryMatch } from "@blocks-localization/utils/glossary-matcher";
import {
  applyFix,
  buildCorrectionPrompt,
  canApplyFix,
  findInTarget,
  formatViolationMessage,
  GlossaryViolation,
  validateTranslation,
} from "@blocks-localization/utils/glossary-validation";

const meta = (data: Record<string, unknown>) => GLOSSARY_META_PREFIX + JSON.stringify(data);

const glossary = (
  overrides: Partial<IGlossary> & Pick<IGlossary, "itemId" | "name">,
): IGlossary => ({
  createDate: "2026-10-01T00:00:00Z",
  lastUpdateDate: "2026-10-01T00:00:00Z",
  isGlobal: true,
  ...overrides,
});

const match = (list: IGlossary[], text: string, sourceCulture = "en-US"): GlossaryMatch[] =>
  buildGlossaryMatcher(list).match(text, { sourceCulture, scopeMode: "applicable" });

const G1 = glossary({
  itemId: "g1",
  name: "Workspace",
  additionalNote: meta({
    rule: "translate",
    variants: ["workspaces"],
    translations: { "de-DE": "Arbeitsbereich", "tr-TR": "Iğdır" },
    forbidden: { "de-DE": ["Werkbereich"] },
  }),
});
const G2 = glossary({
  itemId: "g2",
  name: "SELISE",
  additionalNote: meta({ rule: "keep", caseSensitive: true, variants: ["Selise"] }),
});
const BANNED = glossary({
  itemId: "b",
  name: "Dashboard",
  additionalNote: meta({ rule: "forbidden", variants: ["Dashboards"] }),
});

const ws = match([G1], "Open your Workspace");

describe("utils/glossary-validation validateTranslation", () => {
  it("returns no violations for a compliant output", () => {
    expect(validateTranslation("Öffnen Sie Ihren Arbeitsbereich", ws, "de-DE")).toEqual([]);
  });

  it("reports missing-translation and forbidden-used (Example 3)", () => {
    expect(validateTranslation("Öffnen Sie Ihren Werkbereich", ws, "de-DE")).toEqual([
      {
        glossaryId: "g1",
        term: "Workspace",
        kind: "missing-translation",
        expected: "Arbeitsbereich",
      },
      { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
    ]);
  });

  it("compares translations case-insensitively in the target culture", () => {
    expect(validateTranslation("öffnen sie ihren ARBEITSBEREICH", ws, "de-DE")).toEqual([]);
    // Turkish: "I" lower-cases to "ı" in tr-TR (to "i" with the root locale).
    expect(validateTranslation("IĞDIR", ws, "tr-TR")).toEqual([]);
    expect(validateTranslation("ığdır", ws, "tr-TR")).toEqual([]);
  });

  it("accepts inflected forms that start at a word start (A11, C21, Example 9)", () => {
    expect(
      validateTranslation("Öffnen Sie die Einstellungen Ihres Arbeitsbereichs", ws, "de-DE"),
    ).toEqual([]);
    expect(validateTranslation("Alle Arbeitsbereiche", ws, "de-DE")).toEqual([]);
    // Inside a compound it is not at a word start: still reported (warn only).
    expect(validateTranslation("Projektarbeitsbereich", ws, "de-DE")[0].kind).toBe(
      "missing-translation",
    );
  });

  it("finds an inflected forbidden value and reports only the matched span", () => {
    expect(validateTranslation("Ihres Arbeitsbereich Werkbereichs", ws, "de-DE")).toEqual([
      { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
    ]);
  });

  it("uses plain substring checks for no-space target languages", () => {
    const ja = glossary({
      itemId: "ja",
      name: "Workspace",
      additionalNote: meta({ rule: "translate", translations: { "ja-JP": "ワークスペース" } }),
    });
    const jaMatches = match([ja], "Workspace");
    expect(validateTranslation("新しいワークスペースを開く", jaMatches, "ja-JP")).toEqual([]);
    expect(validateTranslation("作業領域を開く", jaMatches, "ja-JP")[0].kind).toBe(
      "missing-translation",
    );
  });

  it("requires each distinct kept surface exactly (missing-keep)", () => {
    const keepMatches = match([G2], "SELISE and Selise");
    expect(validateTranslation("SELISE und Selise", keepMatches, "de-DE")).toEqual([]);
    expect(validateTranslation("selise und Selise", keepMatches, "de-DE")).toEqual([
      { glossaryId: "g2", term: "SELISE", kind: "missing-keep", expected: "SELISE" },
    ]);
    expect(validateTranslation("Die Firma", keepMatches, "de-DE")).toHaveLength(2);
  });

  it("does not check a Keep term against stored forbidden values (C18, Example 8)", () => {
    const keep = glossary({
      itemId: "s",
      name: "SELISE",
      additionalNote: meta({
        rule: "keep",
        caseSensitive: true,
        translations: { "de-DE": "Selise GmbH" },
        forbidden: { "de-DE": ["Selis"] },
      }),
    });
    const keepMatches = match([keep], "SELISE login");
    expect(validateTranslation("SELISE Anmeldung Selis", keepMatches, "de-DE")).toEqual([]);
  });

  it("does not check a Forbidden term's stored translation (C18)", () => {
    const banned = glossary({
      itemId: "f",
      name: "Werkbereich",
      additionalNote: meta({ rule: "forbidden", translations: { "de-DE": "Arbeitsbereich" } }),
    });
    expect(validateTranslation("Hallo", match([banned], "Werkbereich"), "de-DE")).toEqual([]);
  });

  it("reports a forbidden term or variant as it appears in the output", () => {
    const matches = match([BANNED], "Open the Dashboard");
    expect(validateTranslation("Open the DASHBOARDS view", matches, "en-GB")).toEqual([
      { glossaryId: "b", term: "Dashboard", kind: "forbidden-used", found: "DASHBOARDS" },
    ]);
  });

  it("respects case sensitivity for a forbidden term", () => {
    const strict = glossary({
      itemId: "cs",
      name: "Go",
      additionalNote: meta({ rule: "forbidden", caseSensitive: true }),
    });
    const matches = match([strict], "Go now");
    expect(validateTranslation("go now", matches, "en-GB")).toEqual([]);
    expect(validateTranslation("Go now", matches, "en-GB")).toHaveLength(1);
  });

  it("reports one violation per (glossary, kind, found)", () => {
    const matches = match([G1], "Workspace and workspaces");
    const violations = validateTranslation("Werkbereich und Werkbereich", matches, "de-DE");
    expect(violations.filter((v) => v.kind === "forbidden-used")).toHaveLength(1);
    expect(violations.filter((v) => v.kind === "missing-translation")).toHaveLength(1);
  });

  it("reports nothing for an empty output or a term without a target value (C12)", () => {
    expect(validateTranslation("", ws, "de-DE")).toEqual([]);
    expect(validateTranslation("   ", ws, "de-DE")).toEqual([]);
    expect(validateTranslation("Bonjour", ws, "fr-FR")).toEqual([]);
  });

  it("normalizes the output and values to NFC", () => {
    const cafe = glossary({
      itemId: "c",
      name: "Coffee",
      additionalNote: meta({ rule: "translate", translations: { "fr-FR": "Café" } }),
    });
    expect(validateTranslation("Le Café", match([cafe], "Coffee"), "fr-FR")).toEqual([]);
  });
});

// The approved translation starts with the stored forbidden value (m1).
const PORTAL = glossary({
  itemId: "p",
  name: "Portal",
  additionalNote: meta({
    rule: "translate",
    translations: { "de-DE": "Portalseite" },
    forbidden: { "de-DE": ["Portal"] },
  }),
});
const portal = match([PORTAL], "Open the Portal");
const portalUsed: GlossaryViolation = {
  glossaryId: "p",
  term: "Portal",
  kind: "forbidden-used",
  found: "Portal",
};

describe("utils/glossary-validation forbidden value inside the approved translation (m1)", () => {
  it("does not report a forbidden value that is part of the approved translation", () => {
    expect(validateTranslation("Öffne Portalseite", portal, "de-DE")).toEqual([]);
    expect(validateTranslation("Öffne die Portalseiten", portal, "de-DE")).toEqual([]);
  });

  it("still reports a forbidden occurrence outside the approved translation", () => {
    expect(validateTranslation("Öffne Portalseite im Portal", portal, "de-DE")).toEqual([
      portalUsed,
    ]);
    expect(validateTranslation("Öffne Portal", portal, "de-DE")).toEqual([
      { glossaryId: "p", term: "Portal", kind: "missing-translation", expected: "Portalseite" },
      portalUsed,
    ]);
  });

  it("applyFix never replaces inside the approved translation", () => {
    expect(applyFix("Öffne Portalseite", portalUsed, portal, "de-DE")).toBeNull();
    const fixed = applyFix("Öffne Portalseite im Portal", portalUsed, portal, "de-DE");
    expect(fixed).toBe("Öffne Portalseite im Portalseite");
    expect(validateTranslation(fixed ?? "", portal, "de-DE")).toEqual([]);
    expect(applyFix("Öffne Portal", portalUsed, portal, "de-DE")).toBe("Öffne Portalseite");
  });
});

describe("utils/glossary-validation findInTarget", () => {
  it("folds the Greek final sigma when comparing case-insensitively (m3)", () => {
    const options = { caseInsensitive: true, targetCulture: "el-GR" };
    expect(findInTarget("Η οδος εδώ", "ΟΔΟΣ", options)).toEqual({ start: 2, length: 4 });
    expect(findInTarget("Η ΟΔΟΣ εδώ", "οδος", options)).toEqual({ start: 2, length: 4 });
    expect(findInTarget("Η ΟΔΟΣ εδώ", "οδος", { ...options, caseInsensitive: false })).toBeNull();
  });

  it("rejects a match that ends inside a case expansion (m4)", () => {
    const options = { caseInsensitive: true, targetCulture: "en-US" };
    // "İ" lower-cases to "i" + U+0307: "i" alone is only half of that character.
    expect(findInTarget("İstanbul", "i", options)).toBeNull();
    expect(findInTarget("İstanbul", "i", { ...options, anywhere: true })).toBeNull();
    expect(findInTarget("İi", "i", { ...options, anywhere: true })).toEqual({
      start: 1,
      length: 1,
    });
    expect(findInTarget("İstanbul", "istanbul", options)).toBeNull();
    expect(findInTarget("İstanbul", "i̇stanbul", options)).toEqual({ start: 0, length: 8 });
  });

  it("returns offsets in the original text even when lower-casing changes lengths", () => {
    expect(
      findInTarget("İİ Werkbereich", "werkbereich", {
        caseInsensitive: true,
        targetCulture: "de-DE",
      }),
    ).toEqual({ start: 3, length: 11 });
  });

  it("treats an astral letter before the value as part of the word, an emoji as a boundary", () => {
    const options = { caseInsensitive: true, targetCulture: "de-DE" };
    expect(findInTarget("𝐀Werkbereich", "werkbereich", options)).toBeNull();
    expect(findInTarget("😀Werkbereich", "werkbereich", options)).toEqual({
      start: 2,
      length: 11,
    });
    expect(
      findInTarget("𝐀Werkbereich 😀Werkbereich", "Werkbereich", {
        ...options,
        caseInsensitive: false,
      }),
    ).toEqual({ start: 16, length: 11 });
  });
});

describe("utils/glossary-validation applyFix", () => {
  const forbiddenUsed: GlossaryViolation = {
    glossaryId: "g1",
    term: "Workspace",
    kind: "forbidden-used",
    found: "Werkbereich",
  };

  it("replaces the first occurrence with the approved translation (H8, Example 4)", () => {
    const fixed = applyFix("Öffnen Sie Ihren Werkbereich", forbiddenUsed, ws, "de-DE");
    expect(fixed).toBe("Öffnen Sie Ihren Arbeitsbereich");
    expect(validateTranslation(fixed ?? "", ws, "de-DE")).toEqual([]);
  });

  it("is case-insensitive and replaces only the first occurrence", () => {
    const fixed = applyFix("WERKBEREICH und Werkbereichs", forbiddenUsed, ws, "de-DE");
    expect(fixed).toBe("Arbeitsbereich und Werkbereichs");
    expect(validateTranslation(fixed ?? "", ws, "de-DE")).toEqual([
      { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
    ]);
  });

  it("keeps trailing inflection letters and re-validates clean (C21)", () => {
    const fixed = applyFix("Einstellungen Ihres Werkbereichs", forbiddenUsed, ws, "de-DE");
    expect(fixed).toBe("Einstellungen Ihres Arbeitsbereichs");
    expect(validateTranslation(fixed ?? "", ws, "de-DE")).toEqual([]);
  });

  it("falls back to an occurrence inside a word when none starts a word", () => {
    expect(applyFix("Projektwerkbereich", forbiddenUsed, ws, "de-DE")).toBe(
      "ProjektArbeitsbereich",
    );
  });

  it("never inserts at a zero-length match inside a case expansion (m4)", () => {
    const halfI: GlossaryViolation = { ...forbiddenUsed, found: "i" };
    expect(applyFix("İstanbul", halfI, ws, "de-DE")).toBeNull();
    expect(applyFix("İ", halfI, ws, "de-DE")).toBeNull();
  });

  it("offers no fix without a deterministic replacement (A5)", () => {
    const missing: GlossaryViolation = { ...forbiddenUsed, kind: "missing-translation" };
    expect(canApplyFix(missing, ws, "de-DE")).toBe(false);
    expect(applyFix("x", missing, ws, "de-DE")).toBeNull();

    // Forbidden rule: no approved translation to insert.
    const banned = match([BANNED], "Dashboard");
    const used: GlossaryViolation = {
      glossaryId: "b",
      term: "Dashboard",
      kind: "forbidden-used",
      found: "Dashboard",
    };
    expect(canApplyFix(used, banned, "de-DE")).toBe(false);

    // Translate rule without a value for the target language.
    expect(canApplyFix(forbiddenUsed, ws, "fr-FR")).toBe(false);
    expect(canApplyFix(forbiddenUsed, ws, "de-DE")).toBe(true);
    // The text no longer contains the span.
    expect(applyFix("Öffnen", forbiddenUsed, ws, "de-DE")).toBeNull();
  });
});

describe("utils/glossary-validation messages and correction", () => {
  const violations: GlossaryViolation[] = [
    {
      glossaryId: "g1",
      term: "Workspace",
      kind: "missing-translation",
      expected: "Arbeitsbereich",
    },
    { glossaryId: "g2", term: "SELISE", kind: "missing-keep", expected: "SELISE" },
    { glossaryId: "g1", term: "Workspace", kind: "forbidden-used", found: "Werkbereich" },
  ];

  it("formats the messages shown under the field (H7)", () => {
    expect(violations.map(formatViolationMessage)).toEqual([
      'Expected "Arbeitsbereich" for "Workspace"',
      'Keep "SELISE" unchanged',
      '"Werkbereich" is not allowed',
    ]);
  });

  it("appends the correction block to the prompt", () => {
    expect(buildCorrectionPrompt("Base\n", violations)).toBe(
      "Base\n" +
        "CORRECTION: Your previous answer broke these rules:\n" +
        '- Use "Arbeitsbereich" for "Workspace".\n' +
        '- Keep "SELISE" exactly as written.\n' +
        '- Do not use "Werkbereich".\n' +
        "Return only the corrected translation.\n",
    );
  });
});
