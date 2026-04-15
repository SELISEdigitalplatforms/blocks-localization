import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Production build output is served by ASP.NET from ../server/Api/wwwroot (build via ./run.sh or `npm run build`).
// Optional: `npm run dev` in client/ for local UI work without dotnet (no API unless you configure it yourself).
export default defineConfig({
  // Load `.env` from `client/` (same folder as this config) so `client/.env` is picked up.
  envDir: __dirname,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  envPrefix: ['BLOCKS_'],
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../server/Api/wwwroot',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    restoreMocks: true,
    clearMocks: true,
  },
});
