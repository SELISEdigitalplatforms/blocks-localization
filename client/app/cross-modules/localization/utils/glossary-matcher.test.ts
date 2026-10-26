import { describe, expect, it } from "vitest";

import { GLOSSARY_META_PREFIX } from "@blocks-localization/models/glossary-meta";
import { IGlossary } from "@blocks-localization/models/language";
import {
  buildGlossaryMatcher,
  isNoSpaceCulture,
  MatchOptions,
} from "@blocks-localization/utils/glossary-matcher";
import { validateTranslation } from "@blocks-localization/utils/glossary-validation";
import { buildTranslationPrompt } from "@blocks-localization/utils/translation-prompt";
import matcherSource from "@blocks-localization/utils/glossary-matcher.ts?raw";

const meta = (data: Record<string, unknown>) => GLOSSARY_META_PREFIX + JSON.stringify(data);

const glossary = (
  overrides: Partial<IGlossary> & Pick<IGlossary, "itemId" | "name">,
): IGlossary => ({
  createDate: "2026-10-01T00:00:00Z",
  lastUpdateDate: "2026-10-01T00:00:00Z",
  ...overrides,
});

const en: MatchOptions = { sourceCulture: "en-US", scopeMode: "applicable" };

// Spec §7 fixtures.
const G1 = glossary({
  itemId: "g1",
  name: "Workspace",
  isGlobal: true,
  context: "The area that holds a team's projects ⟦rule: de-DE→Arbeitsbereich⟧",
  additionalNote: meta({
    rule: "translate",
    variants: ["workspaces"],
    translations: { "de-DE": "Arbeitsbereich" },
    forbidden: { "de-DE": ["Werkbereich"] },
  }),
});
const G2 = glossary({
  itemId: "g2",
  name: "SELISE",
  isGlobal: true,
  additionalNote: meta({ rule: "keep", caseSensitive: true }),
});
const G3 = glossary({
  itemId: "g3",
  name: "Portal",
  moduleIds: ["M"],
  additionalNote: meta({ rule: "translate", translations: { "de-DE": "Portal" } }),
});
const G4 = glossary({
  itemId: "g4",
  name: "Customer Portal",
  moduleIds: ["M"],
  additionalNote: meta({ rule: "translate", translations: { "de-DE": "Kundenportal" } }),
});
const fixture = [G1, G2, G3, G4];

const ids = (text: string, opts: MatchOptions = { ...en, moduleId: "M" }, list = fixture) =>
  buildGlossaryMatcher(list)
    .match(text, opts)
    .map((match) => match.glossary.itemId);

