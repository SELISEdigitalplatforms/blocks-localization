import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { storageService } from "../services/storage.service";
import { createQueryWrapper } from "@/test-utils/query-wrapper";
import * as configHooks from "./use-storage-configuration";
import * as fileHooks from "./use-storage-file";

vi.mock("@seliseblocks/blocks-kit", () => ({
  useProjectStore: () => ({ selectedProject: { tenantId: "tenant-1" } }),
}));

vi.mock("../services/storage.service", () => ({
  storageService: {
    uploadFile: vi.fn(),
    uploadFileToLocalStorage: vi.fn(),
    uploadPublicCertificateFile: vi.fn(),
    getFilesAndFolders: vi.fn(),
    uploadDmsFile: vi.fn(),
    createDmsFolder: vi.fn(),
    configuration: { gets: vi.fn(), save: vi.fn(), delete: vi.fn() },
    file: {
      getPreSignedUrlForUpload: vi.fn(),
      getFileByFileId: vi.fn(),
      deleteFileByFileId: vi.fn(),
      deleteFolderByFileId: vi.fn(),
      getFilesInfoUrlForUpload: vi.fn(),
      getFilesDownloadUrl: vi.fn(),
    },
  },
}));

const svc = vi.mocked(storageService, true);
const renderQ = <T,>(cb: () => T) => {
  const { wrapper } = createQueryWrapper();
  return renderHook(cb, { wrapper });
};

describe("storage/hooks/use-storage-configuration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetStorageConfigurations should fetch by tenant", async () => {
    svc.configuration.gets.mockResolvedValue([] as never);
    const { result } = renderQ(() => configHooks.useGetStorageConfigurations());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(svc.configuration.gets).toHaveBeenCalledWith("tenant-1");
  });

  it("useSaveStorageConfiguration should invalidate on success", async () => {
    svc.configuration.save.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => configHooks.useSaveStorageConfiguration());
    await result.current.mutateAsync({} as never);
    expect(svc.configuration.save).toHaveBeenCalled();
  });

  it("useSaveStorageConfiguration should not invalidate when unsuccessful", async () => {
    svc.configuration.save.mockResolvedValue({ isSuccess: false } as never);
    const { result } = renderQ(() => configHooks.useSaveStorageConfiguration());
    await result.current.mutateAsync({} as never);
    expect(svc.configuration.save).toHaveBeenCalled();
  });

  it("useDeleteStorageConfiguration should call the service", async () => {
    svc.configuration.delete.mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(() => configHooks.useDeleteStorageConfiguration());
    await result.current.mutateAsync({
      projectKey: "pk",
      configurationName: "c",
    });
    expect(svc.configuration.delete).toHaveBeenCalled();
  });
});

describe("storage/hooks/use-storage-file", () => {
  beforeEach(() => vi.clearAllMocks());

  it("useGetFile should fetch by option", async () => {
    svc.file.getFileByFileId.mockResolvedValue({ url: "u" } as never);
    const { result } = renderQ(() =>
      fileHooks.useGetFile({ itemId: "f", projectKey: "pk" }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetFilesInfo should fetch info", async () => {
    svc.file.getFilesInfoUrlForUpload.mockResolvedValue({ data: [] } as never);
    const { result } = renderQ(() =>
      fileHooks.useGetFilesInfo({ page: 0 } as never),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useGetFilesDownload should honor an enabled=false flag", () => {
    const { result } = renderQ(() =>
      fileHooks.useGetFilesDownload(
        { fileId: "f", projectKey: "pk" },
        { enabled: false },
      ),
    );
    expect(result.current.fetchStatus).toBe("idle");
  });

  it("useGetFilesDownload should fetch when enabled", async () => {
    svc.file.getFilesDownloadUrl.mockResolvedValue({ url: "u" } as never);
    const { result } = renderQ(() =>
      fileHooks.useGetFilesDownload({ fileId: "f", projectKey: "pk" }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("useLazyGetFile should fetch on demand", async () => {
    svc.file.getFileByFileId.mockResolvedValue({ url: "u" } as never);
    const { result } = renderQ(() => fileHooks.useLazyGetFile());
    const file = await result.current.fetchFile({ itemId: "f", projectKey: "pk" });
    expect(file).toEqual({ url: "u" });
  });

  it.each([
    ["useGetPreSignedUrlForUpload", () => fileHooks.useGetPreSignedUrlForUpload(), () => svc.file.getPreSignedUrlForUpload],
    ["useUploadFile", () => fileHooks.useUploadFile(), () => svc.uploadFile],
    ["useUploadFileToLocalStorage", () => fileHooks.useUploadFileToLocalStorage(), () => svc.uploadFileToLocalStorage],
    ["useDeleteFile", () => fileHooks.useDeleteFile(), () => svc.file.deleteFileByFileId],
    ["useDeleteFolder", () => fileHooks.useDeleteFolder(), () => svc.file.deleteFolderByFileId],
    ["usePublicCertificateFile", () => fileHooks.usePublicCertificateFile(), () => svc.uploadPublicCertificateFile],
    ["useGetDmsFileAndFolder", () => fileHooks.useGetDmsFileAndFolder(), () => svc.getFilesAndFolders],
    ["useUploadDmsFile", () => fileHooks.useUploadDmsFile(), () => svc.uploadDmsFile],
    ["useCreateDmsFolder", () => fileHooks.useCreateDmsFolder(), () => svc.createDmsFolder],
  ])("%s mutation should call its service", async (_name, hook, getFn) => {
    getFn().mockResolvedValue({ isSuccess: true } as never);
    const { result } = renderQ(hook as never);
    await (result.current as { mutateAsync: (p: unknown) => Promise<unknown> }).mutateAsync(
      {} as never,
    );
    expect(getFn()).toHaveBeenCalled();
  });
});
