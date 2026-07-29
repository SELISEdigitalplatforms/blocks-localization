import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { projectService } from "@/services/project.service";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import * as hooks from "@/hooks/use-project";

const projectStore = {
  setProjects: vi.fn(),
  selectedProject: undefined as unknown,
  setSelectedProject: vi.fn(),
};

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => projectStore,
}));
vi.mock("@/services/project.service", () => ({
  projectService: {
    getProjects: vi.fn(),
    getProject: vi.fn(),
    getMigrationStatus: vi.fn(),
    getEnvRepositories: vi.fn(),
    repoUpdate: vi.fn(),
    updateTenantGroup: vi.fn(),
    validateCNameProject: vi.fn(),
    disableProject: vi.fn(),
    createProject: vi.fn(),
  },
}));

const svc = vi.mocked(projectService);
const renderQ = <T>(cb: () => T) => {
  const { wrapper } = createQueryWrapper();
  return renderHook(cb, { wrapper });
};

describe("hooks/use-project (cross-project service)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectStore.selectedProject = undefined;
  });

  it("useGetProjects should flatten and select the first project", async () => {
    svc.getProjects.mockResolvedValue([{ projects: [{ itemId: "p1" }] }] as never);
    const { result } = renderQ(() => hooks.useGetProjects());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectStore.setSelectedProject).toHaveBeenCalledWith({ itemId: "p1" });
  });

  it("useGetProjects should not override an already-selected project", async () => {
    projectStore.selectedProject = { itemId: "existing" };
    svc.getProjects.mockResolvedValue([{ projects: [{ itemId: "p1" }] }] as never);
    const { result } = renderQ(() => hooks.useGetProjects());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(projectStore.setSelectedProject).not.toHaveBeenCalled();
  });

  it("useGetMigrationStatus should fetch", async () => {
    svc.getMigrationStatus.mockResolvedValue([] as never);
    const { result } = renderQ(() => hooks.useGetMigrationStatus("g"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetProject should fetch with a projectId", async () => {
    svc.getProject.mockResolvedValue({ data: {} } as never);
    const { result } = renderQ(() => hooks.useGetProject({ projectId: "p1" }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetEnvRepositories should fetch repos", async () => {
    svc.getEnvRepositories.mockResolvedValue({ data: [] } as never);
    const { result } = renderQ(() => hooks.useGetEnvRepositories("pk"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it.each([
    ["useUpdateRepositories", () => hooks.useUpdateRepositories(), () => svc.repoUpdate],
    [
      "useUpdateProject",
      () => hooks.useUpdateProject({ projectKey: "p" }),
      () => svc.updateTenantGroup,
    ],
    [
      "useDisableProject",
      () => hooks.useDisableProject({ projectKey: "p" }),
      () => svc.disableProject,
    ],
    [
      "useValidateCNameProject",
      () => hooks.useValidateCNameProject({ projectKey: "p" }),
      () => svc.validateCNameProject,
    ],
    ["useCreateProject", () => hooks.useCreateProject(), () => svc.createProject],
  ])("%s mutation should call its service", async (_name, hook, getFn) => {
    getFn().mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(hook as never);
    await (result.current as { mutateAsync: (p: unknown) => Promise<unknown> }).mutateAsync(
      {} as never,
    );
    expect(getFn()).toHaveBeenCalled();
  });
});
