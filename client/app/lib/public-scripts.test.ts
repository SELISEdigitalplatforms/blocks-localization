import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The two classic scripts the SPA shell loads before the app (app/public, served as-is): the CSP style
// nonce shim and the runtime config. Each test runs a fresh copy of the script.
const runScript = async (path: string) => {
  vi.resetModules();
  await import(/* @vite-ignore */ `${path}?t=${Date.now()}-${Math.random()}`);
};

describe("csp-nonce.js", () => {
  const originalCreateElement = Document.prototype.createElement;
  const globals = globalThis as { __webpack_nonce__?: string };

  beforeEach(() => {
    document.head.innerHTML = "";
    delete globals.__webpack_nonce__;
  });

  afterEach(() => {
    Document.prototype.createElement = originalCreateElement;
    document.head.innerHTML = "";
    delete globals.__webpack_nonce__;
  });

  const addMeta = (nonce: string) => {
    const meta = document.createElement("meta");
    meta.setAttribute("name", "csp-nonce");
    meta.setAttribute("nonce", nonce);
    document.head.appendChild(meta);
  };

  it("stamps the nonce on every style element created afterwards", async () => {
    addMeta("abc123==");
    await runScript("../public/csp-nonce.js");

    expect(globals.__webpack_nonce__).toBe("abc123==");
    expect(document.createElement("style").getAttribute("nonce")).toBe("abc123==");
    expect(document.createElement("STYLE").getAttribute("nonce")).toBe("abc123==");
    expect(document.createElement("div").hasAttribute("nonce")).toBe(false);
  });

  it("does nothing while the server has not filled the placeholder", async () => {
    addMeta("__CSP_STYLE_NONCE__");
    await runScript("../public/csp-nonce.js");

    expect(globals.__webpack_nonce__).toBeUndefined();
    expect(Document.prototype.createElement).toBe(originalCreateElement);
  });

  it("does nothing without the meta tag", async () => {
    await runScript("../public/csp-nonce.js");

    expect(globals.__webpack_nonce__).toBeUndefined();
    expect(document.createElement("style").hasAttribute("nonce")).toBe(false);
  });
});

describe("runtime-config.js", () => {
  const globals = globalThis as { __BLOCKS_ENV__?: Record<string, string> };
  const original = globals.__BLOCKS_ENV__;

  afterEach(() => {
    globals.__BLOCKS_ENV__ = original;
  });

  it("defines the runtime environment with a placeholder for every key", async () => {
    await runScript("../public/runtime-config.js");

    const env = globals.__BLOCKS_ENV__ ?? {};
    expect(Object.keys(env).length).toBeGreaterThan(0);
    for (const [key, value] of Object.entries(env)) {
      expect(value).toBe(`__${key}__`);
    }
    expect(env).toHaveProperty("BLOCKS_LOCALIZATION_BASE_URL");
    expect(env).toHaveProperty("BLOCKS_IAM_BASE_URL");
  });
});
