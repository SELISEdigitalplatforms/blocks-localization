import { beforeEach, describe, expect, it, vi } from "vitest";

import { serviceInstances } from "@/lib/http-client";
import {
  fetchBlocksOsRedirectUrl,
  fetchIamClientCredentials,
  findWordPressClientCredentials,
  hasWpCredentialRole,
  type IamClientCredential,
} from "./wordpress-plugin.service";

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: (key: string) => {
    if (key === "BLOCKS_X_BLOCKS_KEY") return "root-blocks-key";
    if (key === "BLOCKS_OS_CLIENT_ID") return "os-client-id";
    if (key === "BLOCKS_OS_CALLBACK_URL") return "https://dev-os.example.com/login/callback";
    return "";
  },
}));

vi.mock("@/lib/http-client", () => ({
  serviceInstances: {
    iamService: {
      get: vi.fn(),
    },
  },
}));

const http = serviceInstances.iamService;

const credential: IamClientCredential = {
  name: "wordpress-localization",
  clientSecret: "wordpress-secret",
  roles: ["wp_user"],
  isActive: true,
  itemId: "wordpress-client-id",
};

describe("wordpress-plugin.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches client credentials from IAM", async () => {
    vi.mocked(http.get).mockResolvedValue([credential]);

    await expect(fetchIamClientCredentials()).resolves.toEqual([credential]);
    expect(http.get).toHaveBeenCalledWith("/api/auth/client-credentials");
  });

  it("gets an authenticated OS redirect that preserves the project destination", async () => {
    vi.mocked(http.get).mockResolvedValue({
      redirect_uri: "https://iam.example.com/authorize?state=redirect-state",
    });

    await expect(
      fetchBlocksOsRedirectUrl("/app/project-x-dev/secret-management/client-credentials"),
    ).resolves.toBe("https://iam.example.com/authorize?state=redirect-state");

    const requestedUrl = vi.mocked(http.get).mock.calls[0][0];
    const query = new URLSearchParams(requestedUrl.split("?")[1]);

    expect(requestedUrl.startsWith("/api/idp/initiate?")).toBe(true);
    expect(query.get("x-blocks-key")).toBe("root-blocks-key");
    expect(query.get("clientId")).toBe("os-client-id");
    expect(query.get("redirectUri")).toBe("https://dev-os.example.com/login/callback");
    expect(query.get("forwardedTo")).toBe(
      "/app/project-x-dev/secret-management/client-credentials",
    );
  });

  it("returns all WordPress credentials with active credentials first", () => {
    const inactiveCredential = {
      ...credential,
      name: "wordpress-staging",
      isActive: false,
      itemId: "inactive-id",
    };
    const unrelatedCredential = {
      ...credential,
      name: "mobile-app",
      roles: ["mobile_user"],
      itemId: "mobile-id",
    };

    expect(
      findWordPressClientCredentials([inactiveCredential, unrelatedCredential, credential]),
    ).toEqual([credential, inactiveCredential]);
    expect(hasWpCredentialRole(credential)).toBe(true);
  });

  it("accepts the hyphenated WordPress role name", () => {
    expect(hasWpCredentialRole({ ...credential, roles: ["wp-user"] })).toBe(true);
  });
});
