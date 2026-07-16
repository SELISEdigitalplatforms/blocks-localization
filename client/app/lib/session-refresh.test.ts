import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuntimeEnv } from "@/lib/runtime-env";
import { ensureLocalizationSession } from "@/lib/session-refresh";

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: vi.fn(),
}));

const fullConfig: Record<string, string> = {
  BLOCKS_IAM_BASE_URL: "https://iam.example.com",
  BLOCKS_X_BLOCKS_KEY: "blocks-key",
  BLOCKS_OIDC_CLIENT_ID: "client-id",
};

describe("lib/session-refresh", () => {
  beforeEach(() => {
    vi.mocked(getRuntimeEnv).mockImplementation(
      (key: string) => fullConfig[key] ?? "",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("should POST to the OIDC token endpoint and resolve on ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureLocalizationSession()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://iam.example.com/api/oidc/token?tenant_id=blocks-key",
    );
    expect(options.method).toBe("POST");
    expect(options.credentials).toBe("include");
    expect(options.headers["X-Blocks-Key"]).toBe("blocks-key");
    expect(options.body.toString()).toContain("grant_type=refresh_token");
    expect(options.body.toString()).toContain("client_id=client-id");
  });

  it("should throw when configuration is missing", async () => {
    vi.mocked(getRuntimeEnv).mockReturnValue("");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureLocalizationSession()).rejects.toThrow(
      "Missing authentication configuration",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("should throw when the token response is not ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ensureLocalizationSession()).rejects.toThrow(
      "Failed to refresh localization session",
    );
  });

  it("should de-duplicate concurrent refreshes into a single request", async () => {
    let resolveFetch: (v: { ok: boolean }) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((res) => {
          resolveFetch = res;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const p1 = ensureLocalizationSession();
    const p2 = ensureLocalizationSession();
    resolveFetch({ ok: true });
    await Promise.all([p1, p2]);

    // Only one network request despite two concurrent callers.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should allow a fresh refresh after the previous one settled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await ensureLocalizationSession();
    await ensureLocalizationSession();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
