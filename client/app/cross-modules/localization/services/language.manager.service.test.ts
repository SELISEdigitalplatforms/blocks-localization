import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import { ensureLocalizationSession } from "@/lib/session-refresh";
import {
  CONFIG_ENDPOINTS,
  GLOSSARY_ENDPOINTS,
  LANGUAGE_ASSISTANT_ENDPOINTS,
  LANGUAGE_ENDPOINTS,
  LANGUAGE_KEY_ENDPOINTS,
  LANGUAGE_MODULE_ENDPOINTS,
} from "../constants/endpoint.constant";
import { LanguageManagerService } from "./language.manager.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    localizationService: {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/session-refresh", () => ({
  ensureLocalizationSession: vi.fn(),
}));

describe("LanguageManagerService", () => {
  const projectKey = "project-key";
  const http = serviceInstances.localizationService;
  let service: LanguageManagerService;

  beforeEach(() => {
    service = new LanguageManagerService();
    vi.clearAllMocks();
  });

  // ─── fetchBlocksLanguageKey ──────────────────────────────────────────────
  describe("fetchBlocksLanguageKey", () => {
    it("should POST with all fields present", async () => {
      const response = { totalCount: 0, keys: [] };
      vi.mocked(http.post).mockResolvedValue(response);

      const result = await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
      });

      expect(result).toBe(response);
      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.GETS,
        expect.objectContaining({
          projectKey,
          pageNumber: 0,
          pageSize: 25,
        }),
      );
    });

    it("should delete createDateRange entirely when not provided", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });

      await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload).not.toHaveProperty("createDateRange");
    });

    it("should delete createDateRange.startDate when it is empty string", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });

      await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
        createDateRange: { startDate: "", endDate: "2026-12-31" },
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload.createDateRange).not.toHaveProperty("startDate");
      expect(payload.createDateRange.endDate).toBe("2026-12-31");
    });

    it("should delete createDateRange.endDate when it is empty string", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });

      await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
        createDateRange: { startDate: "2026-01-01", endDate: "" },
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload.createDateRange.startDate).toBe("2026-01-01");
      expect(payload.createDateRange).not.toHaveProperty("endDate");
    });

    it("should delete lastUpdateDateRange entirely when not provided", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });

      await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload).not.toHaveProperty("lastUpdateDateRange");
    });

    it("should delete lastUpdateDateRange.startDate when it is empty string", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });

      await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
        lastUpdateDateRange: { startDate: "", endDate: "2026-12-31" },
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload.lastUpdateDateRange).not.toHaveProperty("startDate");
      expect(payload.lastUpdateDateRange.endDate).toBe("2026-12-31");
    });

    it("should delete lastUpdateDateRange.endDate when it is empty string", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });

      await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
        lastUpdateDateRange: { startDate: "2026-01-01", endDate: "" },
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload.lastUpdateDateRange.startDate).toBe("2026-01-01");
      expect(payload.lastUpdateDateRange).not.toHaveProperty("endDate");
    });

    it("should preserve both date ranges when fully populated", async () => {
      vi.mocked(http.post).mockResolvedValue({ totalCount: 0, keys: [] });

      await service.fetchBlocksLanguageKey({
        projectKey,
        pageNumber: 0,
        pageSize: 25,
        searchKey: "",
        moduleIds: [],
        isPartiallyTranslated: false,
        sortProperty: "keyName",
        isDescending: false,
        createDateRange: { startDate: "2026-01-01", endDate: "2026-01-31" },
        lastUpdateDateRange: { startDate: "2026-02-01", endDate: "2026-02-28" },
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload.createDateRange).toEqual({
        startDate: "2026-01-01",
        endDate: "2026-01-31",
      });
      expect(payload.lastUpdateDateRange).toEqual({
        startDate: "2026-02-01",
        endDate: "2026-02-28",
      });
    });
  });

  // ─── fetchBlocksLanguageKeyById ──────────────────────────────────────────
  describe("fetchBlocksLanguageKeyById", () => {
    it("should GET with itemId in query string", async () => {
      const key = {
        itemId: "key-1",
        keyName: "k",
        moduleId: "m",
        routes: [],
        glossaryIds: [],
        resources: [],
        isPartiallyTranslated: false,
        lastUpdateDate: "",
        createDate: "",
        context: "",
      };
      vi.mocked(http.get).mockResolvedValue(key);

      await expect(
        service.fetchBlocksLanguageKeyById({ projectKey, itemId: "key-1" }),
      ).resolves.toBe(key);

      expect(http.get).toHaveBeenCalledWith(
        `${LANGUAGE_KEY_ENDPOINTS.GET}?itemId=key-1`,
      );
    });
  });

  // ─── fetchBlocksLanguageModules ──────────────────────────────────────────
  describe("fetchBlocksLanguageModules", () => {
    it("should GET modules", async () => {
      const modules = [];
      vi.mocked(http.get).mockResolvedValue(modules);

      await expect(service.fetchBlocksLanguageModules(projectKey)).resolves.toBe(
        modules,
      );

      expect(http.get).toHaveBeenCalledWith(
        LANGUAGE_MODULE_ENDPOINTS.GETS,
      );
    });
  });

  // ─── fetchBlocksLanguages ────────────────────────────────────────────────
  describe("fetchBlocksLanguages", () => {
    it("refreshes the session before fetching project languages", async () => {
      const languages = [
        {
          itemId: "en-id",
          languageName: "English",
          languageCode: "en-US",
          isDefault: true,
        },
        {
          itemId: "de-id",
          languageName: "German",
          languageCode: "de-DE",
          isDefault: false,
        },
      ];

      vi.mocked(http.get).mockResolvedValue(languages);
      vi.mocked(ensureLocalizationSession).mockResolvedValue(undefined);

      await expect(service.fetchBlocksLanguages(projectKey)).resolves.toEqual(
        languages,
      );

      expect(ensureLocalizationSession).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith(
        LANGUAGE_ENDPOINTS.GETS,
      );
    });

    it("does not fetch languages when the session refresh fails", async () => {
      vi.mocked(ensureLocalizationSession).mockRejectedValue(
        new Error("Failed to refresh token"),
      );

      await expect(service.fetchBlocksLanguages(projectKey)).rejects.toThrow(
        "Failed to refresh token",
      );

      expect(ensureLocalizationSession).toHaveBeenCalledTimes(1);
      expect(http.get).not.toHaveBeenCalled();
    });
  });

  // ─── saveBlocksLanguageKey ───────────────────────────────────────────────
  describe("saveBlocksLanguageKey", () => {
    it("should POST with isNewKey defaulted to false", async () => {
      const response = {
        success: true,
        errorMessage: "",
        validationErrors: [],
      };
      vi.mocked(http.post).mockResolvedValue(response);

      const result = await service.saveBlocksLanguageKey({
        itemId: "key-1",
        keyName: "key",
        moduleId: "mod",
        resources: [{ value: "v", culture: "en-US" }],
        routes: [],
        isPartiallyTranslated: false,
        projectKey,
        // isNewKey omitted → defaults to false
      });

      expect(result).toBe(response);
      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload.isNewKey).toBe(false);
    });

    it("should preserve isNewKey=true when explicitly provided", async () => {
      vi.mocked(http.post).mockResolvedValue({
        success: true,
        errorMessage: "",
        validationErrors: [],
      });

      await service.saveBlocksLanguageKey({
        itemId: "",
        keyName: "newKey",
        moduleId: "mod",
        resources: [],
        routes: [],
        isPartiallyTranslated: false,
        projectKey,
        isNewKey: true,
      });

      const [, payload] = vi.mocked(http.post).mock.calls[0];
      expect(payload.isNewKey).toBe(true);
    });
  });

  // ─── saveLanguageModule ──────────────────────────────────────────────────
  describe("saveLanguageModule", () => {
    it("should POST to the module SAVE endpoint", async () => {
      const response = {
        errorMessage: null,
        success: true,
        validationErrors: null,
      };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = { moduleName: "Module A", projectKey };
      await expect(service.saveLanguageModule(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_MODULE_ENDPOINTS.SAVE,
        payload,
      );
    });
  });

  // ─── getLanguageModule ───────────────────────────────────────────────────
  describe("getLanguageModule", () => {
    it("should delegate to fetchBlocksLanguageModules", async () => {
      const modules = [];
      vi.mocked(http.get).mockResolvedValue(modules);

      await expect(service.getLanguageModule(projectKey)).resolves.toBe(modules);

      expect(http.get).toHaveBeenCalledWith(
        LANGUAGE_MODULE_ENDPOINTS.GETS,
      );
    });
  });

  // ─── deleteLanguageModule ────────────────────────────────────────────────
  describe("deleteLanguageModule", () => {
    it("should DELETE without targetModuleId when not provided", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.delete).mockResolvedValue(response);

      await expect(
        service.deleteLanguageModule({
          itemId: "mod-1",
          projectKey,
        }),
      ).resolves.toBe(response);

      const calledUrl = vi.mocked(http.delete).mock.calls[0][0];
      expect(calledUrl).toContain(`${LANGUAGE_MODULE_ENDPOINTS.DELETE}?`);
      expect(calledUrl).toContain("itemId=mod-1");
      expect(calledUrl).toContain(`projectKey=${projectKey}`);
      expect(calledUrl).not.toContain("targetModuleId");
    });

    it("should include targetModuleId in query string when provided", async () => {
      vi.mocked(http.delete).mockResolvedValue({
        errors: null,
        isSuccess: true,
      });

      await service.deleteLanguageModule({
        itemId: "mod-1",
        targetModuleId: "mod-2",
        projectKey,
      });

      const calledUrl = vi.mocked(http.delete).mock.calls[0][0];
      expect(calledUrl).toContain("targetModuleId=mod-2");
    });
  });

  // ─── tagGlossary ──────────────────────────────────────────────────────────
  describe("tagGlossary", () => {
    it("should POST to TAG_GLOSSARY endpoint with payload", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        moduleId: "mod-1",
        glossaryIds: ["g-1", "g-2"],
        projectKey,
      };
      await expect(service.tagGlossary(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_MODULE_ENDPOINTS.TAG_GLOSSARY,
        payload,
      );
    });
  });

  // ─── saveLanguage ────────────────────────────────────────────────────────
  describe("saveLanguage", () => {
    it("should POST to LANGUAGE.SAVE endpoint", async () => {
      const response = { errorMessage: null, success: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        languageName: "English",
        languageCode: "en-US",
        projectKey,
      };
      await expect(service.saveLanguage(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_ENDPOINTS.SAVE,
        payload,
      );
    });
  });

  // ─── deleteLanguageKey ───────────────────────────────────────────────────
  describe("deleteLanguageKey", () => {
    it("should DELETE with itemId and projectKey query params", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.delete).mockResolvedValue(response);

      await expect(
        service.deleteLanguageKey({ itemId: "key-1", projectKey }),
      ).resolves.toBe(response);

      expect(http.delete).toHaveBeenCalledWith(
        `${LANGUAGE_KEY_ENDPOINTS.DELETE}?itemId=key-1&projectKey=${projectKey}`,
      );
    });
  });

  // ─── deleteLanguageKeys ──────────────────────────────────────────────────
  describe("deleteLanguageKeys", () => {
    it("should POST to DELETE_KEYS endpoint", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = { itemIds: ["k-1", "k-2"] };
      await expect(service.deleteLanguageKeys(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.DELETE_KEYS,
        payload,
      );
    });
  });

  // ─── translateLanguageKeys ───────────────────────────────────────────────
  describe("translateLanguageKeys", () => {
    it("should POST to TRANSLATE_KEYS endpoint", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        keyIds: ["k-1"],
        ProjectKey: projectKey,
        defaultLanguage: "en-US",
      };
      await expect(service.translateLanguageKeys(payload)).resolves.toBe(
        response,
      );

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.TRANSLATE_KEYS,
        payload,
      );
    });
  });

  // ─── deleteLanguage ──────────────────────────────────────────────────────
  describe("deleteLanguage", () => {
    it("should DELETE with languageName and projectKey query params", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.delete).mockResolvedValue(response);

      await expect(
        service.deleteLanguage({
          languageName: "English",
          projectKey,
        }),
      ).resolves.toBe(response);

      expect(http.delete).toHaveBeenCalledWith(
        `${LANGUAGE_ENDPOINTS.DELETE}?languageName=English&projectKey=${projectKey}`,
      );
    });
  });

  // ─── setDefault ──────────────────────────────────────────────────────────
  describe("setDefault", () => {
    it("should POST to SET_DEFAULT endpoint", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = { languageName: "English", projectKey };
      await expect(service.setDefault(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_ENDPOINTS.SET_DEFAULT,
        payload,
      );
    });
  });

  // ─── generateUilmFile ────────────────────────────────────────────────────
  describe("generateUilmFile", () => {
    it("should POST to GENERATE_UILM_FILE endpoint", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = { guid: "abc", projectKey };
      await expect(service.generateUilmFile(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.GENERATE_UILM_FILE,
        payload,
      );
    });
  });

  // ─── getTranslationSuggestion ────────────────────────────────────────────
  describe("getTranslationSuggestion", () => {
    it("should POST to ASSISTANT endpoint with payload", async () => {
      const response = {
        content: "Bonjour",
        errors: null,
        isSuccess: true,
      };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        sourceText: "Hello",
        destinationLanguage: "French",
        currentLanguage: "en-US",
        temperature: 0.7,
        projectKey,
      };
      await expect(service.getTranslationSuggestion(payload)).resolves.toBe(
        response,
      );

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_ASSISTANT_ENDPOINTS.GET_TRANSLATION_SUGGESTION,
        payload,
      );
    });
  });

  // ─── translateAll ────────────────────────────────────────────────────────
  describe("translateAll", () => {
    it("should POST to TRANSLATE_ALL endpoint", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        projectKey,
        messageCoRelationId: "corr-1",
        defaultLanguage: "en-US",
        moduleId: "mod-1",
      };
      await expect(service.translateAll(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.TRANSLATE_ALL,
        payload,
      );
    });
  });

  // ─── translateKey ────────────────────────────────────────────────────────
  describe("translateKey", () => {
    it("should POST to TRANSLATE_KEY endpoint", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        keyId: "k-1",
        projectKey,
        defaultLanguage: "en-US",
        messageCoRelationId: "corr-1",
      };
      await expect(service.translateKey(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.TRANSLATE_KEY,
        payload,
      );
    });
  });

  // ─── importLanguageFile ──────────────────────────────────────────────────
  describe("importLanguageFile", () => {
    it("should POST to UILM_IMPORT endpoint", async () => {
      const response = { success: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        messageCoRelationId: "corr",
        fileId: "file-1",
        projectKey,
      };
      await expect(service.importLanguageFile(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.UILM_IMPORT,
        payload,
      );
    });
  });

  // ─── saveLanguageKeyUilmExport ───────────────────────────────────────────
  describe("saveLanguageKeyUilmExport", () => {
    it("should POST to UILM_EXPORT endpoint", async () => {
      const response: { errors: null; isSuccess: boolean } = {
        errors: null,
        isSuccess: true,
      };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        outputType: 1,
        messageCoRelationId: "corr",
        appIds: ["app-1"],
        languages: ["en-US"],
        referenceFileId: "ref-1",
        callerTenantId: "tenant-1",
        projectKey,
      };
      await expect(
        service.saveLanguageKeyUilmExport(payload),
      ).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.UILM_EXPORT,
        payload,
      );
    });
  });

  // ─── getKeysTimeline ─────────────────────────────────────────────────────
  describe("getKeysTimeline", () => {
    it("should GET timeline with the correct query string", async () => {
      const response = { totalCount: 0, timelines: [] };
      vi.mocked(http.get).mockResolvedValue(response);

      const payload = {
        pageNumber: 1,
        pageSize: 20,
        keyId: "k-1",
        projectKey,
      };
      await expect(service.getKeysTimeline(payload)).resolves.toBe(response);

      expect(http.get).toHaveBeenCalledWith(
        `${LANGUAGE_KEY_ENDPOINTS.GET_TIMELINE}?pageSize=20&pageNumber=1&EntityId=k-1`,
      );
    });
  });

  // ─── getExportHistory ────────────────────────────────────────────────────
  describe("getExportHistory", () => {
    it("should build URL with required params only", async () => {
      const response = { totalCount: 0, uilmExportedFiles: [] };
      vi.mocked(http.get).mockResolvedValue(response);

      await service.getExportHistory({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        filters: {},
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("PageNumber=0");
      expect(url).toContain("PageSize=20");
      expect(url).not.toContain("SearchText=");
      expect(url).not.toContain("CreateDateRange");
    });

    it("should include SearchText when provided", async () => {
      vi.mocked(http.get).mockResolvedValue({
        totalCount: 0,
        uilmExportedFiles: [],
      });

      await service.getExportHistory({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        filters: { searchText: "hello" },
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("SearchText=hello");
    });

    it("should include both date params when provided", async () => {
      vi.mocked(http.get).mockResolvedValue({
        totalCount: 0,
        uilmExportedFiles: [],
      });

      await service.getExportHistory({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        filters: {
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("CreateDateRange.StartDate=2026-01-01");
      expect(url).toContain("CreateDateRange.EndDate=2026-12-31");
    });
  });

  // ─── revertKeyTimeline ───────────────────────────────────────────────────
  describe("revertKeyTimeline", () => {
    it("should POST to ROLLBACK endpoint", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = { itemId: "k-1", projectKey };
      await expect(service.revertKeyTimeline(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        LANGUAGE_KEY_ENDPOINTS.ROLLBACK,
        payload,
      );
    });
  });

  // ─── getLocalizationTimeline ─────────────────────────────────────────────
  describe("getLocalizationTimeline", () => {
    it("should build URL with only required params", async () => {
      const response = { totalCount: 0, operations: [] };
      vi.mocked(http.get).mockResolvedValue(response);

      await service.getLocalizationTimeline({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("PageSize=20");
      expect(url).toContain("PageNumber=0");
      expect(url).not.toContain("UserId=");
      expect(url).not.toContain("LogFrom=");
    });

    it("should include userId, logFrom, logFromValues, excludeLogFromValues when provided", async () => {
      vi.mocked(http.get).mockResolvedValue({ totalCount: 0, operations: [] });

      await service.getLocalizationTimeline({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        userId: "u-1",
        logFrom: "system",
        logFromValues: ["a", "b"],
        excludeLogFromValues: ["x"],
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("UserId=u-1");
      expect(url).toContain("LogFrom=system");
      expect(url).toContain("LogFromValues=a");
      expect(url).toContain("LogFromValues=b");
      expect(url).toContain("ExcludeLogFromValues=x");
    });

    it("should include createDateRange start/end when provided", async () => {
      vi.mocked(http.get).mockResolvedValue({ totalCount: 0, operations: [] });

      await service.getLocalizationTimeline({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        createDateRange: {
          startDate: "2026-01-01",
          endDate: "2026-12-31",
        },
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("CreateDateRange.StartDate=2026-01-01");
      expect(url).toContain("CreateDateRange.EndDate=2026-12-31");
    });
  });

  // ─── getTimelineByOperationId ────────────────────────────────────────────
  describe("getTimelineByOperationId", () => {
    it("should GET with all 4 params", async () => {
      const response = { totalCount: 0, timelines: [] };
      vi.mocked(http.get).mockResolvedValue(response);

      const payload = {
        operationId: "op-1",
        projectKey,
        pageNumber: 0,
        pageSize: 20,
      };
      await expect(service.getTimelineByOperationId(payload)).resolves.toBe(
        response,
      );

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("OperationId=op-1");
      expect(url).toContain("PageSize=20");
      expect(url).toContain("PageNumber=0");
    });
  });

  // ─── fetchGlossaries ─────────────────────────────────────────────────────
  describe("fetchGlossaries", () => {
    it("should build URL with required params only", async () => {
      const response = { items: [], totalCount: 0 };
      vi.mocked(http.get).mockResolvedValue(response);

      await service.fetchGlossaries({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain(`${GLOSSARY_ENDPOINTS.GETS}?`);
      expect(url).toContain("PageNumber=0");
      expect(url).toContain("PageSize=20");
      expect(url).not.toContain("SearchText=");
      expect(url).not.toContain("IsGlobal=");
      expect(url).not.toContain("ModuleId=");
    });

    it("should include SearchText when provided", async () => {
      vi.mocked(http.get).mockResolvedValue({ items: [], totalCount: 0 });

      await service.fetchGlossaries({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        searchText: "term",
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("SearchText=term");
    });

    it("should include IsGlobal when explicitly provided (true)", async () => {
      vi.mocked(http.get).mockResolvedValue({ items: [], totalCount: 0 });

      await service.fetchGlossaries({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        isGlobal: true,
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("IsGlobal=true");
    });

    it("should include IsGlobal when explicitly provided (false)", async () => {
      vi.mocked(http.get).mockResolvedValue({ items: [], totalCount: 0 });

      await service.fetchGlossaries({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        isGlobal: false,
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("IsGlobal=false");
    });

    it("should include ModuleId when provided", async () => {
      vi.mocked(http.get).mockResolvedValue({ items: [], totalCount: 0 });

      await service.fetchGlossaries({
        projectKey,
        pageNumber: 0,
        pageSize: 20,
        moduleId: "mod-1",
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("ModuleId=mod-1");
    });
  });

  // ─── saveGlossary ────────────────────────────────────────────────────────
  describe("saveGlossary", () => {
    it("should POST to SAVE endpoint", async () => {
      const response = {
        success: true,
        errorMessage: "",
        validationErrors: [],
      };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        name: "term",
        projectKey,
      };
      await expect(service.saveGlossary(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        GLOSSARY_ENDPOINTS.SAVE,
        payload,
      );
    });
  });

  // ─── deleteGlossary ──────────────────────────────────────────────────────
  describe("deleteGlossary", () => {
    it("should DELETE with itemId", async () => {
      const response = { errors: null, isSuccess: true };
      vi.mocked(http.delete).mockResolvedValue(response);

      await expect(
        service.deleteGlossary({ itemId: "g-1" }),
      ).resolves.toBe(response);

      expect(http.delete).toHaveBeenCalledWith(
        `${GLOSSARY_ENDPOINTS.DELETE}?itemId=g-1`,
      );
    });
  });

  // ─── getSuggestedGlossaries ──────────────────────────────────────────────
  describe("getSuggestedGlossaries", () => {
    it("should GET without maxResults when not provided", async () => {
      const response = { suggestedGlossaries: [] };
      vi.mocked(http.get).mockResolvedValue(response);

      await expect(
        service.getSuggestedGlossaries({ itemId: "k-1", projectKey }),
      ).resolves.toBe(response);

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain(`${GLOSSARY_ENDPOINTS.GET_SUGGESTED_GLOSSARIES}?`);
      expect(url).toContain("ItemId=k-1");
      expect(url).not.toContain("MaxResults=");
    });

    it("should include maxResults when provided", async () => {
      vi.mocked(http.get).mockResolvedValue({ suggestedGlossaries: [] });

      await service.getSuggestedGlossaries({
        itemId: "k-1",
        projectKey,
        maxResults: 5,
      });

      const url = vi.mocked(http.get).mock.calls[0][0];
      expect(url).toContain("MaxResults=5");
    });
  });

  // ─── getGlossaryById ─────────────────────────────────────────────────────
  describe("getGlossaryById", () => {
    it("should GET by itemId", async () => {
      const response = {
        itemId: "g-1",
        name: "term",
        createDate: "",
        lastUpdateDate: "",
      };
      vi.mocked(http.get).mockResolvedValue(response);

      await expect(
        service.getGlossaryById({ itemId: "g-1" }),
      ).resolves.toBe(response);

      expect(http.get).toHaveBeenCalledWith(
        `${GLOSSARY_ENDPOINTS.GET}?itemId=g-1`,
      );
    });
  });

  // ─── getWebhook ──────────────────────────────────────────────────────────
  describe("getWebhook", () => {
    it("should GET the webhook config without projectKey query param", async () => {
      const response = {
        url: "https://example.com",
        contentType: "application/json",
        blocksWebhookSecret: { secret: "s", headerKey: "h" },
        isDisabled: false,
        projectKey,
      };
      vi.mocked(http.get).mockResolvedValue(response);

      await expect(service.getWebhook()).resolves.toBe(response);

      expect(http.get).toHaveBeenCalledWith(CONFIG_ENDPOINTS.GET_WEBHOOK);
    });
  });

  // ─── saveWebhook ─────────────────────────────────────────────────────────
  describe("saveWebhook", () => {
    it("should POST the webhook config", async () => {
      const response = { success: true, errorMessage: null };
      vi.mocked(http.post).mockResolvedValue(response);

      const payload = {
        url: "https://example.com",
        contentType: "application/json",
        blocksWebhookSecret: { secret: "s", headerKey: "h" },
        isDisabled: false,
        projectKey,
      };
      await expect(service.saveWebhook(payload)).resolves.toBe(response);

      expect(http.post).toHaveBeenCalledWith(
        CONFIG_ENDPOINTS.SAVE_WEBHOOK,
        payload,
      );
    });
  });
});
