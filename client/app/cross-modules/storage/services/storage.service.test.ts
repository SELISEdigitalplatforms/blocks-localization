import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import { STORAGE_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";
import { StorageConfiguration } from "./storage-configuration.service";
import { StorageFile } from "./storage-file.service";
import { storageService, StorageService } from "./storage.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    logicService: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
  },
}));

const http = serviceInstances.logicService;

describe("storage/services/storage.service", () => {
  let service: StorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StorageService(new StorageConfiguration(), new StorageFile());
    vi.mocked(http.post).mockResolvedValue({} as never);
    vi.mocked(http.put).mockResolvedValue({} as never);
  });

  it("should export a singleton with configuration and file collaborators", () => {
    expect(storageService).toBeInstanceOf(StorageService);
    expect(storageService.configuration).toBeInstanceOf(StorageConfiguration);
    expect(storageService.file).toBeInstanceOf(StorageFile);
  });

  it("uploadFile should PUT with blob headers and skip blocks key", () => {
    const file = new Blob(["data"], { type: "text/plain" });
    service.uploadFile({ url: "https://upload", file });
    expect(http.put).toHaveBeenCalledWith(
      "https://upload",
      file,
      { "Content-Type": "text/plain", "x-ms-blob-type": "Blockblob" },
      { skipBlocksKey: true, absoluteUrl: true, withCredentials: false },
    );
  });

  it("uploadFileToLocalStorage should POST a FormData built from the payload", () => {
    const file = new File(["x"], "a.txt", { type: "text/plain" });
    service.uploadFileToLocalStorage({
      ItemId: "i",
      File: file,
      MetaData: "m",
      Name: "a.txt",
      ParentDirectoryId: "p",
      Tags: ["t1"],
      AccessModifier: "1",
      ConfigurationName: "cfg",
      ProjectKey: "pk",
    });
    const [url, body] = vi.mocked(http.post).mock.calls[0];
    expect(url).toBe(STORAGE_CONFIG_ENDPOINTS.UPLOAD_TO_LOCAL_STORAGE);
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("Name")).toBe("a.txt");
    expect((body as FormData).get("File")).toBeInstanceOf(File);
  });

  it("uploadPublicCertificateFile should POST FormData with tenant query params", () => {
    const file = new File(["cert"], "cert.pfx");
    service.uploadPublicCertificateFile({ TenantId: "t1", file });
    const [url, body, headers] = vi.mocked(http.post).mock.calls[0];
    expect(url).toContain(STORAGE_CONFIG_ENDPOINTS.UPLOAD_PUBLIC_CERTIFICATE);
    expect(url).toContain("TenantId=t1");
    expect(url).toContain("IsThirdParty=true");
    expect(body).toBeInstanceOf(FormData);
    expect(headers).toEqual({ Accept: "*/*" });
  });

  it("uploadPublicCertificateFile should fall back to a default name when file has none", () => {
    const blobLike = new Blob(["cert"]);
    service.uploadPublicCertificateFile({
      TenantId: "t1",
      file: blobLike as never,
    });
    const [, body] = vi.mocked(http.post).mock.calls[0];
    expect((body as FormData).get("Certificate")).toBeTruthy();
  });

  it("getFilesAndFolders should POST to GET_DMS_FILE_AND_FOLDER", () => {
    const payload = {
      configurationName: "cfg",
      projectKey: "pk",
      skip: 0,
      take: 10,
    };
    service.getFilesAndFolders(payload);
    expect(http.post).toHaveBeenCalledWith(
      STORAGE_CONFIG_ENDPOINTS.GET_DMS_FILE_AND_FOLDER,
      payload,
    );
  });

  it("uploadDmsFile should POST to UPLOAD_DMS_FILE", () => {
    const payload = { upload: [], projectKey: "pk" };
    service.uploadDmsFile(payload);
    expect(http.post).toHaveBeenCalledWith(
      STORAGE_CONFIG_ENDPOINTS.UPLOAD_DMS_FILE,
      payload,
    );
  });

  it("createDmsFolder should POST to CREATE_FOLDER", () => {
    const payload = { artifactName: "f" } as never;
    service.createDmsFolder(payload);
    expect(http.post).toHaveBeenCalledWith(
      STORAGE_CONFIG_ENDPOINTS.CREATE_FOLDER,
      payload,
    );
  });
});
