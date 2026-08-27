import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// @seliseblocks/genesis-os is externalized by Vitest, so its bundled runtime-env fallback
// (`import.meta.env[key]`, unguarded) reads `import.meta.env` on the raw ESM module -- which
// Vite never injects for externalized deps -- and throws on any import of the observability
// subpath. Stub it so tests never construct a real Rollbar client (which would also start
// reporting test errors) and never hit that crash.
vi.mock("@seliseblocks/genesis-os/observability", () => ({
  RollbarProvider: ({ children }: { children: unknown }) => children,
  getRollbar: () => ({ error: vi.fn(), warning: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  createHttpFailureReporter: () => vi.fn(),
  attachQueryErrorReporting: () => vi.fn(),
}));

// Vitest is configured with globals: false, so @testing-library/react's
// automatic afterEach cleanup does not register itself. Wire it up manually
// so component/hook renders are torn down between tests.
afterEach(() => {
  cleanup();
});

// ─── jsdom polyfills for Radix UI / cmdk primitives ──────────────────────────
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

if (typeof globalThis.matchMedia === "undefined") {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof matchMedia;
}
