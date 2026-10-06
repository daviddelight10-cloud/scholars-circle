// Stroke icon set for My Space–style file rows (sp-row).
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };

export const IC = {
  file: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2" /><path d="M9 13h6" /><path d="M9 17h6" />
    </svg>
  ),
  check: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M5 12l5 5l10 -10" />
    </svg>
  ),
  eye: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <circle cx="12" cy="12" r="2" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" />
    </svg>
  ),
  pencil: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M4 20h4l10.5 -10.5a2.828 2.828 0 1 0 -4 -4l-10.5 10.5v4" /><path d="M13.5 6.5l4 4" />
    </svg>
  ),
  cards: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <rect x="3" y="8" width="12" height="13" rx="2" /><path d="M8 4h9a2 2 0 0 1 2 2v11" />
    </svg>
  ),
  notes: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 7h6" /><path d="M9 11h6" /><path d="M9 15h4" />
    </svg>
  ),
  dots: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
    </svg>
  ),
  bookmark: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M18 7v14l-6 -4l-6 4v-14a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4" />
    </svg>
  ),
  share: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1 -1v-7" /><path d="M16 6l-4 -4l-4 4" /><path d="M12 2v14" />
    </svg>
  ),
  trash: (
    <svg className="sp-ic" viewBox="0 0 24 24" width="1em" height="1em" {...stroke} aria-hidden="true">
      <path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" />
    </svg>
  ),
};
