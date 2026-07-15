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
      includeAssets: ["favicon.ico", "loading.png", "icon-192.png", "icon-512.png", "icon-96.png", "offline.html"],
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
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
          { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
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
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      }
    })
  ]
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxEZWxpZ2h0XFxcXERvd25sb2Fkc1xcXFxQaG9uZSBMaW5rXFxcXHNjaG9sYXIncyBjaXJjbGVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXERlbGlnaHRcXFxcRG93bmxvYWRzXFxcXFBob25lIExpbmtcXFxcc2Nob2xhcidzIGNpcmNsZVxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvRGVsaWdodC9Eb3dubG9hZHMvUGhvbmUlMjBMaW5rL3NjaG9sYXIncyUyMGNpcmNsZS92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICBzdHJhdGVnaWVzOiBcImluamVjdE1hbmlmZXN0XCIsXHJcbiAgICAgIHNyY0RpcjogXCJzcmNcIixcclxuICAgICAgZmlsZW5hbWU6IFwic3cuanNcIixcclxuICAgICAgcmVnaXN0ZXJUeXBlOiBcImF1dG9VcGRhdGVcIixcclxuICAgICAgaW5jbHVkZUFzc2V0czogW1wiZmF2aWNvbi5pY29cIiwgXCJsb2FkaW5nLnBuZ1wiLCBcImljb24tMTkyLnBuZ1wiLCBcImljb24tNTEyLnBuZ1wiLCBcImljb24tOTYucG5nXCIsIFwib2ZmbGluZS5odG1sXCJdLFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIGlkOiBcIi8/c291cmNlPXB3YVwiLFxyXG4gICAgICAgIG5hbWU6IFwiU2Nob2xhcidzIENpcmNsZVwiLFxyXG4gICAgICAgIHNob3J0X25hbWU6IFwiU2Nob2xhcidzXCIsXHJcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU21hcnQgc3R1ZHkgY29tcGFuaW9uIGZvciB1bml2ZXJzaXR5IHN0dWRlbnRzIFx1MjAxNCBsaXZlIGNsYXNzZXMsIEFJIHR1dG9yLCBhc3NpZ25tZW50cywgYW5kIG1vcmUuXCIsXHJcbiAgICAgICAgdGhlbWVfY29sb3I6IFwiIzBmMTExN1wiLFxyXG4gICAgICAgIGJhY2tncm91bmRfY29sb3I6IFwiIzBmMTExN1wiLFxyXG4gICAgICAgIGRpc3BsYXk6IFwic3RhbmRhbG9uZVwiLFxyXG4gICAgICAgIGRpc3BsYXlfb3ZlcnJpZGU6IFtcIndpbmRvdy1jb250cm9scy1vdmVybGF5XCIsIFwic3RhbmRhbG9uZVwiLCBcIm1pbmltYWwtdWlcIl0sXHJcbiAgICAgICAgb3JpZW50YXRpb246IFwiYW55XCIsXHJcbiAgICAgICAgc3RhcnRfdXJsOiBcIi8/c291cmNlPXB3YVwiLFxyXG4gICAgICAgIHNjb3BlOiBcIi9cIixcclxuICAgICAgICBsYW5nOiBcImVuXCIsXHJcbiAgICAgICAgZGlyOiBcImx0clwiLFxyXG4gICAgICAgIGNhdGVnb3JpZXM6IFtcImVkdWNhdGlvblwiLCBcInByb2R1Y3Rpdml0eVwiLCBcInNvY2lhbFwiXSxcclxuICAgICAgICBwcmVmZXJfcmVsYXRlZF9hcHBsaWNhdGlvbnM6IGZhbHNlLFxyXG4gICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICB7IHNyYzogXCIvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnlcIiB9LFxyXG4gICAgICAgICAgeyBzcmM6IFwiL2ljb24tNTEyLnBuZ1wiLCBzaXplczogXCI1MTJ4NTEyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIsIHB1cnBvc2U6IFwiYW55XCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9pY29uLTE5Mi1tYXNrYWJsZS5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBwdXJwb3NlOiBcIm1hc2thYmxlXCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9pY29uLTUxMi1tYXNrYWJsZS5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBwdXJwb3NlOiBcIm1hc2thYmxlXCIgfSxcclxuICAgICAgICBdLFxyXG4gICAgICAgIHNob3J0Y3V0czogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBuYW1lOiBcIlRvZGF5J3MgUGxhblwiLFxyXG4gICAgICAgICAgICBzaG9ydF9uYW1lOiBcIlRvZGF5XCIsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkp1bXAgdG8gdG9kYXkncyBzdHVkeSB0YXNrc1wiLFxyXG4gICAgICAgICAgICB1cmw6IFwiLz90YWI9dG9kYXlcIixcclxuICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogXCIvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiB9XVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbmFtZTogXCJBSSBUdXRvclwiLFxyXG4gICAgICAgICAgICBzaG9ydF9uYW1lOiBcIlR1dG9yXCIsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkFzayB0aGUgQUkgdHV0b3IgYW55dGhpbmdcIixcclxuICAgICAgICAgICAgdXJsOiBcIi8/dGFiPXR1dG9yXCIsXHJcbiAgICAgICAgICAgIGljb25zOiBbeyBzcmM6IFwiL2ljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIgfV1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIG5hbWU6IFwiTGl2ZSBDbGFzc2VzXCIsXHJcbiAgICAgICAgICAgIHNob3J0X25hbWU6IFwiTGl2ZVwiLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJKb2luIGFuIG9uZ29pbmcgbGl2ZSBjbGFzc1wiLFxyXG4gICAgICAgICAgICB1cmw6IFwiLz90YWI9Y2xhc3Nyb29tXCIsXHJcbiAgICAgICAgICAgIGljb25zOiBbeyBzcmM6IFwiL2ljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIgfV1cclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIG5hbWU6IFwiTWVzc2FnZXNcIixcclxuICAgICAgICAgICAgc2hvcnRfbmFtZTogXCJJbmJveFwiLFxyXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJEaXJlY3QgbWVzc2FnZXMgd2l0aCBsZWN0dXJlcnNcIixcclxuICAgICAgICAgICAgdXJsOiBcIi8/dGFiPWxlY3R1cmVyc1wiLFxyXG4gICAgICAgICAgICBpY29uczogW3sgc3JjOiBcIi9pY29uLTE5Mi5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiIH1dXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgXVxyXG4gICAgICB9LFxyXG4gICAgICBpbmplY3RNYW5pZmVzdDoge1xyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsc3ZnLHBuZyxpY28sd2VibWFuaWZlc3R9XCJdLFxyXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiA1ICogMTAyNCAqIDEwMjQsXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFvVyxTQUFTLG9CQUFvQjtBQUNqWSxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBRXhCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaLFFBQVE7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxlQUFlLGVBQWUsZ0JBQWdCLGdCQUFnQixlQUFlLGNBQWM7QUFBQSxNQUMzRyxVQUFVO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxrQkFBa0IsQ0FBQywyQkFBMkIsY0FBYyxZQUFZO0FBQUEsUUFDeEUsYUFBYTtBQUFBLFFBQ2IsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsTUFBTTtBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsWUFBWSxDQUFDLGFBQWEsZ0JBQWdCLFFBQVE7QUFBQSxRQUNsRCw2QkFBNkI7QUFBQSxRQUM3QixPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssaUJBQWlCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxNQUFNO0FBQUEsVUFDNUUsRUFBRSxLQUFLLGlCQUFpQixPQUFPLFdBQVcsTUFBTSxhQUFhLFNBQVMsTUFBTTtBQUFBLFVBQzVFLEVBQUUsS0FBSywwQkFBMEIsT0FBTyxXQUFXLE1BQU0sYUFBYSxTQUFTLFdBQVc7QUFBQSxVQUMxRixFQUFFLEtBQUssMEJBQTBCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxXQUFXO0FBQUEsUUFDNUY7QUFBQSxRQUNBLFdBQVc7QUFBQSxVQUNUO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTixZQUFZO0FBQUEsWUFDWixhQUFhO0FBQUEsWUFDYixLQUFLO0FBQUEsWUFDTCxPQUFPLENBQUMsRUFBRSxLQUFLLGlCQUFpQixPQUFPLFVBQVUsQ0FBQztBQUFBLFVBQ3BEO0FBQUEsVUFDQTtBQUFBLFlBQ0UsTUFBTTtBQUFBLFlBQ04sWUFBWTtBQUFBLFlBQ1osYUFBYTtBQUFBLFlBQ2IsS0FBSztBQUFBLFlBQ0wsT0FBTyxDQUFDLEVBQUUsS0FBSyxpQkFBaUIsT0FBTyxVQUFVLENBQUM7QUFBQSxVQUNwRDtBQUFBLFVBQ0E7QUFBQSxZQUNFLE1BQU07QUFBQSxZQUNOLFlBQVk7QUFBQSxZQUNaLGFBQWE7QUFBQSxZQUNiLEtBQUs7QUFBQSxZQUNMLE9BQU8sQ0FBQyxFQUFFLEtBQUssaUJBQWlCLE9BQU8sVUFBVSxDQUFDO0FBQUEsVUFDcEQ7QUFBQSxVQUNBO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTixZQUFZO0FBQUEsWUFDWixhQUFhO0FBQUEsWUFDYixLQUFLO0FBQUEsWUFDTCxPQUFPLENBQUMsRUFBRSxLQUFLLGlCQUFpQixPQUFPLFVBQVUsQ0FBQztBQUFBLFVBQ3BEO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2QsY0FBYyxDQUFDLDRDQUE0QztBQUFBLFFBQzNELCtCQUErQixJQUFJLE9BQU87QUFBQSxNQUM1QztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
