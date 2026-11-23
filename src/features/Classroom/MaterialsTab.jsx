import { useRef, useState } from "react";
import { classroomApi } from "./classroomApi.js";
import { API_BASE } from "../../lib/constants";
import { fetchWithAuth } from "../../lib/authToken.js";

const TYPE_STYLE = {
  pdf: ["📕", "#ef4444"], docx: ["📘", "#3b82f6"], doc: ["📘", "#3b82f6"],
  ppt: ["📙", "#f97316"], pptx: ["📙", "#f97316"],
  xlsx: ["📗", "#10b981"], txt: ["📄", "#94a3b8"],
  jpg: ["🖼️", "#a855f7"], jpeg: ["🖼️", "#a855f7"], png: ["🖼️", "#a855f7"], webp: ["🖼️", "#a855f7"],
};
const fileStyle = (t) => TYPE_STYLE[t?.toLowerCase()] || ["📄", "#94a3b8"];
const fmtSize = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "");
const ACCEPT = ".pdf,.docx,.doc,.txt,.ppt,.pptx,.xlsx,.jpg,.jpeg,.png,.webp";

/** Materials: documents and links — drag-drop uploads w/ progress, file cards, host delete. */
export function MaterialsTab({ classroom, isHost, token, onChanged }) {
  const [linkForm, setLinkForm] = useState(null); // {title, url}
  const [popupLink, setPopupLink] = useState(null);
  const [uploads, setUploads] = useState([]); // [{name, pct, error}]
  const [dragOver, setDragOver] = useState(false);
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

  const uploadFiles = (files) => {
    for (const file of files) {
      const key = `${file.name}-${Date.now()}`;
      setUploads((u) => [...u, { key, name: file.name, pct: 0, error: null }]);
      classroomApi.uploadDocumentProgress(classroom.id, file, token, (pct) => {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, pct } : x)));
      })
        .then(() => {
          setUploads((u) => u.filter((x) => x.key !== key));
          onChanged();
        })
        .catch((ex) => {
          setUploads((u) => u.map((x) => (x.key === key ? { ...x, error: ex.message } : x)));
          setTimeout(() => setUploads((u) => u.filter((x) => x.key !== key)), 5000);
        });
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = [...(e.dataTransfer?.files || [])];
    if (files.length) uploadFiles(files);
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

  const removeDoc = async (doc) => {
    if (!window.confirm(`Delete "${doc.title}"?`)) return;
    try {
      await classroomApi.deleteDocument(classroom.id, doc.id, token);
      onChanged();
    } catch (ex) {
      setErr(ex.message);
    }
  };

  const empty = links.length === 0 && documents.length === 0;

  return (
    <div
      onDragOver={isHost ? (e) => { e.preventDefault(); setDragOver(true); } : undefined}
      onDragLeave={isHost ? () => setDragOver(false) : undefined}
      onDrop={isHost ? onDrop : undefined}
    >
      {isHost && (
        <>
          <div
            className={`cx-dropzone${dragOver ? " over" : ""}`}
            onClick={() => fileRef.current?.click()}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
          >
            <div className="cx-dropzone-ic">⬆</div>
            <div className="cx-dropzone-tx">
              <b>Drop files here</b> or tap to upload
              <span>PDF · Word · PowerPoint · Excel · Images · TXT — up to 50 MB</span>
            </div>
          </div>
          <input ref={fileRef} type="file" multiple accept={ACCEPT} style={{ display: "none" }}
            onChange={(e) => { uploadFiles([...(e.target.files || [])]); e.target.value = ""; }} />
          <button className="cx-btn ghost small" style={{ marginTop: 8 }} onClick={() => setLinkForm({ title: "", url: "" })}>🔗 Add link</button>
        </>
      )}

      {uploads.map((u) => (
        <div key={u.key} className="cx-upload-row">
          <span className="cx-upload-name">{u.error ? "⚠ " : "⬆ "}{u.name}</span>
          {u.error ? <span className="cx-upload-err">{u.error}</span> : (
            <span className="cx-upload-bar"><span style={{ width: `${u.pct}%` }} /></span>
          )}
        </div>
      ))}

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
      {err && <div className="cx-msg err">{err}</div>}

      {empty && uploads.length === 0 ? (
        <div className="cx-empty">
          <div className="cx-empty-ic">📁</div>
          <div className="cx-empty-title">No materials yet</div>
          <div className="cx-empty-sub">{isHost ? "Drop lecture slides above or share a useful link." : "Your lecturer hasn't shared anything yet."}</div>
        </div>
      ) : (
        <>
          {links.length > 0 && (
            <>
              <div className="cx-section">🔗 Links</div>
              <div className="cx-link-list">
                {links.map((l) => (
                  <button key={l.id} className="cx-link-card" onClick={() => setPopupLink(l)}>
                    <span className="cx-link-ic">🔗</span>
                    <span className="cx-link-tx">
                      <span className="cx-link-title">{l.title}</span>
                      <span className="cx-link-url">{l.url}</span>
                    </span>
                    <span className="cx-link-go">↗</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {documents.length > 0 && (
            <>
              <div className="cx-section">📄 Documents</div>
              <div className="cx-doc-grid">
                {documents.map((doc) => {
                  const [icon, color] = fileStyle(doc.fileType);
                  return (
                    <div key={doc.id} className="cx-doc-card" onClick={() => download(doc)} role="button" tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && download(doc)}>
                      <span className="cx-doc-icon" style={{ background: `${color}22`, color }}>{icon}</span>
                      <span className="cx-doc-info">
                        <span className="cx-doc-title">{doc.title}</span>
                        <span className="cx-doc-meta">
                          {doc.fileType?.toUpperCase()}{doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ""}{doc.createdAt ? ` · ${fmtDate(doc.createdAt)}` : ""}
                        </span>
                      </span>
                      <span className="cx-doc-acts">
                        <button className="cx-doc-dl" onClick={(e) => { e.stopPropagation(); download(doc); }} title="Download">⬇</button>
                        {isHost && (
                          <button className="cx-doc-del" onClick={(e) => { e.stopPropagation(); removeDoc(doc); }} title="Delete">🗑</button>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
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
