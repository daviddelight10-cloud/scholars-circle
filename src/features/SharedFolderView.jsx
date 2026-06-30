import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFolderByShareToken } from "../lib/foldersApi";
import { getContentTypeIcon, getContentTypeIconClass, getSubjectBadgeColor, formatViewCount } from "../lib/researchUtils";
import ResourceViewer from "./ResourceViewer";

export default function SharedFolderView() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [folder, setFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerToken, setViewerToken] = useState(null);

  useEffect(() => {
    fetchFolder();
  }, [shareToken]);

  const fetchFolder = async () => {
    setLoading(true);
    try {
      const data = await getFolderByShareToken(shareToken);
      setFolder(data);
    } catch (err) {
      setError(err.message || "Failed to load folder");
    } finally {
      setLoading(false);
    }
  };

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} onBack={() => setViewerToken(null)} />;
  }

  if (loading) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#7b82b8", fontSize: 14 }}>
        Loading shared folder…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#7b82b8", marginBottom: 6 }}>Folder not accessible</div>
        <div style={{ fontSize: 13, color: "#4a5080", marginBottom: 16 }}>{error}</div>
        <button onClick={() => navigate("/resources")} style={{ padding: "10px 20px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "8px", fontSize: 14, fontWeight: 600, color: "#c5cae9", cursor: "pointer" }}>
          ← Back to Research Hub
        </button>
      </div>
    );
  }

  const resources = folder?.resources || [];

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
        <button onClick={() => navigate("/resources")} style={{ padding: "8px 14px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "13px", color: "#7b82b8", cursor: "pointer" }}>
          ← Research Hub
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e8eaf6", margin: 0 }}>
            📁 {folder?.name}
          </h1>
          {folder?.courseCode && (
            <div style={{ fontSize: 13, color: "#7b82b8", marginTop: 4 }}>{folder.courseCode}</div>
          )}
        </div>
        <span style={{ fontSize: 11, padding: "4px 10px", borderRadius: "8px", background: "#0f2a1a", color: "#a5d6a7", border: "0.5px solid #2a6a3a" }}>
          🔗 Shared folder
        </span>
      </div>

      {/* Owner info */}
      {folder?.owner && (
        <div style={{ fontSize: 12, color: "#4a5080", marginBottom: 20 }}>
          Shared by {folder.owner.username}
        </div>
      )}

      {/* Resources */}
      {resources.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {resources.map((resource) => {
            const badgeColor = getSubjectBadgeColor(resource.subject);
            const icon = getContentTypeIcon(resource.contentType);
            const iconClass = getContentTypeIconClass(resource.contentType);
            return (
              <div
                key={resource.id}
                onClick={() => setViewerToken(resource.shareToken)}
                style={{
                  background: "#0d0f20",
                  border: "0.5px solid #1e2245",
                  borderRadius: "12px",
                  padding: "14px",
                  cursor: "pointer",
                  transition: "borderColor 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3949ab")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e2245")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px", flexShrink: 0,
                    background: iconClass === "icon-pdf" ? "#2a0a0a" : iconClass === "icon-mcq" ? "#0f1440" : iconClass === "icon-note" ? "#0f2a1a" : iconClass === "icon-flashcard" ? "#1a0f2a" : "#1a1000",
                    border: iconClass === "icon-pdf" ? "0.5px solid #4a1010" : iconClass === "icon-mcq" ? "0.5px solid #2a3080" : iconClass === "icon-note" ? "0.5px solid #1a4a2a" : iconClass === "icon-flashcard" ? "0.5px solid #4a2a80" : "0.5px solid #3a2800",
                  }}>{icon}</div>
                  <span style={{ padding: "2px 8px", borderRadius: "6px", fontSize: "10px", fontWeight: 600, background: badgeColor.bg, color: badgeColor.text, border: `0.5px solid ${badgeColor.border}` }}>
                    {resource.subject}
                  </span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#c5c9e8", lineHeight: 1.35, marginBottom: "6px" }}>
                  {resource.title}
                </div>
                <div style={{ fontSize: 11, color: "#4a5080" }}>
                  {formatViewCount(resource.viewCount)} views
                  {resource.uploader && ` · by ${resource.uploader.username}`}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#7b82b8", marginBottom: 6 }}>This folder is empty</div>
          <div style={{ fontSize: 13, color: "#4a5080" }}>No approved materials in this shared folder yet.</div>
        </div>
      )}
    </div>
  );
}
