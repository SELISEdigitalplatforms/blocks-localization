/** UDS file endpoints — aligned with `storage/constants/endpoint.constant.ts` in blocks-app-next. */
const UDS = "/uds/v1";
const FILES = `${UDS}/Files`;

export const STORAGE_FILE_ENDPOINTS = {
  GET_FILE: `${FILES}/GetFile`,
  GET_PRESIGNED_URL: `${FILES}/GetPreSignedUrlForUpload`,
} as const;
