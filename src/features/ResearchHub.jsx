import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, formatViewCount, copyShareToken } from "../lib/researchUtils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function ResearchHub() {
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [toast, setToast] = useState(null);

  const filterTypes = ["all", "note", "pdf", "mcq", "tutorial_question"];
  const filterLabels = {
    all: "All",
    note: "Notes",
    pdf: "PDF",
    mcq: "MCQ",
    tutorial_question: "Tutorial Q",
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resources`);
      if (response.ok) {
        const data = await response.json();
        setResources(data);
      }
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredResources = resources.filter((r) => {
    const matchesSearch =
      search === "" ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase());
    const matchesType = activeFilter === "all" || r.contentType === activeFilter;
    return matchesSearch && matchesType;
  });

  const handleShare = async (token) => {
    const success = await copyShareToken(token);
    if (success) {
      showToast("Link copied! 🔗");
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={() => window.location.href = "/app"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "#111328",
          border: "0.5px solid #2a2d4a",
          borderRadius: "8px",
          fontSize: "13px",
          color: "#7b82b8",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        ← Back
      </button>

      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>
          Research Hub
        </h1>
        <p style={{ fontSize: "14px", color: "#7b82b8" }}>Find & share study materials</p>
      </div>

      {/* Search */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#0f1128",
            border: "0.5px solid #1e2245",
            borderRadius: "22px",
            padding: "10px 16px",
          }}
        >
          <span style={{ color: "#3a3d60", fontSize: "18px" }}>🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes, PDFs, MCQs…"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontSize: "14px",
              color: "#9fa8da",
            }}
          />
        </div>
      </div>

      {/* Filter Chips */}
      <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "20px", paddingBottom: "4px" }}>
        {filterTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              background: activeFilter === type ? "#1a237e" : "#0f1128",
              border: activeFilter === type ? "0.5px solid #3949ab" : "0.5px solid #252860",
              fontSize: "12px",
              fontWeight: 600,
              color: activeFilter === type ? "#c5cae9" : "#5a6090",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {filterLabels[type]}
          </button>
        ))}
      </div>

      {/* Section Label */}
      <div style={{ fontSize: "12px", fontWeight: 700, color: "#3a3d60", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" }}>
        All Materials
      </div>

      {/* Resource Grid */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                background: "#0d0f20",
                border: "0.5px solid #1e2245",
                borderRadius: "12px",
                padding: "16px",
                height: "140px",
              }}
            />
          ))}
        </div>
      ) : filteredResources.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", fontSize: "14px", color: "#3a3d60" }}>
          No resources found. Try a different search.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {filteredResources.map((resource) => {
            const badgeColor = getSubjectBadgeColor(resource.subject);
            const icon = getContentTypeIcon(resource.contentType);
            const iconClass = getContentTypeIconClass(resource.contentType);

            return (
              <div
                key={resource.id}
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
                {/* Top Row */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "8px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      background: iconClass === "icon-pdf" ? "#2a0a0a" : 
                               iconClass === "icon-mcq" ? "#0f1440" :
                               iconClass === "icon-note" ? "#0f2a1a" : "#1a1000",
                      border: iconClass === "icon-pdf" ? "0.5px solid #4a1010" :
                              iconClass === "icon-mcq" ? "0.5px solid #2a3080" :
                              iconClass === "icon-note" ? "0.5px solid #1a4a2a" : "0.5px solid #3a2800",
                    }}
                  >
                    {icon}
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "10px",
                      background: badgeColor.bg,
                      color: badgeColor.text,
                      border: `0.5px solid ${badgeColor.border}`,
                    }}
                  >
                    {resource.subject}
                  </span>
                </div>

                {/* Title */}
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#c5c9e8",
                    lineHeight: 1.3,
                    marginBottom: "8px",
                    minHeight: "34px",
                  }}
                >
                  {resource.title}
                </div>

                {/* Meta */}
                <div style={{ fontSize: "11px", color: "#3a3d60", marginBottom: "12px" }}>
                  {formatViewCount(resource.viewCount)} views
                  {resource.isPremium && " · ⭐ Premium"}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    onClick={() => navigate(`/resources/${resource.shareToken}`)}
                    style={{
                      flex: 1,
                      padding: "6px",
                      background: "#1a237e",
                      border: "0.5px solid #3949ab",
                      borderRadius: "7px",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "#9fa8da",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    Open
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShare(resource.shareToken);
                    }}
                    style={{
                      width: "32px",
                      height: "32px",
                      background: "#0f1128",
                      border: "0.5px solid #252860",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#5a6090",
                      fontSize: "12px",
                    }}
                  >
                    🔗
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f2a1a",
            border: "0.5px solid #2a6a3a",
            color: "#a5d6a7",
            padding: "10px 20px",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeup 0.2s ease",
          }}
        >
          <span>✓</span>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeup {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
