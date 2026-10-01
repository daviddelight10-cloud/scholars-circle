export const VOICE_STATES = {
  IDLE: "idle",
  CONNECTING: "connecting",
  READY: "ready",
  LISTENING: "listening",
  SPEAKING: "speaking",
  THINKING: "thinking",
  ERROR: "error",
  ENDED: "ended",
};

export const VOICE_OPTIONS = [
  { name: "Achird", desc: "Friendly" },
  { name: "Sulafat", desc: "Warm" },
  { name: "Aoede", desc: "Breezy" },
  { name: "Leda", desc: "Youthful" },
  { name: "Puck", desc: "Upbeat" },
];

export const AUDIO_CONFIG = {
  sampleRate: 16000,
  playbackSampleRate: 24000,
  channels: 1,
  sampleSize: 16,
  mimeType: "audio/pcm;rate=16000",
};

export const SESSION_TIMEOUT_SEC = 10 * 60;

export const COLORS = {
  ink: "#050505",
  inkLight: "#0d0d0d",
  inkLighter: "#121212",
  border: "rgba(255,255,255,0.08)",
  borderLight: "rgba(255,255,255,0.12)",
  electric: "#4F8EF7",
  electricDim: "#2d4a99",
  electricGlow: "rgba(79,142,247,0.35)",
  electricLight: "#7DAAFF",
  gold: "#F5A623",
  goldDim: "#8a6d2e",
  coral: "#FF5470",
  green: "#3DD68C",
  greenDim: "#2a8a85",
  text: "#F5F7FB",
  textDim: "#9AA2B2",
  textFaint: "#565E6E",
  surface: "#0d0d0d",
  surfaceLight: "rgba(255,255,255,0.055)",
};

export const FONTS = {
  display: "'Syne', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const VAD_CONFIG = {
  speechThreshold: 0.025,
  speechOnsetMs: 80,
  silenceOffsetMs: 700,
};

export const BUFFER_CONFIG = {
  initialChunks: 3,
  minChunks: 2,
  maxChunks: 6,
  rebufferChunks: 2,
  jitterEvalInterval: 10,
  maxBufferedBytes: 96 * 1024,
};

export const RECONNECT_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 4000,
  pingIntervalMs: 10000,
  pongTimeoutMs: 5000,
  gracePeriodMs: 30000,
};

export function hexToRgba(hex, alpha) {
  if (!hex) return "transparent";
  if (hex.startsWith("rgba")) return hex;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
export const WS_MESSAGE_TYPES = {
  AUDIO: "audio",
  TEXT: "text",
  INTERRUPT: "interrupt",
  PAGE_CHANGE: "page_change",
  SETUP_COMPLETE: "setup_complete",
  SERVER_CONTENT: "server_content",
  TOOL_CALL: "tool_call",
  SESSION_ENDED: "session_ended",
  SESSION_TIMEOUT: "session_timeout",
  ERROR: "error",
  PING: "ping",
  PONG: "pong",
};
