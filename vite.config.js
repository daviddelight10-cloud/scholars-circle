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
      includeAssets: ["favicon.ico", "loading.png"],
      manifest: {
        name: "Scholar's Circle",
        short_name: "Scholar's",
        description: "Smart study companion for first-year university students.",
        theme_color: "#0f1117",
        background_color: "#0f1117",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/loading.png", sizes: "192x192", type: "image/png" },
          { src: "/loading.png", sizes: "512x512", type: "image/png" },
          { src: "/loading.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"],
      },
    }),
  ],
});
