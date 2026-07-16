import { describe, expect, it } from "vitest";

import {
  CLOUD_BUILD_ENDPOINTS,
  DOMAIN_ENDPOINTS,
  MIGRATION_ENDPOINTS,
  PEOPLE_ENDPOINTS,
  PROJECT_ENDPOINTS,
  SERVICE_REGISTRY_ENDPOINTS,
  SUBSCRIPTION_ENDPOINTS,
} from "./endpoint.constant";
import {
  LOG_LEVELS,
  REGISTER_SERVICE_ENVIRONMENTS,
  REGISTER_SERVICE_TYPE,
  REGISTER_SERVICE_TYPES,
  SERVICE_STATUS,
  TRACE_STATUS,
} from "./index";

describe("identifier/constants/endpoint.constant", () => {
  it("should split people endpoints across identifier and logic services", () => {
    expect(PEOPLE_ENDPOINTS.CONFIRM_INVITATION).toContain("/People/ConfirmInvitation");
    expect(PEOPLE_ENDPOINTS.REMOVE_ACCESS).toContain("/People/RemoveAccess");
    expect(PEOPLE_ENDPOINTS.TRANSFER_OWNERSHIP).toContain("/People/TransferOwnerShip");
  });

  it("should expose project endpoints", () => {
    expect(PROJECT_ENDPOINTS.GETS).toContain("/Project/Gets");
    expect(PROJECT_ENDPOINTS.GET_JWT_CLAIMS).toContain("/Project/GetThirdPartyJWTClaims");
  });

  it("should expose domain, migration, subscription, service and build endpoints", () => {
    expect(DOMAIN_ENDPOINTS.CONFIGURE).toContain("/Domain/Configure");
    expect(MIGRATION_ENDPOINTS.GET_STATUS).toContain("/Migration/GetMigrationStatus");
    expect(SUBSCRIPTION_ENDPOINTS.GETS).toContain("/Subscription/Gets");
    expect(SERVICE_REGISTRY_ENDPOINTS.REGISTER).toContain("/Service/Register");
    expect(CLOUD_BUILD_ENDPOINTS.REPOS_LIST).toContain("/build/repos-list");
  });
});

describe("identifier/constants/index", () => {
  it("REGISTER_SERVICE_TYPE enum should map None/Api/Worker", () => {
    expect(REGISTER_SERVICE_TYPE.None).toBe(0);
    expect(REGISTER_SERVICE_TYPE.Api).toBe(1);
    expect(REGISTER_SERVICE_TYPE.Worker).toBe(2);
  });

  it("REGISTER_SERVICE_TYPES should list the three labelled options", () => {
    expect(REGISTER_SERVICE_TYPES.map((t) => t.label)).toEqual([
      "None",
      "API",
      "Worker",
    ]);
  });

  it("should expose environment, log-level, service-status and trace-status tables", () => {
    expect(REGISTER_SERVICE_ENVIRONMENTS).toHaveLength(3);
    expect(LOG_LEVELS.map((l) => l.value)).toContain("error");
    expect(SERVICE_STATUS.map((s) => s.value)).toContain("active");
    expect(TRACE_STATUS.map((s) => s.value)).toContain("timeout");
  });
});
