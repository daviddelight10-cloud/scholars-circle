import { useEffect, useState } from "react";
import CircleSheet from "./CircleSheet.jsx";

const REASONS = [
  { key: "outdated", title: "Outdated content", sub: "Notes no longer match the current curriculum" },
  { key: "errors", title: "Wrong answers or errors", sub: "Incorrect solutions, typos, broken pages" },
  { key: "course", title: "Not this course", sub: "Content doesn't match the course code or level" },
  { key: "spam", title: "Spam or inappropriate", sub: "Ads, abuse, or irrelevant uploads" },
  { key: "copyright", title: "Copyright infringement", sub: "Someone's work is shared without permission" },
];

/**
 * Report sheet — prototype "report-sheet".
 * target: { id, name, kind: "Folder" | "PDF document", type: "folder" | "resource" } | null
 */
export default function ReportSheet({ open, onClose, target, onSubmit }) {
  const [reason, setReason] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setReason(null); setNote(""); setBusy(false); }
  }, [open, target]);

  if (!target) return null;

  // Formal copyright notices go to the dedicated takedown form (also open to
  // non-members). Pre-fill the material's share link when we have a token.
  const copyrightUrl = target.shareToken
    ? `/copyright?u=${encodeURIComponent(`${window.location.origin}/${target.type === "folder" ? "folders" : "resources"}/${target.shareToken}`)}`
    : "/copyright";

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await onSubmit?.({ target, reason, note });
    } finally {
      setBusy(false);
    }
  };

  return (
    <CircleSheet open={open} onClose={onClose} title="Report resource" kind={target.kind}>
      <p className="mc-sheet-hint">
        Reporting "<b>{target.name}</b>". Reports are reviewed by moderators — the uploader is never told who reported.
      </p>

      {REASONS.map((r) => (
        <button key={r.key} className={`mc-rep-opt${reason === r.key ? " sel" : ""}`} onClick={() => setReason(r.key)}>
          <span className="mc-rep-radio" />
          <div>
            <div className="mc-r-t">{r.title}</div>
            <div className="mc-r-s">{r.sub}</div>
          </div>
        </button>
      ))}

      {reason === "copyright" && (
        <p className="mc-sheet-hint" style={{ marginBottom: 10 }}>
          Flagging hides it for review. To have the material formally removed under copyright,
          <a href={copyrightUrl} style={{ color: "var(--gold, #FFD700)", marginLeft: 4 }}>file a takedown notice →</a>
        </p>
      )}

      <textarea
        className="mc-rep-note"
        placeholder="Add details (optional) — e.g. 'This is the 2019 curriculum, we now use the 2024 one'"
        value={note}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
      />
      <button className="mc-rep-submit" disabled={!reason || busy} onClick={submit} style={{ opacity: reason ? 1 : 0.5 }}>
        {busy ? "Submitting…" : "Submit report"}
      </button>
    </CircleSheet>
  );
}
