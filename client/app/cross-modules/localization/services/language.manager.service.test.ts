import { describe, expect, it, vi, beforeEach } from "vitest";
import { serviceInstances } from "@/lib/http-client";
import { ensureLocalizationSession } from "@/lib/session-refresh";
import { LANGUAGE_ENDPOINTS } from "../constants/endpoint.constant";
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
  const getLanguagesUrl = `${LANGUAGE_ENDPOINTS.GETS}?projectKey=${projectKey}`;
  const http = serviceInstances.localizationService;
  let service: LanguageManagerService;

  beforeEach(() => {
    service = new LanguageManagerService();
    vi.clearAllMocks();
  });

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
      expect(http.get).toHaveBeenCalledWith(getLanguagesUrl);
    });

    it("does not depend on environment-specific fallback language codes", async () => {
      const projectLanguages = [
        {
          itemId: "en-id",
          languageName: "English",
          languageCode: "en-US",
          isDefault: true,
        },
        {
          itemId: "fr-id",
          languageName: "French",
          languageCode: "fr-FR",
          isDefault: false,
        },
      ];

      vi.mocked(http.get).mockResolvedValue(projectLanguages);
      vi.mocked(ensureLocalizationSession).mockResolvedValue(undefined);

      await expect(service.fetchBlocksLanguages(projectKey)).resolves.toEqual(
        projectLanguages,
      );

      expect(ensureLocalizationSession).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith(getLanguagesUrl);
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
});
