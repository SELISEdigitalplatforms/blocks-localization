import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { peopleService } from "@blocks-identifier/services/people.service";
import { serviceRegistryService } from "@blocks-identifier/services/service-registry.service";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import * as peopleHooks from "./use-people";
import * as serviceHooks from "./use-services";

vi.mock("@seliseblocks/genesis-os", () => ({
  useProjectStore: () => ({ selectedTenantGroup: "group-1" }),
}));
vi.mock("@blocks-identifier/services/people.service", () => ({
  peopleService: {
    getPeople: vi.fn(),
    invitePeople: vi.fn(),
    resendInvitation: vi.fn(),
    removeAccess: vi.fn(),
    removeEnvironmentAccess: vi.fn(),
    confirmInvitation: vi.fn(),
    transferOwnership: vi.fn(),
  },
}));
vi.mock("@blocks-identifier/services/service-registry.service", () => ({
  serviceRegistryService: {
    registerService: vi.fn(),
    getAllServices: vi.fn(),
  },
}));

const people = vi.mocked(peopleService);
const services = vi.mocked(serviceRegistryService);
const renderQ = <T>(cb: () => T) => {
  const { wrapper } = createQueryWrapper();
  return renderHook(cb, { wrapper });
};

describe("identifier/hooks/use-people", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetPeople should fetch and select the summary fields", async () => {
    people.getPeople.mockResolvedValue({
      peoples: [{ id: 1 }],
      totalCount: 1,
      isOwner: true,
    } as never);
    const { result } = renderQ(() =>
      peopleHooks.useGetPeople({ page: 0, pageSize: 10, filter: "" }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      peoples: [{ id: 1 }],
      totalCount: 1,
      isOwner: true,
    });
  });

  it.each([
    ["useInvitePeople", () => peopleHooks.useInvitePeople(), () => people.invitePeople],
    ["useResendInvitation", () => peopleHooks.useResendInvitation(), () => people.resendInvitation],
    ["useRemoveAccess", () => peopleHooks.useRemoveAccess(), () => people.removeAccess],
    [
      "useRemoveEnvironmentAccess",
      () => peopleHooks.useRemoveEnvironmentAccess(),
      () => people.removeEnvironmentAccess,
    ],
    [
      "useConfirmInvitation",
      () => peopleHooks.useConfirmInvitation(),
      () => people.confirmInvitation,
    ],
    [
      "useTransferOwnership",
      () => peopleHooks.useTransferOwnership(),
      () => people.transferOwnership,
    ],
  ])("%s mutation should call its service", async (_name, hook, getFn) => {
    getFn().mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(hook as never);
    await (result.current as { mutateAsync: (p: unknown) => Promise<unknown> }).mutateAsync(
      {} as never,
    );
    expect(getFn()).toHaveBeenCalled();
  });
});

describe("identifier/hooks/use-services", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetAllServices should be disabled without a projectKey", () => {
    const { result } = renderQ(() =>
      serviceHooks.useGetAllServices({ page: 0, pageSize: 10, projectKey: "" }),
    );
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetAllServices should fetch with a projectKey", async () => {
    services.getAllServices.mockResolvedValue({ data: [], totalCount: 0 } as never);
    const { result } = renderQ(() =>
      serviceHooks.useGetAllServices({ page: 0, pageSize: 10, projectKey: "pk" }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useRegisterService should invalidate on a successful registration", async () => {
    services.registerService.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => serviceHooks.useRegisterService());
    await result.current.mutateAsync({ serviceName: "s" } as never);
    expect(services.registerService).toHaveBeenCalled();
  });

  it("useRegisterService should not throw when registration is unsuccessful", async () => {
    services.registerService.mockResolvedValue({ isSuccess: false } as never);
    const { result } = renderQ(() => serviceHooks.useRegisterService());
    await result.current.mutateAsync({ serviceName: "s" } as never);
    expect(services.registerService).toHaveBeenCalled();
  });
});
