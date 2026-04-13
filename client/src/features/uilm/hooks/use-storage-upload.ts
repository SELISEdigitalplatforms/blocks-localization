import { useMutation } from "@tanstack/react-query";
import { putFileToPresignedUrl, storageFileService } from "@/platform/storage/storage-file.service";
import type { IGetPreSignedUrlForUploadPayload } from "@/platform/storage/storage.types";

export function useGetPreSignedUrlForUpload() {
  return useMutation({
    mutationKey: ["storage", "file", "getPresignedUrl"],
    mutationFn: (payload: IGetPreSignedUrlForUploadPayload) =>
      storageFileService.getPreSignedUrlForUpload(payload),
  });
}

export function useUploadFileToBlob() {
  return useMutation({
    mutationKey: ["storage", "file", "putBlob"],
    mutationFn: ({ url, file }: { url: string; file: File }) => putFileToPresignedUrl(url, file),
  });
}
