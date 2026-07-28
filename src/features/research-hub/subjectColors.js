const SUBJECT_COLORS = {
  anatomy: { accent: "#f59e0b", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.30)", text: "#fbbf24", icon: "🦴" },
  biochemistry: { accent: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)", text: "#4ade80", icon: "🧪" },
  biology: { accent: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)", text: "#4ade80", icon: "🧬" },
  bio: { accent: "#22c55e", bg: "rgba(34,197,94,0.10)", border: "rgba(34,197,94,0.30)", text: "#4ade80", icon: "🧬" },
  chemistry: { accent: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.30)", text: "#fb923c", icon: "⚗️" },
  chm: { accent: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.30)", text: "#fb923c", icon: "⚗️" },
  physiology: { accent: "#ec4899", bg: "rgba(236,72,153,0.10)", border: "rgba(236,72,153,0.30)", text: "#f472b6", icon: "🫀" },
  pharmacology: { accent: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.30)", text: "#a78bfa", icon: "💊" },
  pharmacy: { accent: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.30)", text: "#a78bfa", icon: "💊" },
  pathology: { accent: "#ef4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.30)", text: "#f87171", icon: "🔬" },
  medicine: { accent: "#FFD700", bg: "rgba(255,215,0,0.10)", border: "rgba(255,215,0,0.30)", text: "#FFD700", icon: "⚕️" },
  med: { accent: "#FFD700", bg: "rgba(255,215,0,0.10)", border: "rgba(255,215,0,0.30)", text: "#FFD700", icon: "⚕️" },
  nursing: { accent: "#06b6d4", bg: "rgba(6,182,212,0.10)", border: "rgba(6,182,212,0.30)", text: "#22d3ee", icon: "💉" },
  surgery: { accent: "#f43f5e", bg: "rgba(244,63,94,0.10)", border: "rgba(244,63,94,0.30)", text: "#fb7185", icon: "🔪" },
  microbiology: { accent: "#84cc16", bg: "rgba(132,204,22,0.10)", border: "rgba(132,204,22,0.30)", text: "#a3e635", icon: "🦠" },
  radiography: { accent: "#818cf8", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.30)", text: "#818cf8", icon: "📡" },
  dentistry: { accent: "#06b6d4", bg: "rgba(6,182,212,0.10)", border: "rgba(6,182,212,0.30)", text: "#22d3ee", icon: "🦷" },
  paediatrics: { accent: "#f472b6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.30)", text: "#f472b6", icon: "👶" },
  dermatology: { accent: "#fb923c", bg: "rgba(251,146,60,0.10)", border: "rgba(251,146,60,0.30)", text: "#fb923c", icon: "🧴" },
  physiotherapy: { accent: "#22d3ee", bg: "rgba(34,211,238,0.10)", border: "rgba(34,211,238,0.30)", text: "#22d3ee", icon: "💪" },
  physics: { accent: "#818cf8", bg: "rgba(129,140,248,0.10)", border: "rgba(129,140,248,0.30)", text: "#818cf8", icon: "🔭" },
  math: { accent: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.30)", text: "#a78bfa", icon: "📐" },
  statistics: { accent: "#60a5fa", bg: "rgba(96,165,250,0.10)", border: "rgba(96,165,250,0.30)", text: "#60a5fa", icon: "📊" },
  english: { accent: "#fbbf24", bg: "rgba(251,191,36,0.10)", border: "rgba(251,191,36,0.30)", text: "#fbbf24", icon: "📖" },
  psychology: { accent: "#c084fc", bg: "rgba(192,132,252,0.10)", border: "rgba(192,132,252,0.30)", text: "#c084fc", icon: "🧠" },
};

const DEFAULT_COLOR = { accent: "#FFD700", bg: "rgba(255,215,0,0.10)", border: "rgba(255,215,0,0.30)", text: "#FFD700", icon: "📚" };

export function getSubjectColor(subject) {
  if (!subject) return DEFAULT_COLOR;
  const lower = String(subject).toLowerCase();
  for (const key of Object.keys(SUBJECT_COLORS)) {
    if (lower.includes(key)) return SUBJECT_COLORS[key];
  }
  return DEFAULT_COLOR;
}

export function getSubjectIcon(subject) {
  return getSubjectColor(subject).icon;
}

export { DEFAULT_COLOR, SUBJECT_COLORS };
