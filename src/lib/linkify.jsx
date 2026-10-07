// Render plain text with URLs as clickable links (new tab, safe rel).
// Returns an array of strings and <a> elements for JSX interpolation.
const URL_RE = /(https?:\/\/[^\s<>"'`]+)/g;
// In-app deep links — opening these in a new tab strands the user outside
// the app shell and breaks back-navigation.
const INTERNAL_RE = /^\/(resources|folders|live)\//;

export function linkify(text) {
  if (!text) return null;
  const parts = String(text).split(URL_RE);
  return parts.map((part, i) => {
    if (i % 2 !== 1) return part;
    let internal = null;
    try {
      const u = new URL(part);
      if (u.origin === window.location.origin && INTERNAL_RE.test(u.pathname)) {
        internal = u.pathname + u.search + u.hash;
      }
    } catch {}
    return (
      <a
        key={i}
        href={internal || part}
        {...(internal ? {} : { target: "_blank", rel: "noopener noreferrer" })}
        style={{ color: "inherit", textDecoration: "underline", wordBreak: "break-all" }}
        onClick={(e) => {
          e.stopPropagation();
          if (internal) {
            e.preventDefault();
            // pushState + popstate — BrowserRouter listens to popstate, so
            // this routes in place and keeps real history for Back to pop.
            window.history.pushState({}, "", internal);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }
        }}
      >
        {part}
      </a>
    );
  });
}
