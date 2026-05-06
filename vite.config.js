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
      registerType: "prompt",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
        type: "module",
      },
      includeAssets: ["icon-32.png", "icon-192.png", "icon-512.png", "icon-192-maskable.png", "icon-512-maskable.png", "icon-96.png", "privacy.html"],
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
        shortcuts: [
          { name: "Start Practice", short_name: "Practice", description: "Start a practice session", url: "/?tab=quiz", icons: [{src: "/icon-96.png", sizes: "96x96"}] },
          { name: "View Leaderboard", short_name: "Leaderboard", description: "Check your ranking", url: "/?tab=leaderboard", icons: [{src: "/icon-96.png", sizes: "96x96"}] },
          { name: "Quick Quiz", short_name: "Quiz", description: "Jump into a quick quiz", url: "/?tab=quiz&quick=true", icons: [{src: "/icon-96.png", sizes: "96x96"}] },
          { name: "My Notes", short_name: "Notes", description: "View your study notes", url: "/?tab=notes", icons: [{src: "/icon-96.png", sizes: "96x96"}] },
          { name: "Flashcards", short_name: "Cards", description: "Review flashcards", url: "/?tab=flashcards", icons: [{src: "/icon-96.png", sizes: "96x96"}] },
        ],
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
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
