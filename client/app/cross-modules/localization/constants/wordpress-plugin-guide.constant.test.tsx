import { describe, expect, it, vi } from "vitest";

const { getRuntimeEnvMock } = vi.hoisted(() => ({
  getRuntimeEnvMock: vi.fn((key: string) => {
    if (key === "BLOCKS_OS_BASE_URL") return "https://custom-os.example.com/";
    return "";
  }),
}));

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: getRuntimeEnvMock,
}));

vi.mock("@/lib/blocks-url.util", () => ({
  deriveOsBaseUrl: () => "https://fallback-os.example.com",
}));

import {
  BLOCKS_OS_SETUP_URL,
  getBlocksOsClientCredentialsPath,
  getBlocksOsClientCredentialsUrl,
  getBlocksOsRolesPath,
} from "./wordpress-plugin-guide.constant";

describe("wordpress-plugin-guide constants", () => {
  it("uses the deployment-provided OS domain without a trailing slash", () => {
    expect(BLOCKS_OS_SETUP_URL).toBe("https://custom-os.example.com");
    expect(getBlocksOsRolesPath("project/dev")).toBe("/app/project%2Fdev/idp/roles");
    expect(getBlocksOsClientCredentialsPath("project/dev")).toBe(
      "/app/project%2Fdev/secret-management/client-credentials",
    );
    expect(getBlocksOsClientCredentialsUrl("project/dev")).toBe(
      "https://custom-os.example.com/app/project%2Fdev/secret-management/client-credentials",
    );
  });
});
