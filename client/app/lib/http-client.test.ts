import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: (key: string) => `env:${key}`,
}));

vi.mock("@seliseblocks/blocks-kit/lib", () => {
  class HttpClient {
    config: unknown;
    constructor(config: unknown) {
      this.config = config;
    }
  }
  return { HttpClient };
});

import { HttpClient, serviceInstances } from "@/lib/http-client";

describe("lib/http-client", () => {
  it("should expose localization, logic and iam service instances", () => {
    expect(serviceInstances.localizationService).toBeInstanceOf(HttpClient);
    expect(serviceInstances.logicService).toBeInstanceOf(HttpClient);
    expect(serviceInstances.iamService).toBeInstanceOf(HttpClient);
  });

  it("should build each client with the resolved runtime env values", () => {
    expect((serviceInstances.localizationService as any).config).toEqual({
      baseURL: "env:BLOCKS_LOCALIZATION_BASE_URL",
      blocksKey: "env:BLOCKS_X_BLOCKS_KEY",
    });
    expect((serviceInstances.logicService as any).config).toEqual({
      baseURL: "env:BLOCKS_LOGIC_BASE_URL",
      blocksKey: "env:BLOCKS_X_BLOCKS_KEY",
    });
  });

  it("should re-export HttpClient", () => {
    expect(HttpClient).toBeTypeOf("function");
  });
});
