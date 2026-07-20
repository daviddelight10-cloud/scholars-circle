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

export const VOICE_MODES = {
  teach: { label: "Teach", icon: "📚", desc: "Learn concepts from your document" },
  quiz: { label: "Quiz", icon: "🎯", desc: "Test your knowledge with questions" },
  discuss: { label: "Discuss", icon: "💬", desc: "Explore topics conversationally" },
};

export const AUDIO_CONFIG = {
  sampleRate: 16000,
  channels: 1,
  sampleSize: 16,
  mimeType: "audio/pcm;rate=16000",
};

export const SESSION_TIMEOUT_SEC = 10 * 60;

export const COLORS = {
  ink: "#0a0a0f",
  inkLight: "#12121a",
  inkLighter: "#1a1a26",
  border: "#22222e",
  borderLight: "#2a2a38",
  electric: "#4f7cff",
  electricDim: "#2d4a99",
  electricGlow: "rgba(79, 124, 255, 0.35)",
  gold: "#ffc857",
  goldDim: "#8a6d2e",
  coral: "#ff6b6b",
  green: "#4ecdc4",
  greenDim: "#2a8a85",
  text: "#e8e8f0",
  textDim: "#8888a0",
  textFaint: "#55556a",
  surface: "#0f0f16",
  surfaceLight: "#16161f",
};

export const FONTS = {
  display: "'Manrope', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const VAD_CONFIG = {
  speechThreshold: 0.025,
  speechOnsetMs: 100,
  silenceOffsetMs: 1200,
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
  SETUP_COMPLETE: "setup_complete",
  SERVER_CONTENT: "server_content",
  TOOL_CALL: "tool_call",
  SESSION_ENDED: "session_ended",
  SESSION_TIMEOUT: "session_timeout",
  ERROR: "error",
};
