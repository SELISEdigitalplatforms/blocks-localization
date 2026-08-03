import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./app"),
      "@blocks-lmt": path.resolve(__dirname, "./app/cross-modules/lmt"),
      "@blocks-storage": path.resolve(__dirname, "./app/cross-modules/storage"),
      "@blocks-communication": path.resolve(__dirname, "./app/cross-modules/communication"),
      "@blocks-identifier": path.resolve(__dirname, "./app/cross-modules/identifier"),
      "@blocks-localization": path.resolve(__dirname, "./app/cross-modules/localization"),
      "@blocks-utilities": path.resolve(__dirname, "./app/cross-modules/utilities"),
      "@blocks-ai": path.resolve(__dirname, "./app/cross-modules/ai"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    include: ["app/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", "**/__mocks__/**"],
    setupFiles: ["app/test-setup.ts"],
    css: false,
    coverage: {
      reporter: ["text", "lcov"],
      all: true,
      provider: "v8",
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.test.*",
        "app/**/*.spec.*",
        "app/**/*.d.ts",
        "app/**/main.tsx",
        "app/**/vite-env.d.ts",
        "app/test-setup.ts",
        "app/**/test-utils/**",
        "**/components/ui/**",
        "**/components/ui-kits/**",
        "app/**/*.stories.*",
        "**/__generated__/**",
        "**/*.gen.*",
      ],
    },
  },
});
