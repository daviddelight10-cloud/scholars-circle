import { useRef, useState } from "react";
import { classroomApi } from "./classroomApi.js";
import { API_BASE } from "../../lib/constants";
import { fetchWithAuth } from "../../lib/authToken.js";

const fileIcon = (t) => (t === "pdf" ? "📕" : t === "docx" || t === "doc" ? "📘" : "📄");

/** Materials: documents and links in one list. */
export function MaterialsTab({ classroom, isHost, token, onChanged }) {
  const [linkForm, setLinkForm] = useState(null); // {title, url}
  const [popupLink, setPopupLink] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  const links = classroom.links || [];
  const documents = classroom.documents || [];

  const addLink = async () => {
    if (!linkForm?.title?.trim() || !linkForm?.url?.trim()) return;
    try {
      await classroomApi.addLink(classroom.id, linkForm, token);
      setLinkForm(null);
      onChanged();
    } catch (e) {
      setErr(e.message);
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setErr("");
    try {
      await classroomApi.uploadDocument(classroom.id, file, token);
      onChanged();
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setUploading(false);
    }
  };

  const download = async (doc) => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/classroom/documents/${doc.id}/download`, { token });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Download failed"); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename || doc.title || "document";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const empty = links.length === 0 && documents.length === 0;

  return (
    <div>
      {isHost && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button className="cx-btn ghost small" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "⬆ Upload document"}
          </button>
          <button className="cx-btn ghost small" onClick={() => setLinkForm({ title: "", url: "" })}>🔗 Add link</button>
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt" style={{ display: "none" }} onChange={upload} />
        </div>
      )}
      {linkForm && (
        <div className="cx-panel">
          <input className="cx-input" placeholder="Link name" value={linkForm.title} onChange={(e) => setLinkForm((f) => ({ ...f, title: e.target.value }))} style={{ marginBottom: 8 }} />
          <input className="cx-input" placeholder="https://…" value={linkForm.url} onChange={(e) => setLinkForm((f) => ({ ...f, url: e.target.value }))} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="cx-btn ghost small" style={{ flex: 1 }} onClick={() => setLinkForm(null)}>Cancel</button>
            <button className="cx-btn small" style={{ flex: 1 }} onClick={addLink}>Add link</button>
          </div>
        </div>
      )}
      {err && <div className="cx-panel-body" style={{ color: "#f87171", marginBottom: 8 }}>{err}</div>}

      {empty ? (
        <div className="cx-empty">
          <div className="cx-empty-ic">📁</div>
          <div className="cx-empty-title">No materials yet</div>
          <div className="cx-empty-sub">{isHost ? "Upload lecture slides or share useful links above." : "Your lecturer hasn't shared anything yet."}</div>
        </div>
      ) : (
        <>
          {links.length > 0 && (
            <>
              <div className="cx-section">🔗 Links</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 6 }}>
                {links.map((l) => (
                  <button key={l.id} className="cx-filter-btn" onClick={() => setPopupLink(l)}>🔗 {l.title}</button>
                ))}
              </div>
            </>
          )}
          {documents.length > 0 && (
            <>
              <div className="cx-section">📄 Documents</div>
              {documents.map((doc) => (
                <div key={doc.id} className="cx-row">
                  <span style={{ fontSize: 18 }}>{fileIcon(doc.fileType)}</span>
                  <span className="cx-row-main">
                    <span className="cx-row-title">{doc.title}</span>
                    <span className="cx-row-meta">{doc.fileType?.toUpperCase()} · {(doc.fileSize / 1024).toFixed(1)} KB</span>
                  </span>
                  <button className="cx-btn ghost small" style={{ borderColor: "rgba(16,185,129,.3)", color: "#10b981" }} onClick={() => download(doc)}>⬇</button>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {popupLink && (
        <div className="cx-modal" onClick={() => setPopupLink(null)}>
          <div className="cx-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cx-modal-title">🔗 {popupLink.title}</div>
            <div className="cx-panel-body" style={{ wordBreak: "break-all", marginBottom: 4 }}>{popupLink.url}</div>
            <div className="cx-modal-actions">
              <button className="cx-btn ghost" onClick={() => setPopupLink(null)}>Close</button>
              <button className="cx-btn" onClick={() => window.open(popupLink.url, "_blank", "noopener")}>Open link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
