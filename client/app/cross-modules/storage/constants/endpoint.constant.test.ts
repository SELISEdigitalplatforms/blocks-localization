import { describe, expect, it } from "vitest";

import { STORAGE_CONFIG_ENDPOINTS } from "./endpoint.constant";

describe("storage/constants/endpoint.constant", () => {
  it("should route config CRUD through cloud configuration base", () => {
    expect(STORAGE_CONFIG_ENDPOINTS.GET_CONFIGS).toContain("/Storage/Gets");
    expect(STORAGE_CONFIG_ENDPOINTS.SAVE_CONFIG).toContain("/Storage/Save");
    expect(STORAGE_CONFIG_ENDPOINTS.DELETE_CONFIG).toContain("/Storage/Delete");
  });

  it("should route file operations through the UDS base", () => {
    expect(STORAGE_CONFIG_ENDPOINTS.GET_FILE).toContain("/Storage/GetFile");
    expect(STORAGE_CONFIG_ENDPOINTS.GET_PRESIGNED_URL).toContain(
      "/Storage/GetPreSignedUrlForUpload",
    );
    expect(STORAGE_CONFIG_ENDPOINTS.UPLOAD_DMS_FILE).toContain(
      "/Storage/UploadFile",
    );
    expect(STORAGE_CONFIG_ENDPOINTS.UPLOAD_PUBLIC_CERTIFICATE).toContain(
      "/Storage/Certificate/UploadCertificate",
    );
  });
});
