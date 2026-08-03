import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { projectService } from "@blocks-identifier/services/project.service";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import * as hooks from "./use-project";

const navigate = vi.fn();
const projectStore = {
  setProjects: vi.fn(),
  selectedProject: undefined as unknown,
  setSelectedProject: vi.fn(),
  setTenantGroup: vi.fn(),
  selectedTenantGroup: "group-1",
};

vi.mock("react-router", () => ({ useNavigate: () => navigate }));
vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => projectStore,
}));
vi.mock("@/hooks/use-toast", () => ({
  showSuccessToast: vi.fn(),
  showErrorToast: vi.fn(),
}));
vi.mock("@blocks-identifier/services/project.service", () => ({
  projectService: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    getAssets: vi.fn(),
    addAssets: vi.fn(),
    getEnvRepositories: vi.fn(),
    repoUpdate: vi.fn(),
    updateTenantGroup: vi.fn(),
    validateCNameProject: vi.fn(),
    disableProject: vi.fn(),
    createProject: vi.fn(),
    getMigrationStatus: vi.fn(),
  },
}));

const svc = vi.mocked(projectService);
const renderQ = <T,>(cb: () => T) => {
  const { wrapper } = createQueryWrapper();
  return renderHook(cb, { wrapper });
};

describe("identifier/hooks/use-project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.selectedProject = undefined;
  });
  afterEach(() => vi.restoreAllMocks());

  it("useGetProjects should flatten projects and select the first", async () => {
    svc.getProjects.mockResolvedValue([
      { projects: [{ itemId: "p1" }, { itemId: "p2" }] },
    ] as never);
    const { result } = renderQ(() => hooks.useGetProjects("g1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectStore.setProjects).toHaveBeenCalledWith([{ itemId: "p1" }, { itemId: "p2" }]);
    expect(projectStore.setSelectedProject).toHaveBeenCalledWith({ itemId: "p1" });
  });

  it("useGetProject should be disabled without a projectId", () => {
    const { result } = renderQ(() => hooks.useGetProject({ projectId: "" }));
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetProject should fetch with a projectId", async () => {
    svc.getProject.mockResolvedValue({ data: {} } as never);
    const { result } = renderQ(() => hooks.useGetProject({ projectId: "p1" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetAssets should fetch assets", async () => {
    svc.getAssets.mockResolvedValue({ assets: {}, totalCount: 0 } as never);
    const { result } = renderQ(() => hooks.useGetAssets("g1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetEnvRepositories should fetch repos", async () => {
    svc.getEnvRepositories.mockResolvedValue({ data: [] } as never);
    const { result } = renderQ(() => hooks.useGetEnvRepositories("pk"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetMigrationStatus should fetch status", async () => {
    svc.getMigrationStatus.mockResolvedValue([] as never);
    const { result } = renderQ(() => hooks.useGetMigrationStatus("g1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it.each([
    ["useAddAssets", () => hooks.useAddAssets(), () => svc.addAssets, {} as never],
    [
      "useUpdateRepositories",
      () => hooks.useUpdateRepositories(),
      () => svc.repoUpdate,
      {} as never,
    ],
    [
      "useUpdateProject",
      () => hooks.useUpdateProject({ projectKey: "p" }),
      () => svc.updateTenantGroup,
      { name: "n", tenantGroupId: "g" },
    ],
    [
      "useUpdateTenantGroup",
      () => hooks.useUpdateTenantGroup({ tenantGroupId: "g" }),
      () => svc.updateTenantGroup,
      { name: "n", tenantGroupId: "g" },
    ],
    [
      "useValidateCNameProject",
      () => hooks.useValidateCNameProject({ projectKey: "p" }),
      () => svc.validateCNameProject,
      {} as never,
    ],
    [
      "useDisableProject",
      () => hooks.useDisableProject({ projectKey: "p" }),
      () => svc.disableProject,
      {} as never,
    ],
    ["useCreateProject", () => hooks.useCreateProject(), () => svc.createProject, {} as never],
  ])("%s mutation should call its service", async (_name, hook, getFn, payload) => {
    getFn().mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(hook as never);
    await (result.current as { mutateAsync: (p: unknown) => Promise<unknown> }).mutateAsync(
      payload,
    );
    expect(getFn()).toHaveBeenCalled();
  });

  describe("useProjectForm", () => {
    it("saveProject should create, toast success, select project and navigate", async () => {
      svc.createProject.mockResolvedValue({
        isSuccess: true,
        tenantGroupId: "tg-1",
        errors: null,
      } as never);
      svc.getProjects.mockResolvedValue([{ projects: [{ itemId: "p1" }] }] as never);

      const { result } = renderQ(() => hooks.useProjectForm());
      await result.current.saveProject();

      expect(svc.createProject).toHaveBeenCalled();
      expect(showSuccessToast).toHaveBeenCalled();
      expect(projectStore.setTenantGroup).toHaveBeenCalledWith("tg-1");
      expect(navigate).toHaveBeenCalledWith("/project-overview");
    });

    it("saveProject should show an error toast when creation is not successful", async () => {
      svc.createProject.mockResolvedValue({
        isSuccess: false,
        errors: { name: "taken" },
      } as never);

      const { result } = renderQ(() => hooks.useProjectForm());
      await result.current.saveProject();

      expect(showErrorToast).toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
    });

    it("saveProject should surface errors thrown by mutateAsync", async () => {
      svc.createProject.mockRejectedValue({ errors: { server: "down" } });
      const { result } = renderQ(() => hooks.useProjectForm());
      await result.current.saveProject();
      expect(showErrorToast).toHaveBeenCalled();
    });
  });
});
