import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import { PEOPLE_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import { peopleService, PeopleService } from "./people.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    logicService: { post: vi.fn() },
  },
}));

const http = serviceInstances.logicService;

describe("identifier/services/people.service", () => {
  let service: PeopleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PeopleService();
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("should export a singleton instance", () => {
    expect(peopleService).toBeInstanceOf(PeopleService);
  });

  it("peopleAcceptInvitation should POST to CONFIRM_INVITATION", () => {
    service.peopleAcceptInvitation({ code: "c" });
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.CONFIRM_INVITATION, {
      code: "c",
    });
  });

  it("getPeople should POST to GETS", () => {
    const payload = { page: 0, pageSize: 10, filter: "", projectGroupId: "g" };
    service.getPeople(payload);
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.GETS, payload);
  });

  it("invitePeople should POST to INVITE", () => {
    const payload = { invitations: {}, groupId: "g" };
    service.invitePeople(payload);
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.INVITE, payload);
  });

  it("resendInvitation should POST to RESEND_INVITATION", () => {
    const payload = { email: "e", groupId: "g" };
    service.resendInvitation(payload);
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.RESEND_INVITATION, payload);
  });

  it("removeAccess should POST to REMOVE_ACCESS", () => {
    const payload = { userIds: ["u"], projectKey: "p" };
    service.removeAccess(payload);
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.REMOVE_ACCESS, payload);
  });

  it("removeEnvironmentAccess should POST to REMOVE_ACCESS", () => {
    const payload = { email: "e", projectKeys: ["p"], groupId: "g" };
    service.removeEnvironmentAccess(payload);
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.REMOVE_ACCESS, payload);
  });

  it("confirmInvitation should POST to CONFIRM_INVITATION", () => {
    service.confirmInvitation({ code: "c" });
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.CONFIRM_INVITATION, {
      code: "c",
    });
  });

  it("transferOwnership should POST to TRANSFER_OWNERSHIP", () => {
    const payload = { tenantGroupId: "g", transferToUserEmail: "e" };
    service.transferOwnership(payload);
    expect(http.post).toHaveBeenCalledWith(PEOPLE_ENDPOINTS.TRANSFER_OWNERSHIP, payload);
  });
});
