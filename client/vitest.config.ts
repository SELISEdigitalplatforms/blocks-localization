import { defineConfig } from "vitest/config";
import path from "path";

// Minimal Vitest config for client unit tests.
// - Reuses the `@/*` alias from vite.config.ts so tests can import from "@/lib/...".
// - Uses the jsdom environment so DOM APIs (window, URL, history, crypto) are available.
// - Picks up `**/*.test.{ts,tsx}` everywhere under `app/` (already excluded from
//   the production build via tsconfig.app.json).
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@blocks-idp": path.resolve(__dirname, "./app/idp"),
      "@blocks-lmt": path.resolve(__dirname, "./app/cross-modules/lmt"),
      "@blocks-storage": path.resolve(__dirname, "./app/cross-modules/storage"),
      "@blocks-communication": path.resolve(
        __dirname,
        "./app/cross-modules/communication",
      ),
      "@blocks-identifier": path.resolve(
        __dirname,
        "./app/cross-modules/identifier",
      ),
      "@blocks-localization": path.resolve(
        __dirname,
        "./app/cross-modules/localization",
      ),
      "@blocks-utilities": path.resolve(
        __dirname,
        "./app/cross-modules/utilities",
      ),
      "@blocks-ai": path.resolve(__dirname, "./app/cross-modules/ai"),
      "@blocks-observability": path.resolve(
        __dirname,
        "./app/cross-modules/observability",
      ),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["app/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "**/__mocks__/**"],
    css: false,
  },
});
