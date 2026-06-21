import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, formatViewCount } from "../lib/researchUtils";
import ResourceViewer from "./ResourceViewer";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

export default function TeacherResourcesHub({ onBack } = {}) {
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);

  useEffect(() => {
    fetchMyResources();
  }, []);

  const fetchMyResources = async () => {
    setLoading(true);
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const response = await fetch(`${API_BASE}/api/resources/teacher/my`, {
        headers: {
          Authorization: `Bearer ${authData.authToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setResources(data);
      } else {
        setError("Failed to fetch resources");
      }
    } catch (err) {
      setError("Failed to fetch resources");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const response = await fetch(`${API_BASE}/api/resources/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authData.authToken}`,
        },
      });

      if (response.ok) {
        setResources((prev) => prev.filter((r) => r.id !== id));
        setDeleteConfirm(null);
        showToast("Resource deleted");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete resource");
      }
    } catch (err) {
      setError("Failed to delete resource");
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} onBack={() => setViewerToken(null)} />;
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>
            Teacher Hub
          </h1>
          <p style={{ fontSize: "14px", color: "#7b82b8" }}>Manage your uploaded resources</p>
        </div>
        <button
          onClick={() => navigate("/teacher/resources/upload")}
          style={{
            padding: "10px 20px",
            background: "#1a237e",
            border: "0.5px solid #3949ab",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 600,
            color: "#c5cae9",
            cursor: "pointer",
          }}
        >
          + Upload New
        </button>
      </div>

      {/* Resource count */}
      <div style={{ fontSize: "13px", color: "#7b82b8", fontWeight: 600, marginBottom: "20px" }}>
        My Uploads ({resources.length})
      </div>

      {/* Loading */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                background: "#0d0f20",
                border: "0.5px solid #1e2245",
                borderRadius: "10px",
                padding: "14px",
                height: "70px",
              }}
            />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div
          style={{
            background: "#0d0f20",
            border: "0.5px solid #1e2245",
            borderRadius: "10px",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>📁</div>
          <div style={{ fontSize: "14px", color: "#7b82b8", marginBottom: "16px" }}>
            No resources uploaded yet
          </div>
          <button
            onClick={() => navigate("/teacher/resources/upload")}
            style={{
              padding: "10px 20px",
              background: "#1a237e",
              border: "0.5px solid #3949ab",
              borderRadius: "8px",
              fontSize: "14px",
              fontWeight: 600,
              color: "#c5cae9",
              cursor: "pointer",
            }}
          >
            Upload Your First Resource
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {resources.map((resource) => {
            const badgeColor = getSubjectBadgeColor(resource.subject);
            const icon = getContentTypeIcon(resource.contentType);
            const iconClass = getContentTypeIconClass(resource.contentType);

            return (
              <div
                key={resource.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 14px",
                  background: "#0d0f20",
                  border: "0.5px solid #1e2245",
                  borderRadius: "10px",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    flexShrink: 0,
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

                {/* Info */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#c5c9e8",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginBottom: "2px",
                    }}
                  >
                    {resource.title}
                  </div>
                  <div style={{ fontSize: "11px", color: "#4a5080", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "6px",
                        background: badgeColor.bg,
                        color: badgeColor.text,
                        border: `0.5px solid ${badgeColor.border}`,
                      }}
                    >
                      {resource.subject}
                    </span>
                    <span>·</span>
                    <span>{formatViewCount(resource.viewCount)} views</span>
                    {resource.isPremium && <span>· ⭐ Premium</span>}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                  <button
                    onClick={() => setViewerToken(resource.shareToken)}
                    style={{
                      width: "32px",
                      height: "32px",
                      background: "#111328",
                      border: "0.5px solid #2a2d4a",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#5a6090",
                      fontSize: "13px",
                    }}
                    title="View"
                  >
                    👁️
                  </button>
                  <button
                    onClick={() => setViewerToken(resource.shareToken)}
                    style={{
                      width: "32px",
                      height: "32px",
                      background: "#111328",
                      border: "0.5px solid #2a2d4a",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#5a6090",
                      fontSize: "13px",
                    }}
                    title="Edit"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(resource.id)}
                    style={{
                      width: "32px",
                      height: "32px",
                      background: "#111328",
                      border: "0.5px solid #2a2d4a",
                      borderRadius: "7px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: "#5a6090",
                      fontSize: "13px",
                    }}
                    title="Delete"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#2a0a0a";
                      e.currentTarget.style.borderColor = "#4a1010";
                      e.currentTarget.style.color = "#ef9a9a";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "#111328";
                      e.currentTarget.style.borderColor = "#2a2d4a";
                      e.currentTarget.style.color = "#5a6090";
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "#ef9a9a", marginTop: "16px" }}>
          {error}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            style={{
              background: "#0d0f20",
              border: "0.5px solid #1e2245",
              borderRadius: "12px",
              padding: "24px",
              maxWidth: "400px",
              width: "90%",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>
              Delete Resource?
            </div>
            <div style={{ fontSize: "14px", color: "#7b82b8", marginBottom: "20px", lineHeight: 1.5 }}>
              This action cannot be undone. Are you sure you want to delete this resource?
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#111328",
                  border: "0.5px solid #2a2d4a",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#9fa8da",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  flex: 1,
                  padding: "10px",
                  background: "#2a0a0a",
                  border: "0.5px solid #4a1010",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#ef9a9a",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
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
