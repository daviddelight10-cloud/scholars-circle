// vite.config.js
import { defineConfig } from "file:///C:/Users/DELL/Downloads/scholars-circle-main/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/DELL/Downloads/scholars-circle-main/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/DELL/Downloads/scholars-circle-main/node_modules/vite-plugin-pwa/dist/index.js";

// src/blog/blogPlugin.js
import fs from "fs";
import path from "path";
import matter from "file:///C:/Users/DELL/Downloads/scholars-circle-main/node_modules/gray-matter/index.js";
var POSTS_DIR = path.resolve(process.cwd(), "src/blog/posts");
function loadPosts() {
  if (!fs.existsSync(POSTS_DIR)) return [];
  const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith(".md"));
  return files.map((filename) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, filename), "utf-8");
    const { data: frontmatter, content } = matter(raw);
    const slug = filename.replace(/\.md$/, "");
    return {
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      excerpt: frontmatter.excerpt || "",
      tags: frontmatter.tags || [],
      content
    };
  }).sort((a, b) => new Date(b.date) - new Date(a.date));
}
function blogPlugin() {
  const virtualId = "virtual:blog-posts";
  const resolvedId = "\0" + virtualId;
  return {
    name: "blog-posts",
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id === resolvedId) {
        const posts = loadPosts();
        return `export default ${JSON.stringify(posts)}`;
      }
    }
  };
}

