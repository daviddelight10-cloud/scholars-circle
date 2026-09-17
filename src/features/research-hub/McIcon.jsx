import { memo } from "react";

// Icon set copied from the "My Circle — Revised Layout" prototype (SVG sprite).
const ICONS = {
  search: { viewBox: "0 0 24 24", paths: ['<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'], stroke: 2 },
  folder: { viewBox: "0 0 24 24", paths: ['<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>'], stroke: 2 },
  books: { viewBox: "0 0 24 24", paths: ['<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'], stroke: 2 },
  link: { viewBox: "0 0 24 24", paths: ['<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'], stroke: 2 },
  lock: { viewBox: "0 0 24 24", paths: ['<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'], stroke: 2 },
  star: { viewBox: "0 0 24 24", paths: ['<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'], stroke: 2 },
  bookmark: { viewBox: "0 0 24 24", paths: ['<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>'], stroke: 2 },
  chev: { viewBox: "0 0 24 24", paths: ['<path d="m6 9 6 6 6-6"/>'], stroke: 2 },
  "chev-r": { viewBox: "0 0 24 24", paths: ['<path d="m9 6 6 6-6 6"/>'], stroke: 2.5 },
  plus: { viewBox: "0 0 24 24", paths: ['<path d="M12 5v14M5 12h14"/>'], stroke: 2.5 },
  x: { viewBox: "0 0 24 24", paths: ['<path d="M18 6 6 18M6 6l12 12"/>'], stroke: 2.5 },
  globe: { viewBox: "0 0 24 24", paths: ['<circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'], stroke: 2 },
  flame: { viewBox: "0 0 24 24", paths: ['<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>'], stroke: 2 },
  grad: { viewBox: "0 0 24 24", paths: ['<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>'], stroke: 2 },
  user: { viewBox: "0 0 24 24", paths: ['<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'], stroke: 2 },
  grid: { viewBox: "0 0 24 24", paths: ['<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'], stroke: 2 },
  list: { viewBox: "0 0 24 24", paths: ['<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'], stroke: 2 },
  filetext: { viewBox: "0 0 24 24", paths: ['<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>'], stroke: 2 },
  eye: { viewBox: "0 0 24 24", paths: ['<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'], stroke: 2 },
  play: { viewBox: "0 0 24 24", paths: ['<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>'], stroke: 0 },
  check: { viewBox: "0 0 24 24", paths: ['<polyline points="20 6 9 17 4 12"/>'], stroke: 2.5 },
  verify: { viewBox: "0 0 24 24", paths: ['<polyline points="20 6 9 17 4 12"/>'], stroke: 4 },
  landmark: { viewBox: "0 0 24 24", paths: ['<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>'], stroke: 2 },
  share: { viewBox: "0 0 24 24", paths: ['<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>'], stroke: 2 },
  trash: { viewBox: "0 0 24 24", paths: ['<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>'], stroke: 2 },
  flag: { viewBox: "0 0 24 24", paths: ['<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>'], stroke: 2 },
  more: { viewBox: "0 0 24 24", paths: ['<g fill="currentColor"><circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/></g>'], stroke: 0 },
};

// Filled variants (star / bookmark)
const FILLED = {
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor" stroke="currentColor"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" fill="currentColor" stroke="currentColor"/>',
};

export default memo(function McIcon({ name, filled = false, size, className = "mc-ic", style }) {
  const icon = ICONS[name];
  if (!icon) return null;
  const body = filled && FILLED[name] ? FILLED[name] : icon.paths.join("");
  return (
    <svg
      className={className}
      style={size ? { width: size, height: size, ...style } : style}
      viewBox={icon.viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={icon.stroke || 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
});
