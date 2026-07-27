import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { userLookupService } from "@blocks-localization/services/user-lookup.service";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import { useCurrentUser, useUserOrganizationId } from "./use-user-lookup";

vi.mock("@blocks-localization/services/user-lookup.service", () => ({
  userLookupService: { getMe: vi.fn() },
}));

const svc = vi.mocked(userLookupService);
const renderQ = <T>(cb: () => T) => {
  const { wrapper } = createQueryWrapper();
  return renderHook(cb, { wrapper });
};

describe("localization/hooks/use-user-lookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useCurrentUser should unwrap the response data", async () => {
    svc.getMe.mockResolvedValue({
      data: { itemId: "u1", organizationId: "org-9" },
    } as never);
    const { result } = renderQ(() => useCurrentUser());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ itemId: "u1", organizationId: "org-9" });
  });

  it("useUserOrganizationId should expose the organization id", async () => {
    svc.getMe.mockResolvedValue({
      data: { itemId: "u1", organizationId: "org-42" },
    } as never);
    const { result } = renderQ(() => useUserOrganizationId());
    await waitFor(() => expect(result.current).toBe("org-42"));
  });

  it("useUserOrganizationId should be undefined before data loads", () => {
    svc.getMe.mockReturnValue(new Promise(() => {}) as never);
    const { result } = renderQ(() => useUserOrganizationId());
    expect(result.current).toBeUndefined();
  });
});
