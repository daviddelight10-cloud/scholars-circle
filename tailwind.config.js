/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme palette matching existing constants.js
        hub: {
          bg: "#0a0a0a",
          surface: "#141414",
          "surface-hover": "#1a1a1a",
          border: "#2a2a2a",
          "border-active": "#FFD700",
          text: "#e8e8e8",
          "text-muted": "#888888",
          "text-dim": "#555555",
          "text-bright": "#FFD700",
        },
        gold: {
          DEFAULT: "#FFD700",
          dim: "rgba(255,215,0,0.15)",
          border: "rgba(255,215,0,0.35)",
        },
        coral: {
          DEFAULT: "#ef4444",
          50: "rgba(239,68,68,0.08)",
          100: "rgba(239,68,68,0.12)",
          200: "rgba(239,68,68,0.20)",
          300: "rgba(239,68,68,0.30)",
          400: "#f87171",
          500: "#ef4444",
        },
        success: {
          bg: "#0f2a1a",
          border: "#2a6a3a",
          text: "#a5d6a7",
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
