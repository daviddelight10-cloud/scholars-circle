// vite.config.js
import { defineConfig } from "file:///C:/Users/Delight/Downloads/Phone%20Link/scholar's%20circle/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Delight/Downloads/Phone%20Link/scholar's%20circle/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/Delight/Downloads/Phone%20Link/scholar's%20circle/node_modules/vite-plugin-pwa/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.js",
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "loading.png"],
      manifest: {
        id: "/?source=pwa",
        name: "Scholar's Circle",
        short_name: "Scholar's",
        description: "Smart study companion for university students \u2014 live classes, AI tutor, assignments, and more.",
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
          { src: "/loading.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/loading.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/loading.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ],
        shortcuts: [
          {
            name: "Today's Plan",
            short_name: "Today",
            description: "Jump to today's study tasks",
            url: "/?tab=today",
            icons: [{ src: "/loading.png", sizes: "192x192" }]
          },
          {
            name: "AI Tutor",
            short_name: "Tutor",
            description: "Ask the AI tutor anything",
            url: "/?tab=tutor",
            icons: [{ src: "/loading.png", sizes: "192x192" }]
          },
          {
            name: "Live Classes",
            short_name: "Live",
            description: "Join an ongoing live class",
            url: "/?tab=classroom",
            icons: [{ src: "/loading.png", sizes: "192x192" }]
          },
          {
            name: "Messages",
            short_name: "Inbox",
            description: "Direct messages with lecturers",
            url: "/?tab=lecturers",
            icons: [{ src: "/loading.png", sizes: "192x192" }]
          }
        ]
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico,webmanifest}"]
      }
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxEZWxpZ2h0XFxcXERvd25sb2Fkc1xcXFxQaG9uZSBMaW5rXFxcXHNjaG9sYXIncyBjaXJjbGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXERlbGlnaHRcXFxcRG93bmxvYWRzXFxcXFBob25lIExpbmtcXFxcc2Nob2xhcidzIGNpcmNsZVxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvRGVsaWdodC9Eb3dubG9hZHMvUGhvbmUlMjBMaW5rL3NjaG9sYXIncyUyMGNpcmNsZS92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICBzdHJhdGVnaWVzOiBcImluamVjdE1hbmlmZXN0XCIsXHJcbiAgICAgIHNyY0RpcjogXCJzcmNcIixcclxuICAgICAgZmlsZW5hbWU6IFwic3cuanNcIixcclxuICAgICAgcmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcclxuICAgICAgaW5jbHVkZUFzc2V0czogW1wiZmF2aWNvbi5pY29cIiwgXCJsb2FkaW5nLnBuZ1wiXSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBpZDogXCIvP3NvdXJjZT1wd2FcIixcclxuICAgICAgICBuYW1lOiBcIlNjaG9sYXIncyBDaXJjbGVcIixcclxuICAgICAgICBzaG9ydF9uYW1lOiBcIlNjaG9sYXInc1wiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlNtYXJ0IHN0dWR5IGNvbXBhbmlvbiBmb3IgdW5pdmVyc2l0eSBzdHVkZW50cyBcdTIwMTQgbGl2ZSBjbGFzc2VzLCBBSSB0dXRvciwgYXNzaWdubWVudHMsIGFuZCBtb3JlLlwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiMwZjExMTdcIixcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiMwZjExMTdcIixcclxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcclxuICAgICAgICBkaXNwbGF5X292ZXJyaWRlOiBbXCJ3aW5kb3ctY29udHJvbHMtb3ZlcmxheVwiLCBcInN0YW5kYWxvbmVcIiwgXCJtaW5pbWFsLXVpXCJdLFxyXG4gICAgICAgIG9yaWVudGF0aW9uOiBcImFueVwiLFxyXG4gICAgICAgIHN0YXJ0X3VybDogXCIvP3NvdXJjZT1wd2FcIixcclxuICAgICAgICBzY29wZTogXCIvXCIsXHJcbiAgICAgICAgbGFuZzogXCJlblwiLFxyXG4gICAgICAgIGRpcjogXCJsdHJcIixcclxuICAgICAgICBjYXRlZ29yaWVzOiBbXCJlZHVjYXRpb25cIiwgXCJwcm9kdWN0aXZpdHlcIiwgXCJzb2NpYWxcIl0sXHJcbiAgICAgICAgcHJlZmVyX3JlbGF0ZWRfYXBwbGljYXRpb25zOiBmYWxzZSxcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgeyBzcmM6IFwiL2xvYWRpbmcucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnlcIiB9LFxyXG4gICAgICAgICAgeyBzcmM6IFwiL2xvYWRpbmcucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnlcIiB9LFxyXG4gICAgICAgICAgeyBzcmM6IFwiL2xvYWRpbmcucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJtYXNrYWJsZVwiIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzaG9ydGN1dHM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbmFtZTogXCJUb2RheSdzIFBsYW5cIixcclxuICAgICAgICAgICAgc2hvcnRfbmFtZTogXCJUb2RheVwiLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJKdW1wIHRvIHRvZGF5J3Mgc3R1ZHkgdGFza3NcIixcclxuICAgICAgICAgICAgdXJsOiBcIi8/dGFiPXRvZGF5XCIsXHJcbiAgICAgICAgICAgIGljb25zOiBbeyBzcmM6IFwiL2xvYWRpbmcucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiB9XVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbmFtZTogXCJBSSBUdXRvclwiLFxyXG4gICAgICAgICAgICBzaG9ydF9uYW1lOiBcIlR1dG9yXCIsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkFzayB0aGUgQUkgdHV0b3IgYW55dGhpbmdcIixcclxuICAgICAgICAgICAgdXJsOiBcIi8/dGFiPXR1dG9yXCIsXHJcbiAgICAgICAgICAgIGljb25zOiBbeyBzcmM6IFwiL2xvYWRpbmcucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiB9XVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbmFtZTogXCJMaXZlIENsYXNzZXNcIixcclxuICAgICAgICAgICAgc2hvcnRfbmFtZTogXCJMaXZlXCIsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkpvaW4gYW4gb25nb2luZyBsaXZlIGNsYXNzXCIsXHJcbiAgICAgICAgICAgIHVybDogXCIvP3RhYj1jbGFzc3Jvb21cIixcclxuICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogXCIvbG9hZGluZy5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiIH1dXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBuYW1lOiBcIk1lc3NhZ2VzXCIsXHJcbiAgICAgICAgICAgIHNob3J0X25hbWU6IFwiSW5ib3hcIixcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiRGlyZWN0IG1lc3NhZ2VzIHdpdGggbGVjdHVyZXJzXCIsXHJcbiAgICAgICAgICAgIHVybDogXCIvP3RhYj1sZWN0dXJlcnNcIixcclxuICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogXCIvbG9hZGluZy5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiIH1dXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICBpbmplY3RNYW5pZmVzdDoge1xyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsc3ZnLHBuZyxpY28sd2VibWFuaWZlc3R9XCJdLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1csU0FBUyxvQkFBb0I7QUFDalksT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUV4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixRQUFRO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixRQUFRO0FBQUEsTUFDUixVQUFVO0FBQUEsTUFDVixjQUFjO0FBQUEsTUFDZCxlQUFlLENBQUMsZUFBZSxhQUFhO0FBQUEsTUFDNUMsVUFBVTtBQUFBLFFBQ1IsSUFBSTtBQUFBLFFBQ0osTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1Qsa0JBQWtCLENBQUMsMkJBQTJCLGNBQWMsWUFBWTtBQUFBLFFBQ3hFLGFBQWE7QUFBQSxRQUNiLFdBQVc7QUFBQSxRQUNYLE9BQU87QUFBQSxRQUNQLE1BQU07QUFBQSxRQUNOLEtBQUs7QUFBQSxRQUNMLFlBQVksQ0FBQyxhQUFhLGdCQUFnQixRQUFRO0FBQUEsUUFDbEQsNkJBQTZCO0FBQUEsUUFDN0IsT0FBTztBQUFBLFVBQ0wsRUFBRSxLQUFLLGdCQUFnQixPQUFPLFdBQVcsTUFBTSxhQUFhLFNBQVMsTUFBTTtBQUFBLFVBQzNFLEVBQUUsS0FBSyxnQkFBZ0IsT0FBTyxXQUFXLE1BQU0sYUFBYSxTQUFTLE1BQU07QUFBQSxVQUMzRSxFQUFFLEtBQUssZ0JBQWdCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxXQUFXO0FBQUEsUUFDbEY7QUFBQSxRQUNBLFdBQVc7QUFBQSxVQUNUO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTixZQUFZO0FBQUEsWUFDWixhQUFhO0FBQUEsWUFDYixLQUFLO0FBQUEsWUFDTCxPQUFPLENBQUMsRUFBRSxLQUFLLGdCQUFnQixPQUFPLFVBQVUsQ0FBQztBQUFBLFVBQ25EO0FBQUEsVUFDQTtBQUFBLFlBQ0UsTUFBTTtBQUFBLFlBQ04sWUFBWTtBQUFBLFlBQ1osYUFBYTtBQUFBLFlBQ2IsS0FBSztBQUFBLFlBQ0wsT0FBTyxDQUFDLEVBQUUsS0FBSyxnQkFBZ0IsT0FBTyxVQUFVLENBQUM7QUFBQSxVQUNuRDtBQUFBLFVBQ0E7QUFBQSxZQUNFLE1BQU07QUFBQSxZQUNOLFlBQVk7QUFBQSxZQUNaLGFBQWE7QUFBQSxZQUNiLEtBQUs7QUFBQSxZQUNMLE9BQU8sQ0FBQyxFQUFFLEtBQUssZ0JBQWdCLE9BQU8sVUFBVSxDQUFDO0FBQUEsVUFDbkQ7QUFBQSxVQUNBO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTixZQUFZO0FBQUEsWUFDWixhQUFhO0FBQUEsWUFDYixLQUFLO0FBQUEsWUFDTCxPQUFPLENBQUMsRUFBRSxLQUFLLGdCQUFnQixPQUFPLFVBQVUsQ0FBQztBQUFBLFVBQ25EO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2QsY0FBYyxDQUFDLDRDQUE0QztBQUFBLE1BQzdEO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
