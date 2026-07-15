import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import { SERVICE_REGISTRY_ENDPOINTS } from "@blocks-identifier/constants/endpoint.constant";
import {
  serviceRegistryService,
  ServiceRegistryService,
} from "./service-registery.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    logicService: { post: vi.fn() },
  },
}));

const http = serviceInstances.logicService;

describe("identifier/services/service-registery.service", () => {
  let service: ServiceRegistryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ServiceRegistryService();
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("should export a singleton", () => {
    expect(serviceRegistryService).toBeInstanceOf(ServiceRegistryService);
  });

  it("registerService should POST to REGISTER", () => {
    const payload = { serviceName: "s", projectKey: "p", tags: [] };
    service.registerService(payload);
    expect(http.post).toHaveBeenCalledWith(
      SERVICE_REGISTRY_ENDPOINTS.REGISTER,
      payload,
    );
  });

  it("getAllServices should POST to GET_ALL", () => {
    const payload = { page: 0, pageSize: 10, projectKey: "p" };
    service.getAllServices(payload);
    expect(http.post).toHaveBeenCalledWith(
      SERVICE_REGISTRY_ENDPOINTS.GET_ALL,
      payload,
    );
  });
});
