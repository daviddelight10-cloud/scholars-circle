// Mastery progress ring for My Space–style file rows (sp-row).
import { IC } from "./spaceRowIcons.jsx";

export function ProgressRing({ pct }) {
  const done = pct >= 100;
  const has = pct > 0;
  const C = 2 * Math.PI * 18;
  const dash = (Math.min(pct, 100) / 100) * C;
  return (
    <div className={`sp-ring${done ? " done" : has ? "" : " empty"}`} aria-hidden="true">
      <svg className="sp-ring-svg" viewBox="0 0 44 44">
        <circle className="track" cx="22" cy="22" r="18" fill="none" strokeWidth="3" />
        {has && (
          <circle
            className="bar" cx="22" cy="22" r="18" fill="none" strokeWidth="3"
            strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`}
          />
        )}
      </svg>
      {done ? IC.check : has ? <span className="sp-ring-pct">{pct}</span> : IC.file}
    </div>
  );
}
