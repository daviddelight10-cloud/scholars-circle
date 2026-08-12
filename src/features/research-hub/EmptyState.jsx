const ILLUSTRATIONS = {
  "📭": (
    <svg viewBox="0 0 120 120" fill="none" className="empty-illustration">
      <rect x="20" y="40" width="80" height="55" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <path d="M20 46 L60 76 L100 46" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <rect x="50" y="70" width="20" height="14" rx="2" fill="currentColor" opacity="0.15" />
    </svg>
  ),
  "📁": (
    <svg viewBox="0 0 120 120" fill="none" className="empty-illustration">
      <path d="M30 38 L48 38 L54 30 L90 30 L90 82 L30 82 Z" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <rect x="30" y="44" width="60" height="38" rx="4" fill="currentColor" opacity="0.08" />
    </svg>
  ),
  "📄": (
    <svg viewBox="0 0 120 120" fill="none" className="empty-illustration">
      <path d="M35 25 L75 25 L85 35 L85 95 L35 95 Z" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <path d="M75 25 L75 35 L85 35" stroke="currentColor" strokeWidth="2" opacity="0.3" />
      <line x1="42" y1="50" x2="70" y2="50" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="42" y1="60" x2="78" y2="60" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="42" y1="70" x2="65" y2="70" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    </svg>
  ),
  "📝": (
    <svg viewBox="0 0 120 120" fill="none" className="empty-illustration">
      <rect x="30" y="25" width="50" height="70" rx="4" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <line x1="38" y1="40" x2="72" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="38" y1="52" x2="72" y2="52" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <line x1="38" y1="64" x2="60" y2="64" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path d="M82 80 L92 90 L82 100" stroke="currentColor" strokeWidth="2" opacity="0.3" strokeLinecap="round" />
    </svg>
  ),
  "🎴": (
    <svg viewBox="0 0 120 120" fill="none" className="empty-illustration">
      <rect x="30" y="35" width="40" height="55" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.4" transform="rotate(-8 50 62)" />
      <rect x="50" y="30" width="40" height="55" rx="6" stroke="currentColor" strokeWidth="2" opacity="0.3" transform="rotate(8 70 57)" />
    </svg>
  ),
  "📚": (
    <svg viewBox="0 0 120 120" fill="none" className="empty-illustration">
      <rect x="25" y="35" width="25" height="55" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.35" />
      <rect x="52" y="30" width="25" height="60" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <rect x="79" y="38" width="20" height="52" rx="2" stroke="currentColor" strokeWidth="2" opacity="0.3" />
    </svg>
  ),
  "🔍": (
    <svg viewBox="0 0 120 120" fill="none" className="empty-illustration">
      <circle cx="50" cy="50" r="22" stroke="currentColor" strokeWidth="2.5" opacity="0.4" />
      <line x1="66" y1="66" x2="85" y2="85" stroke="currentColor" strokeWidth="3" opacity="0.4" strokeLinecap="round" />
      <circle cx="50" cy="50" r="10" fill="currentColor" opacity="0.06" />
    </svg>
  ),
};

export default function EmptyState({ icon = "📭", title, message, action, size = "md" }) {
  const iconSize = size === "lg" ? "text-6xl mb-6" : "text-4xl mb-2";
  const titleClass = size === "lg"
    ? "mb-2 text-xl font-extrabold text-hub-text-muted"
    : "mb-1 text-sm font-bold text-hub-text-muted";
  const illustration = ILLUSTRATIONS[icon];

  return (
    <div className="px-5 py-16 text-center">
      {illustration || <div className={iconSize}>{icon}</div>}
      {title && <div className={titleClass}>{title}</div>}
      {message && (
        <div className="mx-auto max-w-md text-[13px] leading-relaxed text-hub-text-dim">{message}</div>
      )}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
