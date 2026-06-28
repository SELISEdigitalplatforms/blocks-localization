import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
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
