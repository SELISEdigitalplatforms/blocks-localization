import { afterEach, describe, expect, it } from "vitest";

import {
  deriveAgentBaseUrl,
  deriveDeploymentBaseUrl,
  deriveIamBaseUrl,
  deriveLocalizationBaseUrl,
  deriveLogicBaseUrl,
  deriveObservabilityBaseUrl,
  deriveOsBaseUrl,
  deriveUdsBaseUrl,
  deriveUtilityBaseUrl,
} from "@/lib/blocks-url.util";

const originalLocation = window.location;

/** Override window.location.origin for the duration of a test. */
const setOrigin = (origin: string) => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, origin, href: `${origin}/` },
  });
};

describe("lib/blocks-url.util", () => {
  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  describe("localhost origin", () => {
    it("should map to the non-prefixed dev/stg domain", () => {
      setOrigin("http://localhost:4000");
      expect(deriveLocalizationBaseUrl()).toBe(
        "https://localization.blocksdevelopers.com",
      );
    });

    it("should map 127.0.0.1 the same way", () => {
      setOrigin("http://127.0.0.1:4000");
      expect(deriveUtilityBaseUrl()).toBe(
        "https://utilities.blocksdevelopers.com",
      );
    });
  });

  describe("dev/stg .blocksdevelopers.com origin", () => {
    it("should preserve the dev- prefix", () => {
      setOrigin("https://dev-cloud.blocksdevelopers.com");
      expect(deriveIamBaseUrl()).toBe("https://dev-iam.blocksdevelopers.com");
    });

    it("should preserve the stg- prefix", () => {
      setOrigin("https://stg-cloud.blocksdevelopers.com");
      expect(deriveLogicBaseUrl()).toBe("https://stg-logic.blocksdevelopers.com");
    });

    it("should use no prefix when the host has none", () => {
      setOrigin("https://cloud.blocksdevelopers.com");
      expect(deriveUdsBaseUrl()).toBe("https://data.blocksdevelopers.com");
    });
  });

  describe("production .seliseblocks.com origin", () => {
    it("should map to the production domain with no prefix", () => {
      setOrigin("https://cloud.seliseblocks.com");
      expect(deriveLocalizationBaseUrl()).toBe(
        "https://localization.seliseblocks.com",
      );
    });

    it("should preserve a dev- prefix on production domain", () => {
      setOrigin("https://dev-cloud.seliseblocks.com");
      expect(deriveObservabilityBaseUrl()).toBe(
        "https://dev-monitor.seliseblocks.com",
      );
    });
  });

  describe("all derive helpers map to their subdomain", () => {
    it("should resolve each service subdomain", () => {
      setOrigin("https://cloud.blocksdevelopers.com");
      expect(deriveAgentBaseUrl()).toBe("https://agent.blocksdevelopers.com");
      expect(deriveOsBaseUrl()).toBe("https://os.blocksdevelopers.com");
      expect(deriveDeploymentBaseUrl()).toBe(
        "https://release.blocksdevelopers.com",
      );
    });
  });

  describe("SSR (no window)", () => {
    it("should fall back to the stg dev/stg domain when window is undefined", () => {
      const original = globalThis.window;
      // @ts-expect-error simulate non-browser environment
      delete (globalThis as any).window;
      try {
        expect(deriveLocalizationBaseUrl()).toBe(
          "https://stg-localization.blocksdevelopers.com",
        );
      } finally {
        (globalThis as any).window = original;
      }
    });
  });
});
