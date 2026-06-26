export const T = {
  ink: "#0A0D13",
  inkSoft: "#11151E",
  inkCard: "#151A24",
  inkCard2: "#191F2C",
  line: "rgba(255,255,255,0.09)",
  lineStrong: "rgba(255,255,255,0.16)",
  text: "#EDEFF5",
  textDim: "#9AA3B5",
  textFaint: "#646E84",
  blue: "#4F8EF7",
  blueDim: "rgba(79,142,247,0.14)",
  gold: "#F5A623",
  goldDim: "rgba(245,166,35,0.14)",
  coral: "#FF5470",
  coralDim: "rgba(255,84,112,0.14)",
  green: "#3DD68C",
  greenDim: "rgba(61,214,140,0.14)",
};

export const FONTS = {
  display: "'Syne', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const RADIUS = {
  lg: "18px",
  sm: "12px",
};

const SUBJECT_COLORS = ["#4F8EF7", "#F5A623", "#3DD68C", "#FF5470"];

export function subjectColor(subject) {
  if (!subject) return SUBJECT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}
