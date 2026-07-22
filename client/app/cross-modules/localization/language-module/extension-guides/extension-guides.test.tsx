import { describe, expect, it } from "vitest";
import { getExtensionApiBaseUrl } from "./extension-guides.constant";

describe("getExtensionApiBaseUrl", () => {
  it.each(["localhost", "127.0.0.1", "::1", "dev-localization.blocksdevelopers.com"])(
    "uses the development API for %s",
    (hostname) => {
      expect(getExtensionApiBaseUrl(hostname)).toBe(
        "https://dev-api.blocksdevelopers.com",
      );
    },
  );

  it.each([
    "stg-localization.blocksdevelopers.com",
    "staging-localization.seliseblocks.com",
  ])("uses the staging API for %s", (hostname) => {
    expect(getExtensionApiBaseUrl(hostname)).toBe(
      "https://stg-api.blocksdevelopers.com",
    );
  });

  it.each(["localization.seliseblocks.com", "app.example.com", ""])(
    "uses the production API for %s",
    (hostname) => {
      expect(getExtensionApiBaseUrl(hostname)).toBe(
        "https://api.seliseblocks.com",
      );
    },
  );
});
