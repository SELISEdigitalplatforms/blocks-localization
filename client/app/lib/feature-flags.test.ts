import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { isGlossaryEnforcementEnabled } from "@/lib/feature-flags";

type EnvWindow = { __BLOCKS_ENV__?: Record<string, string> };

describe("lib/feature-flags isGlossaryEnforcementEnabled", () => {
  const originalWindowEnv = (window as unknown as EnvWindow).__BLOCKS_ENV__;

  beforeEach(() => {
    delete (window as unknown as EnvWindow).__BLOCKS_ENV__;
  });
  afterEach(() => {
    if (originalWindowEnv === undefined) {
      delete (window as unknown as EnvWindow).__BLOCKS_ENV__;
    } else {
      (window as unknown as EnvWindow).__BLOCKS_ENV__ = originalWindowEnv;
    }
    vi.unstubAllEnvs();
  });

  const setRuntimeValue = (value: string) => {
    (window as unknown as EnvWindow).__BLOCKS_ENV__ = { BLOCKS_GLOSSARY_ENFORCEMENT: value };
  };

  it("is on when the runtime value is true, in any letter case", () => {
    setRuntimeValue("true");
    expect(isGlossaryEnforcementEnabled()).toBe(true);
    setRuntimeValue("TRUE");
    expect(isGlossaryEnforcementEnabled()).toBe(true);
  });

  it("is off when the runtime value is false or anything else", () => {
    setRuntimeValue("false");
    expect(isGlossaryEnforcementEnabled()).toBe(false);
    setRuntimeValue("1");
    expect(isGlossaryEnforcementEnabled()).toBe(false);
  });

  it("is off when unset (C1)", () => {
    expect(isGlossaryEnforcementEnabled()).toBe(false);
  });

  it("is off when the server left the placeholder unreplaced (C1)", () => {
    setRuntimeValue("__BLOCKS_GLOSSARY_ENFORCEMENT__");
    expect(isGlossaryEnforcementEnabled()).toBe(false);
  });

  it("falls back to the build-time value when the runtime value is a placeholder", () => {
    vi.stubEnv("BLOCKS_GLOSSARY_ENFORCEMENT", "true");
    setRuntimeValue("__BLOCKS_GLOSSARY_ENFORCEMENT__");
    expect(isGlossaryEnforcementEnabled()).toBe(true);
  });
});
