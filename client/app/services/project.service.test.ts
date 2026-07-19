import { beforeEach, describe, expect, it, vi } from "vitest";

import { API_BASES } from "@/constants/endpoint.constant";
import { MIGRATION_ENDPOINTS, PROJECT_ENDPOINTS } from "@/constants/projects";
import { serviceInstances } from "@/lib/http-client";
import { projectService, ProjectService } from "./project.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    logicService: { get: vi.fn(), post: vi.fn() },
  },
}));

const http = serviceInstances.logicService;
const ABS = { absoluteUrl: true };

describe("services/project.service", () => {
  let service: ProjectService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProjectService();
    vi.mocked(http.get).mockResolvedValue({} as never);
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("should export a singleton", () => {
    expect(projectService).toBeInstanceOf(ProjectService);
  });

  it("getProjects should use defaults", () => {
    service.getProjects();
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GETS}?page=0&pageSize=100&tenantGroupId=`,
      undefined,
      ABS,
    );
  });

  it("getProjects should honor args", () => {
    service.getProjects(1, 5, "g");
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GETS}?page=1&pageSize=5&tenantGroupId=g`,
      undefined,
      ABS,
    );
  });

  it("initiateMigration should POST to MIGRATE", () => {
    service.initiateMigration({} as never);
    expect(http.post).toHaveBeenCalledWith(
      MIGRATION_ENDPOINTS.MIGRATE,
      expect.anything(),
      undefined,
      ABS,
    );
  });

  it("verifyMigration should POST to VERIFY", () => {
    service.verifyMigration({} as never);
    expect(http.post).toHaveBeenCalledWith(
      MIGRATION_ENDPOINTS.VERIFY,
      expect.anything(),
      undefined,
      ABS,
    );
  });

  it("getMigrationStatus should query by tenantGroupId", () => {
    service.getMigrationStatus("g1");
    expect(http.get).toHaveBeenCalledWith(
      `${MIGRATION_ENDPOINTS.GET_STATUS}?tenantGroupId=g1`,
      undefined,
      ABS,
    );
  });

  it("getProject should query by projectId", () => {
    service.getProject({ projectId: "p1" });
    expect(http.get).toHaveBeenCalledWith(
      `${PROJECT_ENDPOINTS.GET}?projectId=p1`,
      undefined,
      ABS,
    );
  });

  it("getEnvRepositories should build a build/repos-list url", () => {
    service.getEnvRepositories("pk");
    expect(http.get).toHaveBeenCalledWith(
      `${API_BASES.LOGIC}/build/repos-list?projectkey=pk`,
      undefined,
      ABS,
    );
  });

  it("repoUpdate should POST to the cloudbuild url", () => {
    const payload = { projectKey: "p", projectEnv: "dev", repoWithDomains: [] };
    service.repoUpdate(payload);
    expect(http.post).toHaveBeenCalledWith(
      "/cloudbuild/v1/build/repo-update",
      payload,
    );
  });

  it("createProject should POST to the identifier create url", () => {
    const payload = { name: "n" } as never;
    service.createProject(payload);
    expect(http.post).toHaveBeenCalledWith(
      "/identifier/v1/Project/Create",
      payload,
    );
  });

  it("validateCNameProject should POST to Domain/Configure", () => {
    const payload = { projectKey: "p", cookieDomain: "d" };
    service.validateCNameProject(payload);
    expect(http.post).toHaveBeenCalledWith(
      "/identifier/v1/Domain/Configure",
      payload,
    );
  });

  it("updateProject should POST to UpdateProject", () => {
    service.updateProject({ name: "n" } as never);
    expect(http.post).toHaveBeenCalledWith(
      "/identifier/v1/Project/UpdateProject",
      expect.anything(),
    );
  });

  it("updateTenantGroup should POST to UpdateTenantGroup", () => {
    service.updateTenantGroup({ name: "n", tenantGroupId: "g" });
    expect(http.post).toHaveBeenCalledWith(
      "/identifier/v1/Project/UpdateTenantGroup",
      expect.anything(),
    );
  });

  it("getProjectLoginOption should GET GetLoginOptions", () => {
    service.getProjectLoginOption();
    expect(http.get).toHaveBeenCalledWith(
      "/identifier/v1/Project/GetLoginOptions",
    );
  });

  it("disableProject should POST to DISABLE", () => {
    service.disableProject({ projectKey: "p" });
    expect(http.post).toHaveBeenCalledWith(PROJECT_ENDPOINTS.DISABLE, {
      projectKey: "p",
    });
  });
});
