import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "icon-192.png", "icon-512.png", "icon-192-maskable.png", "icon-512-maskable.png", "icon-96.png"],
      manifest: {
        id: "scholars-circle-pwa",
        name: "Scholar's Circle",
        short_name: "Scholar's",
        description: "Your AI-powered study companion for academic success",
        theme_color: "#818cf8",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "en",
        dir: "ltr",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        screenshots: [
          { src: "/screenshot-wide.png", sizes: "1280x720", type: "image/png", form_factor: "wide" },
          { src: "/screenshot-narrow.png", sizes: "720x1280", type: "image/png", form_factor: "narrow" },
        ],
        categories: ["education", "productivity"],
        prefer_related_applications: false,
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest,woff2}"],
        maximumFileSizeToCacheInBytes: 5000000,
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/scholars-circle-production\.up\.railway\.app\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 86400,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    headers: {
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "1; mode=block",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    },
  },
});