// vite.config.js
var vite_config_default = defineConfig({
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-icons": ["lucide-react"],
          "vendor-firebase": ["firebase/app", "firebase/messaging"]
        }
      }
    }
  },
  plugins: [
    blogPlugin(),
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
        theme_color: "#0A0D13",
        background_color: "#0A0D13",
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
        screenshots: [
          { src: "/loading.png", sizes: "512x512", type: "image/png", form_factor: "wide" },
          { src: "/loading.png", sizes: "512x512", type: "image/png", form_factor: "narrow" }
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAic3JjL2Jsb2cvYmxvZ1BsdWdpbi5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXERFTExcXFxcRG93bmxvYWRzXFxcXHNjaG9sYXJzLWNpcmNsZS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxERUxMXFxcXERvd25sb2Fkc1xcXFxzY2hvbGFycy1jaXJjbGUtbWFpblxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvREVMTC9Eb3dubG9hZHMvc2Nob2xhcnMtY2lyY2xlLW1haW4vdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gXCJ2aXRlLXBsdWdpbi1wd2FcIjtcbmltcG9ydCBibG9nUGx1Z2luIGZyb20gXCIuL3NyYy9ibG9nL2Jsb2dQbHVnaW4uanNcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgYnVpbGQ6IHtcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDYwMCxcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XG4gICAgICAgICAgJ3ZlbmRvci1yZWFjdCc6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nXSxcbiAgICAgICAgICAndmVuZG9yLXN1cGFiYXNlJzogWydAc3VwYWJhc2Uvc3VwYWJhc2UtanMnXSxcbiAgICAgICAgICAndmVuZG9yLWljb25zJzogWydsdWNpZGUtcmVhY3QnXSxcbiAgICAgICAgICAndmVuZG9yLWZpcmViYXNlJzogWydmaXJlYmFzZS9hcHAnLCAnZmlyZWJhc2UvbWVzc2FnaW5nJ10sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICBibG9nUGx1Z2luKCksXG4gICAgcmVhY3QoKSxcbiAgICBWaXRlUFdBKHtcbiAgICAgIHN0cmF0ZWdpZXM6IFwiaW5qZWN0TWFuaWZlc3RcIixcbiAgICAgIHNyY0RpcjogXCJzcmNcIixcbiAgICAgIGZpbGVuYW1lOiBcInN3LmpzXCIsXG4gICAgICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgaW5jbHVkZUFzc2V0czogW1wiZmF2aWNvbi5pY29cIiwgXCJsb2FkaW5nLnBuZ1wiLCBcImljb24tMTkyLnBuZ1wiLCBcImljb24tNTEyLnBuZ1wiLCBcImljb24tOTYucG5nXCIsIFwib2ZmbGluZS5odG1sXCJdLFxuICAgICAgbWFuaWZlc3Q6IHtcbiAgICAgICAgaWQ6IFwiLz9zb3VyY2U9cHdhXCIsXG4gICAgICAgIG5hbWU6IFwiU2Nob2xhcidzIENpcmNsZVwiLFxuICAgICAgICBzaG9ydF9uYW1lOiBcIlNjaG9sYXInc1wiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJTbWFydCBzdHVkeSBjb21wYW5pb24gZm9yIHVuaXZlcnNpdHkgc3R1ZGVudHMgXHUyMDE0IGxpdmUgY2xhc3NlcywgQUkgdHV0b3IsIGFzc2lnbm1lbnRzLCBhbmQgbW9yZS5cIixcbiAgICAgICAgdGhlbWVfY29sb3I6IFwiIzBBMEQxM1wiLFxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiMwQTBEMTNcIixcbiAgICAgICAgZGlzcGxheTogXCJzdGFuZGFsb25lXCIsXG4gICAgICAgIGRpc3BsYXlfb3ZlcnJpZGU6IFtcIndpbmRvdy1jb250cm9scy1vdmVybGF5XCIsIFwic3RhbmRhbG9uZVwiLCBcIm1pbmltYWwtdWlcIl0sXG4gICAgICAgIG9yaWVudGF0aW9uOiBcImFueVwiLFxuICAgICAgICBzdGFydF91cmw6IFwiLz9zb3VyY2U9cHdhXCIsXG4gICAgICAgIHNjb3BlOiBcIi9cIixcbiAgICAgICAgbGFuZzogXCJlblwiLFxuICAgICAgICBkaXI6IFwibHRyXCIsXG4gICAgICAgIGNhdGVnb3JpZXM6IFtcImVkdWNhdGlvblwiLCBcInByb2R1Y3Rpdml0eVwiLCBcInNvY2lhbFwiXSxcbiAgICAgICAgcHJlZmVyX3JlbGF0ZWRfYXBwbGljYXRpb25zOiBmYWxzZSxcbiAgICAgICAgaWNvbnM6IFtcbiAgICAgICAgICB7IHNyYzogXCIvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJhbnlcIiB9LFxuICAgICAgICAgIHsgc3JjOiBcIi9pY29uLTUxMi5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBwdXJwb3NlOiBcImFueVwiIH0sXG4gICAgICAgICAgeyBzcmM6IFwiL2ljb24tMTkyLW1hc2thYmxlLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIsIHB1cnBvc2U6IFwibWFza2FibGVcIiB9LFxuICAgICAgICAgIHsgc3JjOiBcIi9pY29uLTUxMi1tYXNrYWJsZS5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBwdXJwb3NlOiBcIm1hc2thYmxlXCIgfSxcbiAgICAgICAgXSxcbiAgICAgICAgc2NyZWVuc2hvdHM6IFtcbiAgICAgICAgICB7IHNyYzogXCIvbG9hZGluZy5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBmb3JtX2ZhY3RvcjogXCJ3aWRlXCIgfSxcbiAgICAgICAgICB7IHNyYzogXCIvbG9hZGluZy5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBmb3JtX2ZhY3RvcjogXCJuYXJyb3dcIiB9LFxuICAgICAgICBdLFxuICAgICAgICBzaG9ydGN1dHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBuYW1lOiBcIlRvZGF5J3MgUGxhblwiLFxuICAgICAgICAgICAgc2hvcnRfbmFtZTogXCJUb2RheVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiSnVtcCB0byB0b2RheSdzIHN0dWR5IHRhc2tzXCIsXG4gICAgICAgICAgICB1cmw6IFwiLz90YWI9dG9kYXlcIixcbiAgICAgICAgICAgIGljb25zOiBbeyBzcmM6IFwiL2ljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIgfV1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6IFwiQUkgVHV0b3JcIixcbiAgICAgICAgICAgIHNob3J0X25hbWU6IFwiVHV0b3JcIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkFzayB0aGUgQUkgdHV0b3IgYW55dGhpbmdcIixcbiAgICAgICAgICAgIHVybDogXCIvP3RhYj10dXRvclwiLFxuICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogXCIvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiB9XVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgbmFtZTogXCJMaXZlIENsYXNzZXNcIixcbiAgICAgICAgICAgIHNob3J0X25hbWU6IFwiTGl2ZVwiLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiSm9pbiBhbiBvbmdvaW5nIGxpdmUgY2xhc3NcIixcbiAgICAgICAgICAgIHVybDogXCIvP3RhYj1jbGFzc3Jvb21cIixcbiAgICAgICAgICAgIGljb25zOiBbeyBzcmM6IFwiL2ljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIgfV1cbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIG5hbWU6IFwiTWVzc2FnZXNcIixcbiAgICAgICAgICAgIHNob3J0X25hbWU6IFwiSW5ib3hcIixcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkRpcmVjdCBtZXNzYWdlcyB3aXRoIGxlY3R1cmVyc1wiLFxuICAgICAgICAgICAgdXJsOiBcIi8/dGFiPWxlY3R1cmVyc1wiLFxuICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogXCIvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiB9XVxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIGluamVjdE1hbmlmZXN0OiB7XG4gICAgICAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsc3ZnLHBuZyxpY28sd2VibWFuaWZlc3R9XCJdLFxuICAgICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNSAqIDEwMjQgKiAxMDI0LFxuICAgICAgfSxcbiAgICB9KSxcbiAgXSxcbn0pO1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxERUxMXFxcXERvd25sb2Fkc1xcXFxzY2hvbGFycy1jaXJjbGUtbWFpblxcXFxzcmNcXFxcYmxvZ1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcREVMTFxcXFxEb3dubG9hZHNcXFxcc2Nob2xhcnMtY2lyY2xlLW1haW5cXFxcc3JjXFxcXGJsb2dcXFxcYmxvZ1BsdWdpbi5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvREVMTC9Eb3dubG9hZHMvc2Nob2xhcnMtY2lyY2xlLW1haW4vc3JjL2Jsb2cvYmxvZ1BsdWdpbi5qc1wiO2ltcG9ydCBmcyBmcm9tICdmcyc7XG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcbmltcG9ydCBtYXR0ZXIgZnJvbSAnZ3JheS1tYXR0ZXInO1xuXG5jb25zdCBQT1NUU19ESVIgPSBwYXRoLnJlc29sdmUocHJvY2Vzcy5jd2QoKSwgJ3NyYy9ibG9nL3Bvc3RzJyk7XG5cbmZ1bmN0aW9uIGxvYWRQb3N0cygpIHtcbiAgaWYgKCFmcy5leGlzdHNTeW5jKFBPU1RTX0RJUikpIHJldHVybiBbXTtcbiAgY29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhQT1NUU19ESVIpLmZpbHRlcihmID0+IGYuZW5kc1dpdGgoJy5tZCcpKTtcbiAgcmV0dXJuIGZpbGVzLm1hcChmaWxlbmFtZSA9PiB7XG4gICAgY29uc3QgcmF3ID0gZnMucmVhZEZpbGVTeW5jKHBhdGguam9pbihQT1NUU19ESVIsIGZpbGVuYW1lKSwgJ3V0Zi04Jyk7XG4gICAgY29uc3QgeyBkYXRhOiBmcm9udG1hdHRlciwgY29udGVudCB9ID0gbWF0dGVyKHJhdyk7XG4gICAgY29uc3Qgc2x1ZyA9IGZpbGVuYW1lLnJlcGxhY2UoL1xcLm1kJC8sICcnKTtcbiAgICByZXR1cm4ge1xuICAgICAgc2x1ZyxcbiAgICAgIHRpdGxlOiBmcm9udG1hdHRlci50aXRsZSB8fCBzbHVnLFxuICAgICAgZGF0ZTogZnJvbnRtYXR0ZXIuZGF0ZSB8fCBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXSxcbiAgICAgIGV4Y2VycHQ6IGZyb250bWF0dGVyLmV4Y2VycHQgfHwgJycsXG4gICAgICB0YWdzOiBmcm9udG1hdHRlci50YWdzIHx8IFtdLFxuICAgICAgY29udGVudCxcbiAgICB9O1xuICB9KS5zb3J0KChhLCBiKSA9PiBuZXcgRGF0ZShiLmRhdGUpIC0gbmV3IERhdGUoYS5kYXRlKSk7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIGJsb2dQbHVnaW4oKSB7XG4gIGNvbnN0IHZpcnR1YWxJZCA9ICd2aXJ0dWFsOmJsb2ctcG9zdHMnO1xuICBjb25zdCByZXNvbHZlZElkID0gJ1xcMCcgKyB2aXJ0dWFsSWQ7XG5cbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAnYmxvZy1wb3N0cycsXG4gICAgcmVzb2x2ZUlkKGlkKSB7XG4gICAgICBpZiAoaWQgPT09IHZpcnR1YWxJZCkgcmV0dXJuIHJlc29sdmVkSWQ7XG4gICAgfSxcbiAgICBsb2FkKGlkKSB7XG4gICAgICBpZiAoaWQgPT09IHJlc29sdmVkSWQpIHtcbiAgICAgICAgY29uc3QgcG9zdHMgPSBsb2FkUG9zdHMoKTtcbiAgICAgICAgcmV0dXJuIGBleHBvcnQgZGVmYXVsdCAke0pTT04uc3RyaW5naWZ5KHBvc3RzKX1gO1xuICAgICAgfVxuICAgIH0sXG4gIH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQWdVLFNBQVMsb0JBQW9CO0FBQzdWLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7OztBQ0ZxVSxPQUFPLFFBQVE7QUFDNVcsT0FBTyxVQUFVO0FBQ2pCLE9BQU8sWUFBWTtBQUVuQixJQUFNLFlBQVksS0FBSyxRQUFRLFFBQVEsSUFBSSxHQUFHLGdCQUFnQjtBQUU5RCxTQUFTLFlBQVk7QUFDbkIsTUFBSSxDQUFDLEdBQUcsV0FBVyxTQUFTLEVBQUcsUUFBTyxDQUFDO0FBQ3ZDLFFBQU0sUUFBUSxHQUFHLFlBQVksU0FBUyxFQUFFLE9BQU8sT0FBSyxFQUFFLFNBQVMsS0FBSyxDQUFDO0FBQ3JFLFNBQU8sTUFBTSxJQUFJLGNBQVk7QUFDM0IsVUFBTSxNQUFNLEdBQUcsYUFBYSxLQUFLLEtBQUssV0FBVyxRQUFRLEdBQUcsT0FBTztBQUNuRSxVQUFNLEVBQUUsTUFBTSxhQUFhLFFBQVEsSUFBSSxPQUFPLEdBQUc7QUFDakQsVUFBTSxPQUFPLFNBQVMsUUFBUSxTQUFTLEVBQUU7QUFDekMsV0FBTztBQUFBLE1BQ0w7QUFBQSxNQUNBLE9BQU8sWUFBWSxTQUFTO0FBQUEsTUFDNUIsTUFBTSxZQUFZLFNBQVEsb0JBQUksS0FBSyxHQUFFLFlBQVksRUFBRSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQUEsTUFDL0QsU0FBUyxZQUFZLFdBQVc7QUFBQSxNQUNoQyxNQUFNLFlBQVksUUFBUSxDQUFDO0FBQUEsTUFDM0I7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
