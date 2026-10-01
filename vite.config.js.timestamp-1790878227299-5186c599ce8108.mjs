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
      ogImage: frontmatter.ogImage || null,
      readingTime: frontmatter.readingTime || null,
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
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js"
  },
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
        theme_color: "#0a0a0a",
        background_color: "#0a0a0a",
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
            description: "Chats with classmates",
            url: "/?tab=discuss&feedTab=chats",
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiLCAic3JjL2Jsb2cvYmxvZ1BsdWdpbi5qcyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXERFTExcXFxcRG93bmxvYWRzXFxcXHNjaG9sYXJzLWNpcmNsZS1tYWluXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxERUxMXFxcXERvd25sb2Fkc1xcXFxzY2hvbGFycy1jaXJjbGUtbWFpblxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvREVMTC9Eb3dubG9hZHMvc2Nob2xhcnMtY2lyY2xlLW1haW4vdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tIFwidml0ZS1wbHVnaW4tcHdhXCI7XHJcbmltcG9ydCBibG9nUGx1Z2luIGZyb20gXCIuL3NyYy9ibG9nL2Jsb2dQbHVnaW4uanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgdGVzdDoge1xyXG4gICAgZW52aXJvbm1lbnQ6IFwianNkb21cIixcclxuICAgIGdsb2JhbHM6IHRydWUsXHJcbiAgICBzZXR1cEZpbGVzOiBcIi4vc3JjL3Rlc3Qvc2V0dXAuanNcIixcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDYwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAndmVuZG9yLXJlYWN0JzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgJ3ZlbmRvci1zdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAndmVuZG9yLWljb25zJzogWydsdWNpZGUtcmVhY3QnXSxcclxuICAgICAgICAgICd2ZW5kb3ItZmlyZWJhc2UnOiBbJ2ZpcmViYXNlL2FwcCcsICdmaXJlYmFzZS9tZXNzYWdpbmcnXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIGJsb2dQbHVnaW4oKSxcclxuICAgIHJlYWN0KCksXHJcbiAgICBWaXRlUFdBKHtcclxuICAgICAgc3RyYXRlZ2llczogXCJpbmplY3RNYW5pZmVzdFwiLFxyXG4gICAgICBzcmNEaXI6IFwic3JjXCIsXHJcbiAgICAgIGZpbGVuYW1lOiBcInN3LmpzXCIsXHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogXCJhdXRvVXBkYXRlXCIsXHJcbiAgICAgIGluY2x1ZGVBc3NldHM6IFtcImZhdmljb24uaWNvXCIsIFwibG9hZGluZy5wbmdcIiwgXCJpY29uLTE5Mi5wbmdcIiwgXCJpY29uLTUxMi5wbmdcIiwgXCJpY29uLTk2LnBuZ1wiLCBcIm9mZmxpbmUuaHRtbFwiXSxcclxuICAgICAgbWFuaWZlc3Q6IHtcclxuICAgICAgICBpZDogXCIvP3NvdXJjZT1wd2FcIixcclxuICAgICAgICBuYW1lOiBcIlNjaG9sYXIncyBDaXJjbGVcIixcclxuICAgICAgICBzaG9ydF9uYW1lOiBcIlNjaG9sYXInc1wiLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiBcIlNtYXJ0IHN0dWR5IGNvbXBhbmlvbiBmb3IgdW5pdmVyc2l0eSBzdHVkZW50cyBcdTIwMTQgbGl2ZSBjbGFzc2VzLCBBSSB0dXRvciwgYXNzaWdubWVudHMsIGFuZCBtb3JlLlwiLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiBcIiMwYTBhMGFcIixcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiMwYTBhMGFcIixcclxuICAgICAgICBkaXNwbGF5OiBcInN0YW5kYWxvbmVcIixcclxuICAgICAgICBkaXNwbGF5X292ZXJyaWRlOiBbXCJ3aW5kb3ctY29udHJvbHMtb3ZlcmxheVwiLCBcInN0YW5kYWxvbmVcIiwgXCJtaW5pbWFsLXVpXCJdLFxyXG4gICAgICAgIG9yaWVudGF0aW9uOiBcImFueVwiLFxyXG4gICAgICAgIHN0YXJ0X3VybDogXCIvP3NvdXJjZT1wd2FcIixcclxuICAgICAgICBzY29wZTogXCIvXCIsXHJcbiAgICAgICAgbGFuZzogXCJlblwiLFxyXG4gICAgICAgIGRpcjogXCJsdHJcIixcclxuICAgICAgICBjYXRlZ29yaWVzOiBbXCJlZHVjYXRpb25cIiwgXCJwcm9kdWN0aXZpdHlcIiwgXCJzb2NpYWxcIl0sXHJcbiAgICAgICAgcHJlZmVyX3JlbGF0ZWRfYXBwbGljYXRpb25zOiBmYWxzZSxcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAgeyBzcmM6IFwiL2ljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIsIHR5cGU6IFwiaW1hZ2UvcG5nXCIsIHB1cnBvc2U6IFwiYW55XCIgfSxcclxuICAgICAgICAgIHsgc3JjOiBcIi9pY29uLTUxMi5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBwdXJwb3NlOiBcImFueVwiIH0sXHJcbiAgICAgICAgICB7IHNyYzogXCIvaWNvbi0xOTItbWFza2FibGUucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJtYXNrYWJsZVwiIH0sXHJcbiAgICAgICAgICB7IHNyYzogXCIvaWNvbi01MTItbWFza2FibGUucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgcHVycG9zZTogXCJtYXNrYWJsZVwiIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgICBzY3JlZW5zaG90czogW1xyXG4gICAgICAgICAgeyBzcmM6IFwiL2xvYWRpbmcucG5nXCIsIHNpemVzOiBcIjUxMng1MTJcIiwgdHlwZTogXCJpbWFnZS9wbmdcIiwgZm9ybV9mYWN0b3I6IFwid2lkZVwiIH0sXHJcbiAgICAgICAgICB7IHNyYzogXCIvbG9hZGluZy5wbmdcIiwgc2l6ZXM6IFwiNTEyeDUxMlwiLCB0eXBlOiBcImltYWdlL3BuZ1wiLCBmb3JtX2ZhY3RvcjogXCJuYXJyb3dcIiB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgICAgc2hvcnRjdXRzOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIG5hbWU6IFwiVG9kYXkncyBQbGFuXCIsXHJcbiAgICAgICAgICAgIHNob3J0X25hbWU6IFwiVG9kYXlcIixcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiSnVtcCB0byB0b2RheSdzIHN0dWR5IHRhc2tzXCIsXHJcbiAgICAgICAgICAgIHVybDogXCIvP3RhYj10b2RheVwiLFxyXG4gICAgICAgICAgICBpY29uczogW3sgc3JjOiBcIi9pY29uLTE5Mi5wbmdcIiwgc2l6ZXM6IFwiMTkyeDE5MlwiIH1dXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBuYW1lOiBcIkFJIFR1dG9yXCIsXHJcbiAgICAgICAgICAgIHNob3J0X25hbWU6IFwiVHV0b3JcIixcclxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQXNrIHRoZSBBSSB0dXRvciBhbnl0aGluZ1wiLFxyXG4gICAgICAgICAgICB1cmw6IFwiLz90YWI9dHV0b3JcIixcclxuICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogXCIvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiB9XVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbmFtZTogXCJMaXZlIENsYXNzZXNcIixcclxuICAgICAgICAgICAgc2hvcnRfbmFtZTogXCJMaXZlXCIsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkpvaW4gYW4gb25nb2luZyBsaXZlIGNsYXNzXCIsXHJcbiAgICAgICAgICAgIHVybDogXCIvP3RhYj1jbGFzc3Jvb21cIixcclxuICAgICAgICAgICAgaWNvbnM6IFt7IHNyYzogXCIvaWNvbi0xOTIucG5nXCIsIHNpemVzOiBcIjE5MngxOTJcIiB9XVxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgbmFtZTogXCJNZXNzYWdlc1wiLFxyXG4gICAgICAgICAgICBzaG9ydF9uYW1lOiBcIkluYm94XCIsXHJcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkNoYXRzIHdpdGggY2xhc3NtYXRlc1wiLFxyXG4gICAgICAgICAgICB1cmw6IFwiLz90YWI9ZGlzY3VzcyZmZWVkVGFiPWNoYXRzXCIsXHJcbiAgICAgICAgICAgIGljb25zOiBbeyBzcmM6IFwiL2ljb24tMTkyLnBuZ1wiLCBzaXplczogXCIxOTJ4MTkyXCIgfV1cclxuICAgICAgICAgIH1cclxuICAgICAgICBdXHJcbiAgICAgIH0sXHJcbiAgICAgIGluamVjdE1hbmlmZXN0OiB7XHJcbiAgICAgICAgZ2xvYlBhdHRlcm5zOiBbXCIqKi8qLntqcyxjc3MsaHRtbCxzdmcscG5nLGljbyx3ZWJtYW5pZmVzdH1cIl0sXHJcbiAgICAgICAgbWF4aW11bUZpbGVTaXplVG9DYWNoZUluQnl0ZXM6IDUgKiAxMDI0ICogMTAyNCxcclxuICAgICAgfSxcclxuICAgIH0pLFxyXG4gIF0sXHJcbn0pO1xyXG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIkM6XFxcXFVzZXJzXFxcXERFTExcXFxcRG93bmxvYWRzXFxcXHNjaG9sYXJzLWNpcmNsZS1tYWluXFxcXHNyY1xcXFxibG9nXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxERUxMXFxcXERvd25sb2Fkc1xcXFxzY2hvbGFycy1jaXJjbGUtbWFpblxcXFxzcmNcXFxcYmxvZ1xcXFxibG9nUGx1Z2luLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9ERUxML0Rvd25sb2Fkcy9zY2hvbGFycy1jaXJjbGUtbWFpbi9zcmMvYmxvZy9ibG9nUGx1Z2luLmpzXCI7aW1wb3J0IGZzIGZyb20gJ2ZzJztcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IG1hdHRlciBmcm9tICdncmF5LW1hdHRlcic7XG5cbmNvbnN0IFBPU1RTX0RJUiA9IHBhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAnc3JjL2Jsb2cvcG9zdHMnKTtcblxuZnVuY3Rpb24gbG9hZFBvc3RzKCkge1xuICBpZiAoIWZzLmV4aXN0c1N5bmMoUE9TVFNfRElSKSkgcmV0dXJuIFtdO1xuICBjb25zdCBmaWxlcyA9IGZzLnJlYWRkaXJTeW5jKFBPU1RTX0RJUikuZmlsdGVyKGYgPT4gZi5lbmRzV2l0aCgnLm1kJykpO1xuICByZXR1cm4gZmlsZXMubWFwKGZpbGVuYW1lID0+IHtcbiAgICBjb25zdCByYXcgPSBmcy5yZWFkRmlsZVN5bmMocGF0aC5qb2luKFBPU1RTX0RJUiwgZmlsZW5hbWUpLCAndXRmLTgnKTtcbiAgICBjb25zdCB7IGRhdGE6IGZyb250bWF0dGVyLCBjb250ZW50IH0gPSBtYXR0ZXIocmF3KTtcbiAgICBjb25zdCBzbHVnID0gZmlsZW5hbWUucmVwbGFjZSgvXFwubWQkLywgJycpO1xuICAgIHJldHVybiB7XG4gICAgICBzbHVnLFxuICAgICAgdGl0bGU6IGZyb250bWF0dGVyLnRpdGxlIHx8IHNsdWcsXG4gICAgICBkYXRlOiBmcm9udG1hdHRlci5kYXRlIHx8IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKS5zcGxpdCgnVCcpWzBdLFxuICAgICAgZXhjZXJwdDogZnJvbnRtYXR0ZXIuZXhjZXJwdCB8fCAnJyxcbiAgICAgIHRhZ3M6IGZyb250bWF0dGVyLnRhZ3MgfHwgW10sXG4gICAgICBvZ0ltYWdlOiBmcm9udG1hdHRlci5vZ0ltYWdlIHx8IG51bGwsXG4gICAgICByZWFkaW5nVGltZTogZnJvbnRtYXR0ZXIucmVhZGluZ1RpbWUgfHwgbnVsbCxcbiAgICAgIGNvbnRlbnQsXG4gICAgfTtcbiAgfSkuc29ydCgoYSwgYikgPT4gbmV3IERhdGUoYi5kYXRlKSAtIG5ldyBEYXRlKGEuZGF0ZSkpO1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbiBibG9nUGx1Z2luKCkge1xuICBjb25zdCB2aXJ0dWFsSWQgPSAndmlydHVhbDpibG9nLXBvc3RzJztcbiAgY29uc3QgcmVzb2x2ZWRJZCA9ICdcXDAnICsgdmlydHVhbElkO1xuXG4gIHJldHVybiB7XG4gICAgbmFtZTogJ2Jsb2ctcG9zdHMnLFxuICAgIHJlc29sdmVJZChpZCkge1xuICAgICAgaWYgKGlkID09PSB2aXJ0dWFsSWQpIHJldHVybiByZXNvbHZlZElkO1xuICAgIH0sXG4gICAgbG9hZChpZCkge1xuICAgICAgaWYgKGlkID09PSByZXNvbHZlZElkKSB7XG4gICAgICAgIGNvbnN0IHBvc3RzID0gbG9hZFBvc3RzKCk7XG4gICAgICAgIHJldHVybiBgZXhwb3J0IGRlZmF1bHQgJHtKU09OLnN0cmluZ2lmeShwb3N0cyl9YDtcbiAgICAgIH1cbiAgICB9LFxuICB9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFnVSxTQUFTLG9CQUFvQjtBQUM3VixPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlOzs7QUNGcVUsT0FBTyxRQUFRO0FBQzVXLE9BQU8sVUFBVTtBQUNqQixPQUFPLFlBQVk7QUFFbkIsSUFBTSxZQUFZLEtBQUssUUFBUSxRQUFRLElBQUksR0FBRyxnQkFBZ0I7QUFFOUQsU0FBUyxZQUFZO0FBQ25CLE1BQUksQ0FBQyxHQUFHLFdBQVcsU0FBUyxFQUFHLFFBQU8sQ0FBQztBQUN2QyxRQUFNLFFBQVEsR0FBRyxZQUFZLFNBQVMsRUFBRSxPQUFPLE9BQUssRUFBRSxTQUFTLEtBQUssQ0FBQztBQUNyRSxTQUFPLE1BQU0sSUFBSSxjQUFZO0FBQzNCLFVBQU0sTUFBTSxHQUFHLGFBQWEsS0FBSyxLQUFLLFdBQVcsUUFBUSxHQUFHLE9BQU87QUFDbkUsVUFBTSxFQUFFLE1BQU0sYUFBYSxRQUFRLElBQUksT0FBTyxHQUFHO0FBQ2pELFVBQU0sT0FBTyxTQUFTLFFBQVEsU0FBUyxFQUFFO0FBQ3pDLFdBQU87QUFBQSxNQUNMO0FBQUEsTUFDQSxPQUFPLFlBQVksU0FBUztBQUFBLE1BQzVCLE1BQU0sWUFBWSxTQUFRLG9CQUFJLEtBQUssR0FBRSxZQUFZLEVBQUUsTUFBTSxHQUFHLEVBQUUsQ0FBQztBQUFBLE1BQy9ELFNBQVMsWUFBWSxXQUFXO0FBQUEsTUFDaEMsTUFBTSxZQUFZLFFBQVEsQ0FBQztBQUFBLE1BQzNCLFNBQVMsWUFBWSxXQUFXO0FBQUEsTUFDaEMsYUFBYSxZQUFZLGVBQWU7QUFBQSxNQUN4QztBQUFBLElBQ0Y7QUFBQSxFQUNGLENBQUMsRUFBRSxLQUFLLENBQUMsR0FBRyxNQUFNLElBQUksS0FBSyxFQUFFLElBQUksSUFBSSxJQUFJLEtBQUssRUFBRSxJQUFJLENBQUM7QUFDdkQ7QUFFZSxTQUFSLGFBQThCO0FBQ25DLFFBQU0sWUFBWTtBQUNsQixRQUFNLGFBQWEsT0FBTztBQUUxQixTQUFPO0FBQUEsSUFDTCxNQUFNO0FBQUEsSUFDTixVQUFVLElBQUk7QUFDWixVQUFJLE9BQU8sVUFBVyxRQUFPO0FBQUEsSUFDL0I7QUFBQSxJQUNBLEtBQUssSUFBSTtBQUNQLFVBQUksT0FBTyxZQUFZO0FBQ3JCLGNBQU0sUUFBUSxVQUFVO0FBQ3hCLGVBQU8sa0JBQWtCLEtBQUssVUFBVSxLQUFLLENBQUM7QUFBQSxNQUNoRDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0Y7OztBRHJDQSxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsSUFDSixhQUFhO0FBQUEsSUFDYixTQUFTO0FBQUEsSUFDVCxZQUFZO0FBQUEsRUFDZDtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsdUJBQXVCO0FBQUEsSUFDdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osZ0JBQWdCLENBQUMsU0FBUyxhQUFhLGtCQUFrQjtBQUFBLFVBQ3pELG1CQUFtQixDQUFDLHVCQUF1QjtBQUFBLFVBQzNDLGdCQUFnQixDQUFDLGNBQWM7QUFBQSxVQUMvQixtQkFBbUIsQ0FBQyxnQkFBZ0Isb0JBQW9CO0FBQUEsUUFDMUQ7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLFdBQVc7QUFBQSxJQUNYLE1BQU07QUFBQSxJQUNOLFFBQVE7QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaLFFBQVE7QUFBQSxNQUNSLFVBQVU7QUFBQSxNQUNWLGNBQWM7QUFBQSxNQUNkLGVBQWUsQ0FBQyxlQUFlLGVBQWUsZ0JBQWdCLGdCQUFnQixlQUFlLGNBQWM7QUFBQSxNQUMzRyxVQUFVO0FBQUEsUUFDUixJQUFJO0FBQUEsUUFDSixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixhQUFhO0FBQUEsUUFDYixhQUFhO0FBQUEsUUFDYixrQkFBa0I7QUFBQSxRQUNsQixTQUFTO0FBQUEsUUFDVCxrQkFBa0IsQ0FBQywyQkFBMkIsY0FBYyxZQUFZO0FBQUEsUUFDeEUsYUFBYTtBQUFBLFFBQ2IsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFFBQ1AsTUFBTTtBQUFBLFFBQ04sS0FBSztBQUFBLFFBQ0wsWUFBWSxDQUFDLGFBQWEsZ0JBQWdCLFFBQVE7QUFBQSxRQUNsRCw2QkFBNkI7QUFBQSxRQUM3QixPQUFPO0FBQUEsVUFDTCxFQUFFLEtBQUssaUJBQWlCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxNQUFNO0FBQUEsVUFDNUUsRUFBRSxLQUFLLGlCQUFpQixPQUFPLFdBQVcsTUFBTSxhQUFhLFNBQVMsTUFBTTtBQUFBLFVBQzVFLEVBQUUsS0FBSywwQkFBMEIsT0FBTyxXQUFXLE1BQU0sYUFBYSxTQUFTLFdBQVc7QUFBQSxVQUMxRixFQUFFLEtBQUssMEJBQTBCLE9BQU8sV0FBVyxNQUFNLGFBQWEsU0FBUyxXQUFXO0FBQUEsUUFDNUY7QUFBQSxRQUNBLGFBQWE7QUFBQSxVQUNYLEVBQUUsS0FBSyxnQkFBZ0IsT0FBTyxXQUFXLE1BQU0sYUFBYSxhQUFhLE9BQU87QUFBQSxVQUNoRixFQUFFLEtBQUssZ0JBQWdCLE9BQU8sV0FBVyxNQUFNLGFBQWEsYUFBYSxTQUFTO0FBQUEsUUFDcEY7QUFBQSxRQUNBLFdBQVc7QUFBQSxVQUNUO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTixZQUFZO0FBQUEsWUFDWixhQUFhO0FBQUEsWUFDYixLQUFLO0FBQUEsWUFDTCxPQUFPLENBQUMsRUFBRSxLQUFLLGlCQUFpQixPQUFPLFVBQVUsQ0FBQztBQUFBLFVBQ3BEO0FBQUEsVUFDQTtBQUFBLFlBQ0UsTUFBTTtBQUFBLFlBQ04sWUFBWTtBQUFBLFlBQ1osYUFBYTtBQUFBLFlBQ2IsS0FBSztBQUFBLFlBQ0wsT0FBTyxDQUFDLEVBQUUsS0FBSyxpQkFBaUIsT0FBTyxVQUFVLENBQUM7QUFBQSxVQUNwRDtBQUFBLFVBQ0E7QUFBQSxZQUNFLE1BQU07QUFBQSxZQUNOLFlBQVk7QUFBQSxZQUNaLGFBQWE7QUFBQSxZQUNiLEtBQUs7QUFBQSxZQUNMLE9BQU8sQ0FBQyxFQUFFLEtBQUssaUJBQWlCLE9BQU8sVUFBVSxDQUFDO0FBQUEsVUFDcEQ7QUFBQSxVQUNBO0FBQUEsWUFDRSxNQUFNO0FBQUEsWUFDTixZQUFZO0FBQUEsWUFDWixhQUFhO0FBQUEsWUFDYixLQUFLO0FBQUEsWUFDTCxPQUFPLENBQUMsRUFBRSxLQUFLLGlCQUFpQixPQUFPLFVBQVUsQ0FBQztBQUFBLFVBQ3BEO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxNQUNBLGdCQUFnQjtBQUFBLFFBQ2QsY0FBYyxDQUFDLDRDQUE0QztBQUFBLFFBQzNELCtCQUErQixJQUFJLE9BQU87QUFBQSxNQUM1QztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
