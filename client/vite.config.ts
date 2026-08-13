import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import { defineConfig, loadEnv } from "vite";

const resolveDevHttps = (): { cert: Buffer; key: Buffer } | undefined => {
  const certPath = process.env.LOCALIZATION_SSL_CERT;
  const keyPath = process.env.LOCALIZATION_SSL_KEY;

  if (!certPath || !keyPath) {
    return undefined;
  }

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    // eslint-disable-next-line no-console -- This is a vite config file where console warnings are appropriate for debugging
    console.warn("[dev-https] SSL cert/key file missing — serving HTTP.");
    return undefined;
  }

  return { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "BLOCKS_");
  const proxyTarget = env.BLOCKS_API_BASE_URL;
  const iamProxyTarget = env.BLOCKS_IAM_BASE_URL || "https://dev-iam.blocksdevelopers.com";
  const httpsConfig = resolveDevHttps();

  return {
    envPrefix: ["BLOCKS_"],
    publicDir: path.resolve(__dirname, "app/public"),
    plugins: [react()],
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
    build: {
      outDir: "../server/Api/wwwroot",
      emptyOutDir: true,
      chunkSizeWarningLimit: 3000,
      cssMinify: false,
      rollupOptions: {
        onwarn(warning, warn) {
          // Suppress INVALID_ANNOTATION warnings from @microsoft/signalr
          if (warning.code === "INVALID_ANNOTATION") return;
          // Suppress chunk size warnings
          if (warning.code === "CHUNK_SIZE_WARNING") return;
          warn(warning);
        },
      },
    },
    server: {
      host: true, // Listen on all addresses (0.0.0.0)
      port: 4000,
      https: httpsConfig,
      allowedHosts: [
        "stg-cloud.seliseblocks.com",
        "localhost",
        ".seliseblocks.com",
        ".blocksdevelopers.com",
        "dev-localization.blocksdevelopers.com",
      ],
      proxy: proxyTarget
        ? {
            "/api/iam": {
              target: iamProxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/api": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/cloudbuild": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/idp": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/identifier": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/communication": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/cloudconfiguration": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/uilm": { target: proxyTarget, changeOrigin: true, secure: false },
            "/utilities": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/lmt": { target: proxyTarget, changeOrigin: true, secure: false },
            "/mfa": { target: proxyTarget, changeOrigin: true, secure: false },
            "/alert": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/blocksai-api": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/studio": {
              target: proxyTarget,
              changeOrigin: true,
              secure: false,
            },
            "/uds": { target: proxyTarget, changeOrigin: true, secure: false },
          }
        : undefined,
    },
  };
});
