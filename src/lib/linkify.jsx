// Render plain text with URLs as clickable links (new tab, safe rel).
// Returns an array of strings and <a> elements for JSX interpolation.
const URL_RE = /(https?:\/\/[^\s<>"'`]+)/g;

export function linkify(text) {
  if (!text) return null;
  const parts = String(text).split(URL_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: "inherit", textDecoration: "underline", wordBreak: "break-all" }}
        onClick={(e) => e.stopPropagation()}
      >
        {part}
      </a>
    ) : (
      part
    )
  );
}
