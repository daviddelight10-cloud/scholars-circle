import { useState, useEffect, useMemo } from "react";
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
  const [activeTab, setActiveTab] = useState("materials");

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
        <button onClick={() => navigate("/resources")} style={{ padding: "10px 20px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "8px", fontSize: 14, fontWeight: 600, color: "#FFD700", cursor: "pointer" }}>
          ← Back to Research Hub
        </button>
      </div>
    );
  }

  const resources = folder?.resources || [];

  const categorized = useMemo(() => {
    const materials = [], summaries = [], flashcards = [], mcqs = [];
    for (const r of resources) {
      if (r.contentType === "mcq") mcqs.push(r);
      else if (r.contentType === "flashcard_deck") flashcards.push(r);
      else if (r.title?.startsWith("[AI] Summary")) summaries.push(r);
      else materials.push(r);
    }
    return { materials, summaries, flashcards, mcqs };
  }, [resources]);

  const subTabs = [
    ["materials", "📄 Materials", categorized.materials.length],
    ["summary", "📝 Summary", categorized.summaries.length],
    ["flashcards", "🎴 Flash Cards", categorized.flashcards.length],
    ["mcqs", "✎ MCQs", categorized.mcqs.length],
  ];
  const currentList = categorized[activeTab] || [];

  const renderResourceCard = (resource) => {
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
        onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#B8860B")}
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
  };

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
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {folder?.courseCode && <span style={{ fontSize: 13, color: "#7b82b8" }}>{folder.courseCode}</span>}
            {folder?.level && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "8px", background: "#0f1440", color: "#DAA520", border: "0.5px solid #2a3080" }}>{folder.level}</span>}
            {folder?.semester && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "8px", background: "#0f2a1a", color: "#a5d6a7", border: "0.5px solid #2a6a3a" }}>{folder.semester}</span>}
          </div>
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

      {/* Sub-tab row */}
      <div style={{ display: "flex", gap: "6px", marginBottom: 20, overflowX: "auto", paddingBottom: "4px" }}>
        {subTabs.map(([key, label, count]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={{
            padding: "8px 16px", borderRadius: "10px", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer",
            background: activeTab === key ? "#1a1a1a" : "none", color: activeTab === key ? "#FFD700" : "#4a5080",
            display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
          }}>
            {label}
            {count > 0 && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: "999px", fontSize: "10px", padding: "1px 6px" }}>{count}</span>}
          </button>
        ))}
      </div>

      {/* Content */}
      {currentList.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {currentList.map(renderResourceCard)}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>
            {activeTab === "materials" ? "📄" : activeTab === "summary" ? "📝" : activeTab === "flashcards" ? "🎴" : "✎"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#7b82b8", marginBottom: 6 }}>
            {activeTab === "materials" && "No materials in this folder"}
            {activeTab === "summary" && "No AI summaries available"}
            {activeTab === "flashcards" && "No flashcard decks available"}
            {activeTab === "mcqs" && "No MCQ sets available"}
          </div>
          <div style={{ fontSize: 13, color: "#4a5080" }}>
            {activeTab === "materials" && "No approved materials in this shared folder yet."}
            {activeTab === "summary" && "AI-generated summaries will appear here."}
            {activeTab === "flashcards" && "Flashcard decks will appear here."}
            {activeTab === "mcqs" && "MCQ sets will appear here."}
          </div>
        </div>
      )}
    </div>
  );
}
