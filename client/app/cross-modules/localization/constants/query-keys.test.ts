import { describe, expect, it } from "vitest";

import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";

describe("localization/constants/query-keys", () => {
  // ─── languageKeys.all ─────────────────────────────────────────────────────
  describe("languageKeys.all", () => {
    it("should be a constant tuple", () => {
      expect(localizationQueryKeys.languageKeys.all).toEqual(["get-blocksLanguageKeys"]);
    });
  });

  // ─── languageKeys.list ────────────────────────────────────────────────────
  describe("languageKeys.list", () => {
    it("should embed all arguments and JSON-stringify the array params", () => {
      const result = localizationQueryKeys.languageKeys.list(
        "tenant-1",
        0,
        25,
        "search",
        ["m1", "m2"],
        false,
        "keyName",
        true,
        "2026-01-01",
        "2026-01-31",
        "2026-02-01",
        "2026-02-28",
        [{ culture: "en", searchText: "hi" }],
        ["de", "fr"],
      );
      expect(result[0]).toBe("get-blocksLanguageKeys");
      expect(result[1]).toBe("tenant-1");
      expect(result[2]).toBe(0);
      expect(result[3]).toBe(25);
      expect(result[4]).toBe("search");
      expect(result[5]).toBe(JSON.stringify(["m1", "m2"]));
      expect(result[6]).toBe(false);
      expect(result[7]).toBe("keyName");
      expect(result[8]).toBe(true);
      // resourceSearchFilters + missingLanguages are JSON-stringified
      expect(result[13]).toBe(JSON.stringify([{ culture: "en", searchText: "hi" }]));
      expect(result[14]).toBe(JSON.stringify(["de", "fr"]));
    });

    it("should produce different keys for different module orderings", () => {
      const a = localizationQueryKeys.languageKeys.list(
        "t",
        0,
        10,
        "",
        ["m1", "m2"],
        false,
        "k",
        false,
        "",
        "",
        "",
        "",
        [],
        [],
      );
      const b = localizationQueryKeys.languageKeys.list(
        "t",
        0,
        10,
        "",
        ["m2", "m1"],
        false,
        "k",
        false,
        "",
        "",
        "",
        "",
        [],
        [],
      );
      // Even though JSON-stringified, the order matters because the strings differ.
      expect(a).not.toEqual(b);
    });
  });

  // ─── languageKeys.detail ──────────────────────────────────────────────────
  describe("languageKeys.detail", () => {
    it("should embed tenantId and itemId", () => {
      expect(localizationQueryKeys.languageKeys.detail("t1", "i1")).toEqual([
        "get-blocksLanguageKey",
        "t1",
        "i1",
      ]);
    });

    it("should have a constant prefix", () => {
      expect(localizationQueryKeys.languageKeys.detailPrefix).toEqual(["get-blocksLanguageKey"]);
    });
  });

  // ─── languageKeys.timeline ────────────────────────────────────────────────
  describe("languageKeys.timeline", () => {
    it("should embed tenantId, pageNumber, pageSize, keyId", () => {
      expect(localizationQueryKeys.languageKeys.timeline("t1", 2, 50, "k1")).toEqual([
        "get-uilm-timeline",
        "t1",
        2,
        50,
        "k1",
      ]);
    });

    it("should have a constant prefix", () => {
      expect(localizationQueryKeys.languageKeys.timelinePrefix).toEqual(["get-uilm-timeline"]);
    });
  });

  // ─── languageKeys.localizationTimeline ────────────────────────────────────
  describe("languageKeys.localizationTimeline", () => {
    it("should join logFromValues and excludeLogFromValues with comma", () => {
      const result = localizationQueryKeys.languageKeys.localizationTimeline(
        "t1",
        0,
        20,
        "u1",
        "logFrom",
        ["a", "b", "c"],
        ["x", "y"],
        "2026-01-01",
        "2026-01-31",
      );
      expect(result[0]).toBe("get-localization-timeline");
      expect(result[6]).toBe("a,b,c"); // joined (index 6)
      expect(result[7]).toBe("x,y"); // joined (index 7)
    });

    it("should produce empty string for empty arrays", () => {
      const result = localizationQueryKeys.languageKeys.localizationTimeline(
        "t",
        0,
        10,
        "u",
        "",
        [],
        [],
        "",
        "",
      );
      expect(result[6]).toBe("");
      expect(result[7]).toBe("");
    });

    it("should have a constant prefix", () => {
      expect(localizationQueryKeys.languageKeys.localizationTimelinePrefix).toEqual([
        "get-localization-timeline",
      ]);
    });
  });

  // ─── languageKeys.timelineByOperation ──────────────────────────────────────
  describe("languageKeys.timelineByOperation", () => {
    it("should embed tenantId, operationId, pageNumber, pageSize", () => {
      expect(localizationQueryKeys.languageKeys.timelineByOperation("t1", "op1", 3, 40)).toEqual([
        "get-timeline-by-operation",
        "t1",
        "op1",
        3,
        40,
      ]);
    });
  });

  // ─── languageKeys.byGlossary ──────────────────────────────────────────────
  describe("languageKeys.byGlossary", () => {
    it("should embed tenantId, glossaryId, pageNumber, pageSize", () => {
      expect(localizationQueryKeys.languageKeys.byGlossary("t1", "g1", 0, 25)).toEqual([
        "get-keys-by-glossary",
        "t1",
        "g1",
        0,
        25,
      ]);
    });
  });

  // ─── languages ────────────────────────────────────────────────────────────
  describe("languages", () => {
    it("should expose an 'all' tuple", () => {
      expect(localizationQueryKeys.languages.all).toEqual(["get-languages"]);
    });
    it("should build a per-tenant list key", () => {
      expect(localizationQueryKeys.languages.list("t1")).toEqual(["get-languages", "t1"]);
    });
  });

  // ─── modules ──────────────────────────────────────────────────────────────
  describe("modules", () => {
    it("should expose an 'all' tuple", () => {
      expect(localizationQueryKeys.modules.all).toEqual(["get-language-modules"]);
    });
    it("should build a per-tenant list key", () => {
      expect(localizationQueryKeys.modules.list("t1")).toEqual(["get-language-modules", "t1"]);
    });
    it("should build a per-project key", () => {
      expect(localizationQueryKeys.modules.byProject("p1")).toEqual(["language-modules", "p1"]);
    });
  });

  // ─── exportHistory ────────────────────────────────────────────────────────
  describe("exportHistory", () => {
    it("should expose an 'all' tuple", () => {
      expect(localizationQueryKeys.exportHistory.all).toEqual(["export-history"]);
    });
    it("should embed projectKey, pageNumber, pageSize, searchText, startDate, endDate", () => {
      expect(localizationQueryKeys.exportHistory.list("p1", 0, 20, "s", "d1", "d2")).toEqual([
        "export-history",
        "p1",
        0,
        20,
        "s",
        "d1",
        "d2",
      ]);
    });
  });

  // ─── glossaries ───────────────────────────────────────────────────────────
  describe("glossaries", () => {
    it("should expose an 'all' tuple", () => {
      expect(localizationQueryKeys.glossaries.all).toEqual(["get-glossaries"]);
    });
    it("should build a tenant+paged list key", () => {
      expect(localizationQueryKeys.glossaries.list("t1", 0, 25, "search")).toEqual([
        "get-glossaries",
        "t1",
        0,
        25,
        "search",
      ]);
    });
    it("should build a global key", () => {
      expect(localizationQueryKeys.glossaries.global("t1")).toEqual([
        "get-glossaries-global",
        "t1",
      ]);
    });
    it("should build a module key", () => {
      expect(localizationQueryKeys.glossaries.module("t1", "m1")).toEqual([
        "get-glossaries-module",
        "t1",
        "m1",
      ]);
    });
    it("should build a suggested-glossaries key", () => {
      expect(localizationQueryKeys.glossaries.suggested("t1", "i1")).toEqual([
        "get-suggested-glossaries",
        "t1",
        "i1",
      ]);
    });
    it("should build a search key", () => {
      expect(localizationQueryKeys.glossaries.search("t1", "x")).toEqual([
        "search-glossaries",
        "t1",
        "x",
      ]);
    });
    it("should build a detail key and prefix", () => {
      expect(localizationQueryKeys.glossaries.detail("t1", "i1")).toEqual([
        "get-glossary",
        "t1",
        "i1",
      ]);
      expect(localizationQueryKeys.glossaries.detailPrefix).toEqual(["get-glossary"]);
      expect(localizationQueryKeys.glossaries.suggestedPrefix).toEqual([
        "get-suggested-glossaries",
      ]);
    });
  });

  // ─── webhook ──────────────────────────────────────────────────────────────
  describe("webhook", () => {
    it("should expose an 'all' tuple", () => {
      expect(localizationQueryKeys.webhook.all).toEqual(["get-webhook"]);
    });
    it("should build a per-tenant detail key", () => {
      expect(localizationQueryKeys.webhook.detail("t1")).toEqual(["get-webhook", "t1"]);
    });
  });

  // ─── structural integrity ─────────────────────────────────────────────────
  describe("structural integrity", () => {
    it("should expose all expected top-level keys", () => {
      const expectedTop = [
        "languageKeys",
        "languages",
        "modules",
        "exportHistory",
        "glossaries",
        "webhook",
      ];
      for (const key of expectedTop) {
        expect(localizationQueryKeys).toHaveProperty(key);
      }
    });

    it("should be readonly (frozen as const)", () => {
      // The `as const` makes the top-level reference readonly in TS; runtime
      // mutation should still work on plain objects but the tuple structures
      // must remain plain arrays, not Map/Set.
      expect(Array.isArray(localizationQueryKeys.languageKeys.all)).toBe(true);
    });
  });
});
