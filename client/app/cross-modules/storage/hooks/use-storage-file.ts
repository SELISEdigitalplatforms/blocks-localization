import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ICreateDmsFolderPayload,
  IDeleteFilePayload,
  IDeleteFolderPayload,
  IGetDmsFileAndFolderPayload,
  IGetFileByFileIDPayload,
  IGetFilesInfoPayload,
  IGetPreSignedUrlForUploadPayload,
  IPublicCertificatePayload,
  IUploadFileToLocalStorage,
  IUploadImagePayload,
  IUploadDmsFilePayload,
} from "../models/storage.model";
import { storageService } from "../services/storage.service";

export const useGetPreSignedUrlForUpload = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["storage", "file", "getPresignedUrl"],
    mutationFn: (payload: IGetPreSignedUrlForUploadPayload) =>
      storageService.file.getPreSignedUrlForUpload(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "file", "getFilesInfo"],
      });
    },
  });
};

export const useUploadFile = () => {
  return useMutation({
    mutationKey: ["storage", "file", "getPresignedUrl"],
    mutationFn: (payload: IUploadImagePayload) => storageService.uploadFile(payload),
  });
};

export const useUploadFileToLocalStorage = () => {
  return useMutation({
    mutationKey: ["storage", "file", "upload"],
    mutationFn: (payload: IUploadFileToLocalStorage) =>
      storageService.uploadFileToLocalStorage(payload),
  });
};

export const useGetFile = (option: IGetFileByFileIDPayload) => {
  return useQuery({
    queryKey: ["file", option],
    queryFn: () => storageService.file.getFileByFileId(option),
  });
};

export const useLazyGetFile = () => {
  const queryClient = useQueryClient();

  const fetchFile = (option: IGetFileByFileIDPayload) => {
    return queryClient.fetchQuery({
      queryKey: ["file", option],
      queryFn: () => storageService.file.getFileByFileId(option),
    });
  };

  return { fetchFile };
};

export const useDeleteFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["storage", "file", "delete"],
    mutationFn: (payload: IDeleteFilePayload) => storageService.file.deleteFileByFileId(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "file", "getFilesInfo"],
      });
    },
  });
};

export const useDeleteFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["storage", "folder", "delete"],
    mutationFn: (payload: IDeleteFolderPayload) =>
      storageService.file.deleteFolderByFileId(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "folder", "getFolderInfo"],
      });
    },
  });
};

export const useGetFilesInfo = (options: IGetFilesInfoPayload) => {
  return useQuery({
    queryKey: ["storage", "file", "getFilesInfo", options],
    queryFn: () => storageService.file.getFilesInfoUrlForUpload(options),
  });
};

export const useGetFilesDownload = (
  meta: { fileId: string; projectKey: string },
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["getFilesDownload", meta.fileId, meta.projectKey],
    queryFn: () => storageService.file.getFilesDownloadUrl(meta),
    enabled: options?.enabled ?? true,
    refetchOnWindowFocus: false,
  });
};

export const usePublicCertificateFile = () => {
  return useMutation({
    mutationKey: ["storage", "file", "public-certificate"],
    mutationFn: (payload: IPublicCertificatePayload) =>
      storageService.uploadPublicCertificateFile(payload),
  });
};

export const useGetDmsFileAndFolder = () => {
  return useMutation({
    mutationKey: ["storage", "file", "dms-file-and-folder"],
    mutationFn: (payload: IGetDmsFileAndFolderPayload) =>
      storageService.getFilesAndFolders(payload),
  });
};

export const useUploadDmsFile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["upload", "dms-file"],
    mutationFn: (payload: IUploadDmsFilePayload) => storageService.uploadDmsFile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "file", "dms-file-and-folder"],
      });
    },
  });
};

export const useCreateDmsFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["create-folder", "dms-folder"],
    mutationFn: (payload: ICreateDmsFolderPayload) => storageService.createDmsFolder(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["storage", "file", "dms-file-and-folder"],
      });
    },
  });
};
