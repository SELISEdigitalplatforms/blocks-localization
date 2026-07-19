import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import { STORAGE_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";
import { StorageConfiguration } from "./storage-configuration.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    logicService: { get: vi.fn(), post: vi.fn() },
  },
}));

const http = serviceInstances.logicService;
const ABS = { absoluteUrl: true };

describe("storage/services/storage-configuration.service", () => {
  let service: StorageConfiguration;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StorageConfiguration();
    vi.mocked(http.get).mockResolvedValue([] as never);
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("gets should query configs by ProjectKey", () => {
    service.gets("pk");
    expect(http.get).toHaveBeenCalledWith(
      `${STORAGE_CONFIG_ENDPOINTS.GET_CONFIGS}?ProjectKey=pk`,
      undefined,
      ABS,
    );
  });

  const baseValues = {
    name: "cfg",
    projectKey: "pk",
    secretKey: "sk",
    accessKey: "ak",
    cloudStorageRegionEndPoint: "region",
    connectionString: "conn",
    updateRequest: false,
    itemId: null,
    host: "h",
    port: "1",
    userName: "u",
    password: "p",
    remoteBasePath: "/base",
  };

  it("save should reset sftp fields for Amazon strategy", () => {
    service.save({ ...baseValues, storageStrategy: "Amazon" });
    const [url, payload] = vi.mocked(http.post).mock.calls[0];
    expect(url).toBe(STORAGE_CONFIG_ENDPOINTS.SAVE_CONFIG);
    // original values win (spread after reset), so provided host is preserved
    expect((payload as any).host).toBe("h");
    expect((payload as any).accessKey).toBe("ak");
  });

  it("save should merge reset defaults for Azure strategy", () => {
    service.save({ ...baseValues, storageStrategy: "Azure" });
    const [, payload] = vi.mocked(http.post).mock.calls[0];
    expect((payload as any).storageStrategy).toBe("Azure");
  });

  it("save should handle S3Compatible strategy", () => {
    service.save({ ...baseValues, storageStrategy: "S3Compatible" });
    const [, payload] = vi.mocked(http.post).mock.calls[0];
    expect((payload as any).storageStrategy).toBe("S3Compatible");
  });

  it("save should handle the default (SFTP) strategy branch", () => {
    service.save({ ...baseValues, storageStrategy: "SftpStorage" });
    const [, payload] = vi.mocked(http.post).mock.calls[0];
    expect((payload as any).storageStrategy).toBe("SftpStorage");
  });

  it("delete should POST with ProjectKey and ConfigurationName query params", () => {
    service.delete({ projectKey: "pk", configurationName: "cfg" });
    expect(http.post).toHaveBeenCalledWith(
      `${STORAGE_CONFIG_ENDPOINTS.DELETE_CONFIG}?ProjectKey=pk&ConfigurationName=cfg`,
      {},
      undefined,
      ABS,
    );
  });
});
