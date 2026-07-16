import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import {
  CLOUD_BUILD_ENDPOINTS,
  DOMAIN_ENDPOINTS,
  MIGRATION_ENDPOINTS,
  PROJECT_ENDPOINTS,
  SUBSCRIPTION_ENDPOINTS,
} from "@blocks-identifier/constants/endpoint.constant";
import { ProjectService } from "./project.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    logicService: {
      get: vi.fn(),
      post: vi.fn(),
    },
  },
}));

const http = serviceInstances.logicService;
const ABS = { absoluteUrl: true };

describe("identifier/services/project.service", () => {
  let service: ProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService();
    vi.mocked(http.get).mockResolvedValue({} as never);
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  afterEach(() => vi.restoreAllMocks());

  it("getProjects should build a paged url with defaults", () => {
    service.getProjects();
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GETS}?page=0&pageSize=100&tenantGroupId=`,
      undefined,
      ABS,
    );
  });

  it("getProjects should honor explicit args", () => {
    service.getProjects(2, 25, "g1");
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GETS}?page=2&pageSize=25&tenantGroupId=g1`,
      undefined,
      ABS,
    );
  });

  it("getAssets should encode tenantGroupId", () => {
    service.getAssets("grp");
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GET_ASSET}?TenantGroupId=grp`,
      undefined,
      ABS,
    );
  });

  it("addAssets should POST to ADD_ASSET", () => {
    const payload = { tenantGroupId: "g", resource: { name: "n", link: "l", resourceId: "r" } };
    service.addAssets(payload);
    expect(http.post).toHaveBeenCalledWith(
      PROJECT_ENDPOINTS.ADD_ASSET,
      payload,
      undefined,
      ABS,
    );
  });

  it("getEnvRepositories should build a repos-list url", () => {
    service.getEnvRepositories("pk");
    expect(http.get).toHaveBeenCalledWith(
      `${CLOUD_BUILD_ENDPOINTS.REPOS_LIST}?projectkey=pk`,
      undefined,
      ABS,
    );
  });

  it("repoUpdate should POST to REPO_UPDATE", () => {
    const payload = { projectKey: "p", projectEnv: "dev", repoWithDomains: [] };
    service.repoUpdate(payload);
    expect(http.post).toHaveBeenCalledWith(
      CLOUD_BUILD_ENDPOINTS.REPO_UPDATE,
      payload,
      undefined,
      ABS,
    );
  });

  it("getProject should query by projectId", () => {
    service.getProject({ projectId: "abc" });
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GET}?projectId=abc`,
      undefined,
      ABS,
    );
  });

  it("createProject should POST to CREATE", () => {
    const payload = { name: "n" } as never;
    service.createProject(payload);
    expect(http.post).toHaveBeenCalledWith(
      PROJECT_ENDPOINTS.CREATE,
      payload,
      undefined,
      ABS,
    );
  });

  it("validateCNameProject should POST to DOMAIN.CONFIGURE", () => {
    const payload = { projectKey: "p", cookieDomain: "d" };
    service.validateCNameProject(payload);
    expect(http.post).toHaveBeenCalledWith(
      DOMAIN_ENDPOINTS.CONFIGURE,
      payload,
      undefined,
      ABS,
    );
  });

  it("updateProject / updateTenantGroup / disableProject should POST to their endpoints", () => {
    service.updateProject({ name: "n" } as never);
    service.updateTenantGroup({ name: "n", tenantGroupId: "g" });
    service.disableProject({ projectKey: "p" });
    expect(http.post).toHaveBeenCalledWith(PROJECT_ENDPOINTS.UPDATE, expect.anything(), undefined, ABS);
    expect(http.post).toHaveBeenCalledWith(PROJECT_ENDPOINTS.UPDATE_TENANT_GROUP, expect.anything(), undefined, ABS);
    expect(http.post).toHaveBeenCalledWith(PROJECT_ENDPOINTS.DISABLE, expect.anything(), undefined, ABS);
  });

  it("getProjectLoginOption should GET the login options endpoint", () => {
    service.getProjectLoginOption();
    expect(http.get).toHaveBeenCalledWith(
      PROJECT_ENDPOINTS.GET_LOGIN_OPTIONS,
      undefined,
      ABS,
    );
  });

  it("migration methods should POST/GET to migration endpoints", () => {
    service.initiateMigration({} as never);
    service.verifyMigration({} as never);
    service.getMigrationStatus("g1");
    expect(http.post).toHaveBeenCalledWith(MIGRATION_ENDPOINTS.MIGRATE, expect.anything(), undefined, ABS);
    expect(http.post).toHaveBeenCalledWith(MIGRATION_ENDPOINTS.VERIFY, expect.anything(), undefined, ABS);
    expect(http.get).toHaveBeenCalledWith(
      `${MIGRATION_ENDPOINTS.GET_STATUS}?tenantGroupId=g1`,
      undefined,
      ABS,
    );
  });

  it("savePublicCertificate should POST to UPDATE_TOKEN_VALIDATION", () => {
    service.savePublicCertificate({} as never);
    expect(http.post).toHaveBeenCalledWith(
      PROJECT_ENDPOINTS.UPDATE_TOKEN_VALIDATION,
      expect.anything(),
      undefined,
      ABS,
    );
  });

  it("getPublicCertificateInformation should query by ProjectKey", () => {
    service.getPublicCertificateInformation("pk");
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GET_TOKEN_VALIDATION}?ProjectKey=pk`,
      undefined,
      ABS,
    );
  });

  it("getJwtClaim should include ProjectKey and ItemId", () => {
    service.getJwtClaim({ projectKey: "p", itemId: "i" });
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GET_JWT_CLAIMS}?ProjectKey=p&ItemId=i`,
      undefined,
      ABS,
    );
  });

  it("addJwtClaim should POST to SAVE_JWT_CLAIMS", () => {
    service.addJwtClaim({} as never);
    expect(http.post).toHaveBeenCalledWith(
      PROJECT_ENDPOINTS.SAVE_JWT_CLAIMS,
      expect.anything(),
      undefined,
      ABS,
    );
  });

  it("getSubscriptionUsage should query by projectKey", () => {
    service.getSubscriptionUsage("pk");
    expect(http.get).toHaveBeenCalledWith(
      `${SUBSCRIPTION_ENDPOINTS.GETS}?projectKey=pk`,
      undefined,
      ABS,
    );
  });

  describe("validateJwksUrl", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("should return valid=true for a well-formed JWKS response", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ keys: [{ kid: "1" }] }),
        }),
      );
      const result = await service.validateJwksUrl("https://x/jwks");
      expect(result.isValid).toBe(true);
      expect(result.data).toEqual({ keys: [{ kid: "1" }] });
    });

    it("should return invalid on non-ok HTTP status", async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
      const result = await service.validateJwksUrl("https://x/jwks");
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("valid jwks URL");
    });

    it("should return invalid when content-type is not JSON", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => "text/html" },
        }),
      );
      const result = await service.validateJwksUrl("https://x/jwks");
      expect(result.isValid).toBe(false);
    });

    it("should return invalid when keys array is missing or empty", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => "application/json" },
          json: async () => ({ keys: [] }),
        }),
      );
      const result = await service.validateJwksUrl("https://x/jwks");
      expect(result.isValid).toBe(false);
    });

    it("should return invalid and log when fetch throws", async () => {
      const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
      const result = await service.validateJwksUrl("https://x/jwks");
      expect(result.isValid).toBe(false);
      expect(errSpy).toHaveBeenCalled();
    });
  });
});
