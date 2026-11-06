/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Theme tokens — resolve through the --app-* vars defined in
        // styles.css (:root dark defaults, html[data-theme="light"] overrides)
        hub: {
          bg: "var(--app-bg)",
          surface: "var(--app-surface)",
          "surface-95": "color-mix(in srgb, var(--app-surface) 95%, transparent)",
          "surface-hover": "var(--app-surface-hover)",
          border: "var(--app-border)",
          "border-active": "var(--app-accent)",
          text: "var(--app-text)",
          "text-muted": "var(--app-dim)",
          "text-dim": "var(--app-faint)",
          "text-bright": "var(--app-accent)",
        },
        gold: {
          DEFAULT: "var(--app-accent)",
          fill: "var(--app-accent-fill)",
          dim: "var(--app-accent-soft)",
          border: "var(--app-accent-line)",
        },
        coral: {
          DEFAULT: "var(--app-red)",
          50: "rgba(239,68,68,0.08)",
          100: "rgba(239,68,68,0.12)",
          200: "rgba(239,68,68,0.20)",
          300: "rgba(239,68,68,0.30)",
          400: "#f87171",
          500: "var(--app-red)",
        },
        success: {
          bg: "var(--app-success-bg)",
          border: "var(--app-success-border)",
          text: "var(--app-success-text)",
        },
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      animation: {
        "stagger-in": "stagger-in 0.3s ease both",
        "due-pulse": "due-pulse 2s ease-in-out infinite",
        "modal-in": "modal-in 0.2s ease both",
        "fade-up": "fade-up 0.2s ease both",
      },
      keyframes: {
        "stagger-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "due-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateX(-50%) translateY(8px)" },
          "100%": { opacity: "1", transform: "translateX(-50%) translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
