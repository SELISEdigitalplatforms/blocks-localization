import { describe, expect, it, vi } from "vitest";

import {
  CONFIG_ENDPOINTS,
  GLOSSARY_ENDPOINTS,
  LANGUAGE_ASSISTANT_ENDPOINTS,
  LANGUAGE_ENDPOINTS,
  LANGUAGE_KEY_ENDPOINTS,
  LANGUAGE_MODULE_ENDPOINTS,
} from "@blocks-localization/constants/endpoint.constant";

// Stub the upstream constants to isolate this test from runtime-env.
// This keeps the localization endpoint tests pure (no import.meta.env,
// no window.__BLOCKS_ENV__, no global config drift).
vi.mock("@/constants/endpoint.constant", () => ({
  API_BASES: {
    COMMUNICATION: "/api",
    CLOUD_CONFIGURATION: "/api",
    UDS: "/api",
    UILM: "/api",
    UTILITIES: "/api",
    CLOUD_BUILD: "/api",
    IDP: "/api",
    IDENTIFIER: "/api",
    LMT: "/api",
    MFA: "/api",
    ALERT: "/api",
    AI: "/api",
    STUDIO: "/api",
    LOGIC: "/api",
  },
}));

const UILM_BASE = "/api";

describe("localization/constants/endpoint.constant", () => {
  // ─── LANGUAGE_KEY_ENDPOINTS ──────────────────────────────────────────────
  describe("LANGUAGE_KEY_ENDPOINTS", () => {
    const expected = {
      GETS: `${UILM_BASE}/Key/Gets`,
      GET: `${UILM_BASE}/Key/Get`,
      SAVE: `${UILM_BASE}/Key/Save`,
      DELETE: `${UILM_BASE}/Key/Delete`,
      DELETE_KEYS: `${UILM_BASE}/Key/DeleteKeys`,
      TRANSLATE_KEYS: `${UILM_BASE}/Key/TranslateKeys`,
      GENERATE_UILM_FILE: `${UILM_BASE}/Key/GenerateUilmFile`,
      TRANSLATE_ALL: `${UILM_BASE}/Key/TranslateAll`,
      TRANSLATE_KEY: `${UILM_BASE}/Key/TranslateKey`,
      UILM_IMPORT: `${UILM_BASE}/Key/UilmImport`,
      UILM_EXPORT: `${UILM_BASE}/Key/UilmExport`,
      GET_TIMELINE: `${UILM_BASE}/Key/GetTimeline`,
      GET_EXPORT_HISTORY: `${UILM_BASE}/Key/GetUilmExportedFiles`,
      ROLLBACK: `${UILM_BASE}/Key/RollBack`,
      GET_LOCALIZATION_TIMELINE: `${UILM_BASE}/Key/GetLocalizationTimeline`,
      GET_TIMELINE_BY_OPERATION_ID: `${UILM_BASE}/Key/GetTimelineByOperationId`,
    } as const;

    it("should expose exactly 16 key endpoints", () => {
      expect(Object.keys(LANGUAGE_KEY_ENDPOINTS)).toHaveLength(16);
    });

    it.each(Object.entries(expected))("should expose %s = %s", (key, value) => {
      expect((LANGUAGE_KEY_ENDPOINTS as Record<string, string>)[key]).toBe(
        value,
      );
    });

    it("should start every key endpoint with the UILM base", () => {
      for (const [, value] of Object.entries(LANGUAGE_KEY_ENDPOINTS)) {
        expect(value.startsWith(UILM_BASE)).toBe(true);
      }
    });
  });

  // ─── LANGUAGE_MODULE_ENDPOINTS ───────────────────────────────────────────
  describe("LANGUAGE_MODULE_ENDPOINTS", () => {
    it("should expose exactly 4 module endpoints", () => {
      expect(Object.keys(LANGUAGE_MODULE_ENDPOINTS)).toHaveLength(4);
    });

    it.each([
      ["GETS", `${UILM_BASE}/Module/GetModulesForCurrentTenant`],
      ["SAVE", `${UILM_BASE}/Module/Save`],
      ["DELETE", `${UILM_BASE}/Module/Delete`],
      ["TAG_GLOSSARY", `${UILM_BASE}/Module/TagGlossary`],
    ] as const)("should expose %s = %s", (key, value) => {
      expect((LANGUAGE_MODULE_ENDPOINTS as Record<string, string>)[key]).toBe(
        value,
      );
    });
  });

  // ─── LANGUAGE_ENDPOINTS ─────────────────────────────────────────────────
  describe("LANGUAGE_ENDPOINTS", () => {
    it("should expose exactly 4 language endpoints", () => {
      expect(Object.keys(LANGUAGE_ENDPOINTS)).toHaveLength(4);
    });

    it.each([
      ["GETS", `${UILM_BASE}/Language/GetLanguagesForCurrentTenant`],
      ["SAVE", `${UILM_BASE}/Language/Save`],
      ["DELETE", `${UILM_BASE}/Language/Delete`],
      ["SET_DEFAULT", `${UILM_BASE}/Language/SetDefault`],
    ] as const)("should expose %s = %s", (key, value) => {
      expect((LANGUAGE_ENDPOINTS as Record<string, string>)[key]).toBe(value);
    });
  });

  // ─── LANGUAGE_ASSISTANT_ENDPOINTS ────────────────────────────────────────
  describe("LANGUAGE_ASSISTANT_ENDPOINTS", () => {
    it("should expose exactly 1 assistant endpoint", () => {
      expect(Object.keys(LANGUAGE_ASSISTANT_ENDPOINTS)).toHaveLength(1);
    });

    it("should expose GET_TRANSLATION_SUGGESTION", () => {
      expect(LANGUAGE_ASSISTANT_ENDPOINTS.GET_TRANSLATION_SUGGESTION).toBe(
        `${UILM_BASE}/Assistant/GetTranslationSuggestion`,
      );
    });
  });

  // ─── CONFIG_ENDPOINTS ───────────────────────────────────────────────────
  describe("CONFIG_ENDPOINTS", () => {
    it("should expose exactly 2 config endpoints", () => {
      expect(Object.keys(CONFIG_ENDPOINTS)).toHaveLength(2);
    });

    it.each([
      ["GET_WEBHOOK", `${UILM_BASE}/Config/GetWebHookForCurrentTenant`],
      ["SAVE_WEBHOOK", `${UILM_BASE}/Config/SaveWebHook`],
    ] as const)("should expose %s = %s", (key, value) => {
      expect((CONFIG_ENDPOINTS as Record<string, string>)[key]).toBe(value);
    });
  });

  // ─── GLOSSARY_ENDPOINTS ─────────────────────────────────────────────────
  describe("GLOSSARY_ENDPOINTS", () => {
    it("should expose exactly 5 glossary endpoints", () => {
      expect(Object.keys(GLOSSARY_ENDPOINTS)).toHaveLength(5);
    });

    it.each([
      ["GET", `${UILM_BASE}/Glossary/Get`],
      ["GETS", `${UILM_BASE}/Glossary/Gets`],
      ["SAVE", `${UILM_BASE}/Glossary/Save`],
      ["DELETE", `${UILM_BASE}/Glossary/Delete`],
      [
        "GET_SUGGESTED_GLOSSARIES",
        `${UILM_BASE}/Glossary/GetSuggestedGlossaries`,
      ],
    ] as const)("should expose %s = %s", (key, value) => {
      expect((GLOSSARY_ENDPOINTS as Record<string, string>)[key]).toBe(value);
    });
  });

  // ─── cross-cutting ──────────────────────────────────────────────────────
  describe("cross-cutting", () => {
    it("should not produce duplicate endpoint paths across all groups", () => {
      const all = [
        ...Object.values(LANGUAGE_KEY_ENDPOINTS),
        ...Object.values(LANGUAGE_MODULE_ENDPOINTS),
        ...Object.values(LANGUAGE_ENDPOINTS),
        ...Object.values(LANGUAGE_ASSISTANT_ENDPOINTS),
        ...Object.values(CONFIG_ENDPOINTS),
        ...Object.values(GLOSSARY_ENDPOINTS),
      ];
      expect(new Set(all).size).toBe(all.length);
    });

    it("should use consistent /api base for UILM-derived endpoints", () => {
      // Every endpoint should be under the UILM base.
      const all = [
        ...Object.values(LANGUAGE_KEY_ENDPOINTS),
        ...Object.values(LANGUAGE_MODULE_ENDPOINTS),
        ...Object.values(LANGUAGE_ENDPOINTS),
        ...Object.values(LANGUAGE_ASSISTANT_ENDPOINTS),
        ...Object.values(CONFIG_ENDPOINTS),
        ...Object.values(GLOSSARY_ENDPOINTS),
      ];
      for (const url of all) {
        expect(url.startsWith(`${UILM_BASE}/`)).toBe(true);
      }
    });
  });
});