describe("utils/glossary-matcher", () => {
  it("matches a term and returns its meta, definition, span and scope (Example 1)", () => {
    const [match] = buildGlossaryMatcher(fixture).match("Open your Workspace", {
      ...en,
      moduleId: "M",
    });
    expect(match).toMatchObject({
      start: 10,
      length: 9,
      surface: "Workspace",
      scope: "global",
      definition: "The area that holds a team's projects",
    });
    expect(match.glossary).toBe(G1);
    expect(match.meta.translations).toEqual({ "de-DE": "Arbeitsbereich" });
  });

  it("matches whole words only in space-separated languages (C8)", () => {
    const api = glossary({ itemId: "api", name: "API", isGlobal: true });
    expect(ids("a rapid change", en, [api])).toEqual([]);
    expect(ids("APIs", en, [api])).toEqual([]);
    expect(ids("the API, then", en, [api])).toEqual(["api"]);
    expect(ids("API", en, [api])).toEqual(["api"]);
    expect(ids("1API", en, [api])).toEqual([]);
    expect(ids("(API)", en, [api])).toEqual(["api"]);
  });

  it("matches variants (H5 variants)", () => {
    const [match] = buildGlossaryMatcher(fixture).match("All workspaces", en);
    expect(match).toMatchObject({ surface: "workspaces", start: 4, length: 10 });
    expect(match.glossary.itemId).toBe("g1");
  });

  it("matches case-insensitively unless the term is case-sensitive (H5, Example 5)", () => {
    expect(ids("open your WORKSPACE", en)).toEqual(["g1"]);
    expect(ids("SELISE login", en)).toEqual(["g2"]);
    expect(ids("selise login", en)).toEqual([]);
    expect(ids("Selise login", en)).toEqual([]);
  });

  it("uses substring matching for zh, ja, th, lo, km and my sources (H12, Example 6)", () => {
    const ws = glossary({ itemId: "ja", name: "ワークスペース", isGlobal: true });
    expect(ids("ワークスペースを開く", { ...en, sourceCulture: "ja-JP" }, [ws])).toEqual(["ja"]);
    expect(ids("ワークスペースを開く", en, [ws])).toEqual([]);
    const api = glossary({ itemId: "api", name: "API", isGlobal: true });
    expect(ids("rapid", { ...en, sourceCulture: "th" }, [api])).toEqual(["api"]);
    for (const code of ["zh-CN", "ja", "th-TH", "lo", "km-KH", "my-MM", "ZH_tw"]) {
      expect(isNoSpaceCulture(code)).toBe(true);
    }
    expect(isNoSpaceCulture("en-US")).toBe(false);
    expect(isNoSpaceCulture("ko-KR")).toBe(false);
  });

  it("keeps the longer span on overlap (H4, Example 2)", () => {
    expect(ids("Go to Customer Portal")).toEqual(["g4"]);
    expect(ids("Portal and Customer Portal")).toEqual(["g3", "g4"]);
  });

  it("breaks equal-length ties by scope (key > module > global > other), then lower itemId", () => {
    const a = glossary({ itemId: "b-global", name: "Report", isGlobal: true });
    const b = glossary({ itemId: "z-module", name: "Report", moduleIds: ["M"] });
    const c = glossary({ itemId: "y-key", name: "report" });
    const list = [a, b, c];
    expect(ids("Report", { ...en, moduleId: "M", keyGlossaryIds: ["y-key"] }, list)).toEqual([
      "y-key",
    ]);
    expect(ids("Report", { ...en, moduleId: "M" }, list)).toEqual(["z-module"]);
    expect(ids("Report", en, list)).toEqual(["b-global"]);

    const d = glossary({ itemId: "a-other", name: "Report" });
    const e = glossary({ itemId: "b-other", name: "Report" });
    expect(ids("Report", { ...en, scopeMode: "all" }, [e, d])).toEqual(["a-other"]);
    expect(ids("Report", { ...en, scopeMode: "all" }, [e, d, a])).toEqual(["b-global"]);
  });

  it("applies scopes: key, module, global, excluded; 'all' adds other", () => {
    const matcher = buildGlossaryMatcher(fixture);
    expect(matcher.match("Portal", en)).toEqual([]);
    expect(matcher.match("Portal", { ...en, moduleId: "M" })[0].scope).toBe("module");
    expect(matcher.match("Portal", { ...en, keyGlossaryIds: ["g3"] })[0].scope).toBe("key");
    expect(matcher.match("Portal", { ...en, scopeMode: "all" })[0].scope).toBe("other");
    expect(matcher.match("Workspace", { ...en, scopeMode: "all" })[0].scope).toBe("global");
  });

  it("still matches a shorter in-scope term when the longer one is out of scope", () => {
    const customer = glossary({ itemId: "c", name: "Customer", isGlobal: true });
    expect(ids("Customer Portal", en, [...fixture, customer])).toEqual(["c"]);
  });

  it("skips unsupported-version terms and matches corrupt ones by name (C9)", () => {
    const future = glossary({
      itemId: "v2",
      name: "Dashboard",
      isGlobal: true,
      additionalNote: "@@glossary-meta:v2@@{}",
    });
    const corrupt = glossary({
      itemId: "bad",
      name: "Billing",
      isGlobal: true,
      additionalNote: `${GLOSSARY_META_PREFIX}{not json`,
    });
    const matches = buildGlossaryMatcher([future, corrupt]).match("Dashboard Billing", en);
    expect(matches.map((match) => match.glossary.itemId)).toEqual(["bad"]);
    expect(matches[0].meta.rule).toBe("translate");
    expect(matches[0].meta.translations).toEqual({});
  });

  it("never matches the definition text (C10)", () => {
    const term = glossary({
      itemId: "t",
      name: "Tenant",
      isGlobal: true,
      context: "A customer account that owns projects",
    });
    expect(ids("customer account", en, [term])).toEqual([]);
  });

  it("returns every occurrence sorted by start", () => {
    const matches = buildGlossaryMatcher(fixture).match("Workspace SELISE workspaces", en);
    expect(matches.map((match) => [match.glossary.itemId, match.start, match.surface])).toEqual([
      ["g1", 0, "Workspace"],
      ["g2", 10, "SELISE"],
      ["g1", 17, "workspaces"],
    ]);
  });

  it("matches against the original text and NFC-normalizes only the alternatives", () => {
    const cafe = glossary({ itemId: "cafe", name: "Café", isGlobal: true });
    const [match] = buildGlossaryMatcher([cafe]).match("Le Café ouvre", en);
    expect(match).toMatchObject({ start: 3, length: 4, surface: "Café" });
  });

  it("handles astral characters around a match", () => {
    const api = glossary({ itemId: "api", name: "API", isGlobal: true });
    expect(ids("😀 API 😀", en, [api])).toEqual(["api"]);
    expect(ids("𝐀API", en, [api])).toEqual([]);
  });

  it("escapes regex characters in terms", () => {
    const net = glossary({ itemId: "net", name: "C++ (beta)", isGlobal: true });
    expect(ids("Use C++ (beta) now", en, [net])).toEqual(["net"]);
    expect(ids("Use C (beta) now", en, [net])).toEqual([]);
  });

  it("memoizes per array identity", () => {
    const list = [...fixture];
    expect(buildGlossaryMatcher(list)).toBe(buildGlossaryMatcher(list));
    expect(buildGlossaryMatcher([...list])).not.toBe(buildGlossaryMatcher(list));
  });

  it("uses no regex lookbehind (older Safari throws on it at module load)", () => {
    // Boundaries are checked in code, so the module's only patterns are in its source.
    expect(buildGlossaryMatcher(fixture).match("Workspace", en)).toHaveLength(1);
    expect(matcherSource).not.toContain("(?<");
  });

  it("matches case-insensitively when lower-casing changes a character's length", () => {
    const term = glossary({ itemId: "i", name: "İstanbul", isGlobal: true });
    const after = glossary({ itemId: "w", name: "Workspace", isGlobal: true });
    const matches = buildGlossaryMatcher([term, after]).match("İSTANBUL Workspace", en);
    expect(matches.map((match) => [match.surface, match.start, match.length])).toEqual([
      ["İSTANBUL", 0, 8],
      ["Workspace", 9, 9],
    ]);
  });

  describe("performance budgets (C14; median of 5 runs, fail at 2×)", () => {
    const syllables = ["ka", "lo", "mi", "ne", "su", "ta", "ri", "po", "de", "fa", "gu", "he"];
    const word = (seed: number, size: number) => {
      let value = "";
      let n = seed;
      for (let i = 0; i < size; i++) {
        value += syllables[n % syllables.length];
        n = Math.floor(n / syllables.length) + i * 7 + 3;
      }
      return value;
    };
    const capitalize = (value: string) => value[0].toUpperCase() + value.slice(1);

    // 2,000 terms, each with 3 variants; a quarter case-sensitive.
    const makeFixture = () =>
      Array.from({ length: 2000 }, (_, i) => {
        const name = `${capitalize(word(i, 3))}${i}`;
        return glossary({
          itemId: `term-${i}`,
          name: i % 7 === 0 ? `${name} ${word(i + 5, 2)}` : name,
          isGlobal: i % 2 === 0,
          moduleIds: ["M"],
          context: `Definition of ${name}`,
          additionalNote: meta({
            rule: "translate",
            caseSensitive: i % 4 === 0,
            variants: [`${name}s`, `${name}es`, `${word(i + 11, 2)}${i}`],
            translations: { "de-DE": `Wert${i}` },
          }),
        });
      });

    const median = (values: number[]) => [...values].sort((a, b) => a - b)[2];

    const source = Array.from({ length: 100 }, (_, i) =>
      i % 6 === 0 ? `${capitalize(word(i * 31, 3))}${i * 31}` : word(i + 100, 2),
    )
      .join(" ")
      .slice(0, 500);

    it("builds within 50 ms and matches a 500-character source within 5 ms", () => {
      expect(source.length).toBe(500);
      const buildTimes: number[] = [];
      const matchTimes: number[] = [];
      let found = 0;
      for (let run = 0; run < 5; run++) {
        const list = makeFixture();
        const buildStart = performance.now();
        const matcher = buildGlossaryMatcher(list);
        buildTimes.push(performance.now() - buildStart);

        const matchStart = performance.now();
        found = matcher.match(source, { ...en, moduleId: "M" }).length;
        matchTimes.push(performance.now() - matchStart);
      }
      expect(found).toBeGreaterThan(0);
      expect(median(buildTimes)).toBeLessThan(100);
      expect(median(matchTimes)).toBeLessThan(10);
    });

    it("keeps match + prompt + validation within 20 ms per suggestion", () => {
      const matcher = buildGlossaryMatcher(makeFixture());
      const times: number[] = [];
      for (let run = 0; run < 5; run++) {
        const start = performance.now();
        const matches = matcher.match(source, { ...en, moduleId: "M" });
        const prompt = buildTranslationPrompt({ matches, targetCulture: "de-DE" });
        validateTranslation(source, matches, "de-DE");
        times.push(performance.now() - start);
        expect(prompt.endsWith("\n")).toBe(true);
      }
      expect(median(times)).toBeLessThan(40);
    });
  });
});
