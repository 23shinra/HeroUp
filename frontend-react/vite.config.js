import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** PWA is opt-in for preview/staging builds only (see scripts/preview-notes.md). */
const enablePwa = process.env.VITE_PREVIEW_PWA === "1";

export default defineConfig({
  resolve: {
    alias: {
      "@domain/game-data": path.resolve(rootDir, "src/domain/game-data/index.js"),
      "@domain/state": path.resolve(rootDir, "src/domain/state/index.js"),
      "@domain/sync": path.resolve(rootDir, "src/domain/sync/index.js"),
      "@domain/game-engine": path.resolve(rootDir, "src/domain/game-engine/index.js"),
      "@domain/icons": path.resolve(rootDir, "src/domain/icons/index.js"),
      "@domain/attendance": path.resolve(rootDir, "src/domain/attendance/index.js"),
      "@domain/reminders": path.resolve(rootDir, "src/domain/reminders/index.js"),
      "@domain/exercise": path.resolve(rootDir, "src/domain/exercise/index.js"),
    },
  },  plugins: [
    react(),
    ...(enablePwa
      ? [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["assets/**/*"],
            manifest: {
              name: "LevelUp",
              short_name: "LevelUp",
              description: "Тренировки, прогресс и бои для спортивных секций",
              start_url: "/",
              display: "standalone",
              background_color: "#151A2E",
              theme_color: "#151A2E",
              lang: "ru",
              icons: [
                { src: "/assets/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
                { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
                {
                  src: "/assets/icon-maskable-192.png",
                  sizes: "192x192",
                  type: "image/png",
                  purpose: "maskable",
                },
                {
                  src: "/assets/icon-maskable-512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
                { src: "/assets/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
              ],
            },
            workbox: {
              navigateFallback: "/index.html",
              globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,jpg,jpeg}"],
              // Pose model + WASM are large; cache on demand rather than bloating first install.
              runtimeCaching: [
                {
                  urlPattern: /^\/api\/.*/i,
                  handler: "NetworkOnly",
                },
                {
                  urlPattern: /\/models\/.*/i,
                  handler: "CacheFirst",
                  options: {
                    cacheName: "pose-models",
                    expiration: {
                      maxEntries: 12,
                      maxAgeSeconds: 60 * 60 * 24 * 90,
                    },
                  },
                },
              ],
            },          }),
        ]
      : []),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3021",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js",
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
  },
});
