import { idpGet, idpPostJson } from "@/platform/api/idp-http";
import { STORAGE_FILE_ENDPOINTS } from "@/platform/storage/storage-endpoints";
import type {
  IGetFileByFileIDPayload,
  IGetFileByFileIDResponse,
  IGetPreSignedUrlForUploadPayload,
  IGetPreSignedUrlForUploadResponse,
} from "@/platform/storage/storage.types";

export async function putFileToPresignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-ms-blob-type": "BlockBlob",
    },
    body: file,
    credentials: "omit",
  });
  if (!res.ok) {
    throw new Error(`Blob upload failed: ${res.status}`);
  }
}

export const storageFileService = {
  getPreSignedUrlForUpload(
    payload: IGetPreSignedUrlForUploadPayload,
  ): Promise<IGetPreSignedUrlForUploadResponse> {
    return idpPostJson(STORAGE_FILE_ENDPOINTS.GET_PRESIGNED_URL, payload);
  },

  getFileByFileId(payload: IGetFileByFileIDPayload): Promise<IGetFileByFileIDResponse> {
    const params = new URLSearchParams({
      FileId: payload.itemId,
      ProjectKey: payload.projectKey,
    });
    if (payload.configurationName) {
      params.set("ConfigurationName", payload.configurationName);
    }
    return idpGet(`${STORAGE_FILE_ENDPOINTS.GET_FILE}?${params.toString()}`);
  },
};
