import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import { STORAGE_CONFIG_ENDPOINTS } from "../constants/endpoint.constant";
import { StorageFile } from "./storage-file.service";

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    logicService: { get: vi.fn(), post: vi.fn() },
  },
}));

const http = serviceInstances.logicService;

describe("storage/services/storage-file.service", () => {
  let service: StorageFile;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new StorageFile();
    vi.mocked(http.get).mockResolvedValue({} as never);
    vi.mocked(http.post).mockResolvedValue({} as never);
  });

  it("getFileByFileId should include configurationName when provided", () => {
    service.getFileByFileId({
      itemId: "f1",
      projectKey: "pk",
      configurationName: "cfg",
    });
    expect(http.get).toHaveBeenCalledWith(
      `${STORAGE_CONFIG_ENDPOINTS.GET_FILE}?FileId=f1&ProjectKey=pk&ConfigurationName=cfg`,
    );
  });

  it("getFileByFileId should default configurationName to empty", () => {
    service.getFileByFileId({ itemId: "f1", projectKey: "pk" });
    expect(http.get).toHaveBeenCalledWith(
      `${STORAGE_CONFIG_ENDPOINTS.GET_FILE}?FileId=f1&ProjectKey=pk&ConfigurationName=`,
    );
  });

  it("deleteFileByFileId should POST to DELETE_FILE", () => {
    const payload = { fileId: "f", projectKey: "pk" };
    service.deleteFileByFileId(payload);
    expect(http.post).toHaveBeenCalledWith(STORAGE_CONFIG_ENDPOINTS.DELETE_FILE, payload);
  });

  it("deleteFolderByFileId should POST to DELETE_FOLDER", () => {
    const payload = { folderId: "fo", projectKey: "pk" };
    service.deleteFolderByFileId(payload);
    expect(http.post).toHaveBeenCalledWith(STORAGE_CONFIG_ENDPOINTS.DELETE_FOLDER, payload);
  });

  it("getPreSignedUrlForUpload should POST to GET_PRESIGNED_URL", () => {
    const payload = { name: "n" } as never;
    service.getPreSignedUrlForUpload(payload);
    expect(http.post).toHaveBeenCalledWith(STORAGE_CONFIG_ENDPOINTS.GET_PRESIGNED_URL, payload);
  });

  it("getFilesInfoUrlForUpload should POST to GET_FILES_INFO", () => {
    const payload = { page: 0 } as never;
    service.getFilesInfoUrlForUpload(payload);
    expect(http.post).toHaveBeenCalledWith(STORAGE_CONFIG_ENDPOINTS.GET_FILES_INFO, payload);
  });

  it("updateFileAdditionalInfo should POST to UPDATE_FILE_ADDITIONAL_INFO", () => {
    const payload = { itemId: "i", additionalProperties: {}, projectKey: "pk" };
    service.updateFileAdditionalInfo(payload);
    expect(http.post).toHaveBeenCalledWith(
      STORAGE_CONFIG_ENDPOINTS.UPDATE_FILE_ADDITIONAL_INFO,
      payload,
    );
  });

  it("getFilesDownloadUrl should GET with fileId and projectKey", () => {
    service.getFilesDownloadUrl({ fileId: "f", projectKey: "pk" });
    expect(http.get).toHaveBeenCalledWith(
      `${STORAGE_CONFIG_ENDPOINTS.GET_FILE}?FileId=f&ProjectKey=pk`,
    );
  });
});
