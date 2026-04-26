/**
 * Shared mock factory functions for localization tests.
 *
 * IMPORTANT: vi.mock() is hoisted by Vitest and MUST be called directly in each
 * test file — it cannot be imported from a shared file. These factories provide
 * the mock return values to reduce duplication across test files.
 *
 * Factory names use the `mock` prefix so Vitest's hoisting allows referencing them.
 *
 * Usage in test files (vi.mock calls must be at the top level of the test file):
 *
 *   vi.mock("@/modules/identifier/state/use-project-store", () => mockProjectStoreFactory());
 *   vi.mock("@blocks-localization/services/language.manager.service", () => mockLanguageServiceFactory());
 */
import { vi } from "vitest";

export const mockLanguageServiceFactory = () => ({
  languageManagerService: {
    fetchBlocksLanguageKey: vi.fn(),
    fetchBlocksLanguageKeyById: vi.fn(),
    fetchBlocksLanguageModules: vi.fn(),
    fetchBlocksLanguages: vi.fn(),
    saveBlocksLanguageKey: vi.fn(),
    saveLanguageModule: vi.fn(),
    getLanguageModule: vi.fn(),
    saveLanguage: vi.fn(),
    deleteLanguageKey: vi.fn(),
    deleteLanguage: vi.fn(),
    setDefault: vi.fn(),
    generateUilmFile: vi.fn(),
    getTranslationSuggestion: vi.fn(),
    translateAll: vi.fn(),
    translateKey: vi.fn(),
    importLanguageFile: vi.fn(),
    saveLanguageKeyUilmExport: vi.fn(),
    getKeysTimeline: vi.fn(),
    getExportHistory: vi.fn(),
    revertKeyTimeline: vi.fn(),
  },
});
