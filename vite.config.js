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
      includeAssets: ["favicon.ico", "loading.png", "icon-192.png", "icon-512.png", "icon-96.png", "offline.html"],
      manifest: {
        id: "/?source=pwa",
        name: "Scholar's Circle",
        short_name: "Scholar's",
        description: "Smart study companion for university students — live classes, AI tutor, assignments, and more.",
        theme_color: "#0f1117",
        background_color: "#0f1117",
        display: "standalone",
        display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
        orientation: "any",
        start_url: "/?source=pwa",
        scope: "/",
        lang: "en",
        dir: "ltr",
        categories: ["education", "productivity", "social"],
        prefer_related_applications: false,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          {
            name: "Today's Plan",
            short_name: "Today",
            description: "Jump to today's study tasks",
            url: "/?tab=today",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "AI Tutor",
            short_name: "Tutor",
            description: "Ask the AI tutor anything",
            url: "/?tab=tutor",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Live Classes",
            short_name: "Live",
            description: "Join an ongoing live class",
            url: "/?tab=classroom",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Messages",
            short_name: "Inbox",
            description: "Direct messages with lecturers",
            url: "/?tab=lecturers",
            icons: [{ src: "/icon-192.png", sizes: "192x192" }]
          }
        ]
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
});
