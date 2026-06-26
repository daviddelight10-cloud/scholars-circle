import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, formatViewCount } from "../lib/researchUtils";
import { getDepartments } from "../lib/departments.js";
import ResourceViewer from "./ResourceViewer";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

export default function TeacherResourcesHub({ onBack } = {}) {
  const navigate = useNavigate();
  const [resources, setResources] = useState([]);
  const [pendingResources, setPendingResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [activeTab, setActiveTab] = useState("my");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filters, setFilters] = useState({ department: "all", level: "all", semester: "all", subject: "all" });
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetchMyResources();
    getDepartments().then(setDepartments).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "pending" && pendingResources.length === 0 && !pendingLoading) {
      fetchPendingResources();
    }
  }, [activeTab]);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}` };
  };

  const fetchMyResources = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resources/teacher/my`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setResources(data);
      } else {
        setError("Failed to fetch resources");
      }
    } catch {
      setError("Failed to fetch resources");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingResources = async () => {
    setPendingLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resources/pending`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setPendingResources(data);
      } else {
        setError("Failed to fetch pending resources");
      }
    } catch {
      setError("Failed to fetch pending resources");
    } finally {
      setPendingLoading(false);
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}/approve`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setPendingResources((prev) => prev.filter((r) => r.id !== id));
        showToast("Resource approved ✓");
      } else {
        showToast("Failed to approve resource");
      }
    } catch {
      showToast("Failed to approve resource");
    }
  };

  const handleReject = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}/reject`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setPendingResources((prev) => prev.filter((r) => r.id !== id));
        showToast("Resource rejected");
      } else {
        showToast("Failed to reject resource");
      }
    } catch {
      showToast("Failed to reject resource");
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setResources((prev) => prev.filter((r) => r.id !== id));
        setPendingResources((prev) => prev.filter((r) => r.id !== id));
        setDeleteConfirm(null);
        showToast("Resource deleted");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to delete resource");
      }
    } catch {
      setError("Failed to delete resource");
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const activeFilterCount = ["level", "semester", "subject"].filter((k) => filters[k] !== "all").length;

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
  }, [resources, filters]);

  const filteredPending = useMemo(() => {
    return pendingResources.filter((r) => {
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
  }, [pendingResources, filters]);

  const allResources = useMemo(() => [...resources, ...pendingResources], [resources, pendingResources]);

  const filterOptions = useMemo(() => {
    const keys = ["department", "level", "semester", "subject"];
    const result = {};
    for (const key of keys) {
      const set = new Set(allResources.map((r) => r[key]).filter(Boolean));
      result[key] = Array.from(set).sort();
    }
    return result;
  }, [allResources]);

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} onBack={() => setViewerToken(null)} />;
  }

  const renderResourceRow = (resource, showApproveReject = false) => {
    const badgeColor = getSubjectBadgeColor(resource.subject);
    const icon = getContentTypeIcon(resource.contentType);
    const iconClass = getContentTypeIconClass(resource.contentType);

    return (
      <div key={resource.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0,
          background: iconClass === "icon-pdf" ? "#2a0a0a" : iconClass === "icon-mcq" ? "#0f1440" : iconClass === "icon-note" ? "#0f2a1a" : "#1a1000",
          border: iconClass === "icon-pdf" ? "0.5px solid #4a1010" : iconClass === "icon-mcq" ? "0.5px solid #2a3080" : iconClass === "icon-note" ? "0.5px solid #1a4a2a" : "0.5px solid #3a2800",
        }}>{icon}</div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#c5c9e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "2px" }}>
            {resource.title}
          </div>
          <div style={{ fontSize: "11px", color: "#4a5080", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ padding: "2px 6px", borderRadius: "6px", background: badgeColor.bg, color: badgeColor.text, border: `0.5px solid ${badgeColor.border}` }}>{resource.subject}</span>
            <span>·</span>
            <span>{formatViewCount(resource.viewCount)} views</span>
            {resource.isPremium && <span>· ⭐ Premium</span>}
            {resource.uploader && <span>· by {resource.uploader.username}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {showApproveReject ? (
            <>
              <button onClick={() => handleApprove(resource.id)} title="Approve" style={{
                width: "32px", height: "32px", background: "#0f2a1a", border: "0.5px solid #2a6a3a", borderRadius: "7px",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#66bb6a", fontSize: "14px",
              }}>✓</button>
              <button onClick={() => handleReject(resource.id)} title="Reject" style={{
                width: "32px", height: "32px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "7px",
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ef9a9a", fontSize: "14px",
              }}>✗</button>
            </>
          ) : (
            <button onClick={() => setViewerToken(resource.shareToken)} title="View" style={{
              width: "32px", height: "32px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "7px",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5a6090", fontSize: "13px",
            }}>👁️</button>
          )}
          <button onClick={() => setDeleteConfirm(resource.id)} title="Delete" style={{
            width: "32px", height: "32px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "7px",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5a6090", fontSize: "13px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#2a0a0a"; e.currentTarget.style.borderColor = "#4a1010"; e.currentTarget.style.color = "#ef9a9a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#111328"; e.currentTarget.style.borderColor = "#2a2d4a"; e.currentTarget.style.color = "#5a6090"; }}
          >🗑️</button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>Teacher Hub</h1>
          <p style={{ fontSize: "14px", color: "#7b82b8" }}>Manage your uploaded resources</p>
        </div>
        <button onClick={() => navigate("/teacher/resources/upload")} style={{
          padding: "10px 20px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#c5cae9", cursor: "pointer",
        }}>+ Upload New</button>
      </div>

      {/* Tabs + Filter */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("my")} style={activeTab === "my" ? tabActiveStyle : tabStyle}>
          My Uploads ({filteredResources.length})
        </button>
        <button onClick={() => setActiveTab("pending")} style={activeTab === "pending" ? tabActiveStyle : tabStyle}>
          Pending Approval ({filteredPending.length})
        </button>
        <button onClick={() => setShowFilterSheet(true)} style={{
          ...filterBtnStyle,
          background: activeFilterCount > 0 ? "#1a237e" : "#0f1128",
          border: activeFilterCount > 0 ? "0.5px solid #3949ab" : "0.5px solid #1e2245",
          color: activeFilterCount > 0 ? "#c5cae9" : "#9fa8da",
        }}>
          <span>🔧 Filters</span>
          {activeFilterCount > 0 && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: "999px", fontSize: "10px", padding: "1px 6px" }}>{activeFilterCount}</span>}
        </button>
      </div>

      {/* Department Tabs */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "20px", paddingBottom: "4px" }}>
        <button
          onClick={() => setFilters((p) => ({ ...p, department: "all" }))}
          style={{
            padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
            background: filters.department === "all" ? "#1a237e" : "#0f1128",
            border: filters.department === "all" ? "0.5px solid #3949ab" : "0.5px solid #1e2245",
            color: filters.department === "all" ? "#c5cae9" : "#7b82b8",
          }}
        >
          All
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => setFilters((p) => ({ ...p, department: d.name }))}
            style={{
              padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
              background: filters.department === d.name ? "#1a237e" : "#0f1128",
              border: filters.department === d.name ? "0.5px solid #3949ab" : "0.5px solid #1e2245",
              color: filters.department === d.name ? "#c5cae9" : "#7b82b8",
            }}
          >
            {d.icon || "🏛️"} {d.name}
          </button>
        ))}
      </div>

      {/* My Uploads Tab */}
      {activeTab === "my" && (
        <>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "14px", height: "70px" }} />)}
            </div>
          ) : filteredResources.length === 0 ? (
            <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "14px", color: "#7b82b8" }}>{activeFilterCount > 0 ? "No resources match your filters" : "No resources uploaded yet"}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredResources.map((r) => renderResourceRow(r, false))}
            </div>
          )}
        </>
      )}

      {/* Pending Approval Tab */}
      {activeTab === "pending" && (
        <>
          {pendingLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "14px", height: "70px" }} />)}
            </div>
          ) : filteredPending.length === 0 ? (
            <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
              <div style={{ fontSize: "14px", color: "#7b82b8" }}>{activeFilterCount > 0 ? "No pending resources match your filters" : "No resources pending approval"}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredPending.map((r) => renderResourceRow(r, true))}
            </div>
          )}
        </>
      )}

      {/* Filter Sheet */}
      {showFilterSheet && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowFilterSheet(false)}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #2a2d4a", borderRadius: "18px", padding: "26px", width: "90%", maxWidth: "420px", maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#e8eaf6", margin: 0 }}>Filters</h2>
              <button onClick={() => setShowFilterSheet(false)} style={{ background: "none", border: "none", color: "#4a5080", fontSize: "16px", cursor: "pointer", padding: "4px" }}>✕</button>
            </div>

            {[
              { key: "level", label: "Level" },
              { key: "semester", label: "Semester" },
              { key: "subject", label: "Subject" },
            ].map(({ key, label }) => {
              const options = filterOptions[key] || [];
              return (
                <div key={key} style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>{label}</label>
                  <select
                    value={filters[key]}
                    onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                    style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#9fa8da", outline: "none" }}
                  >
                    <option value="all">All {label.toLowerCase()}s</option>
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setFilters({ department: "all", level: "all", semester: "all", subject: "all" })}
                style={{ flex: 1, padding: "10px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: "13px", fontWeight: 600, color: "#7986cb", cursor: "pointer" }}
              >
                Clear all{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </button>
              <button
                onClick={() => setShowFilterSheet(false)}
                style={{ flex: 1, padding: "10px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "10px", fontSize: "13px", fontWeight: 700, color: "#c5cae9", cursor: "pointer" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "#ef9a9a", marginTop: "16px" }}>{error}</div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "24px", maxWidth: "400px", width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>Delete Resource?</div>
            <div style={{ fontSize: "14px", color: "#7b82b8", marginBottom: "20px", lineHeight: 1.5 }}>This action cannot be undone. Are you sure you want to delete this resource?</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "10px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#9fa8da", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: "10px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#ef9a9a", cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#0f2a1a", border: "0.5px solid #2a6a3a", color: "#a5d6a7", padding: "10px 20px", borderRadius: "20px", fontSize: "13px", fontWeight: 600, zIndex: 999, display: "flex", alignItems: "center", gap: "8px", animation: "fadeup 0.2s ease" }}>
          <span>✓</span>{toast}
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

const filterBtnStyle = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "8px 14px", borderRadius: "999px",
  fontSize: "13px", fontWeight: 600, cursor: "pointer",
};

const tabStyle = {
  padding: "8px 16px", borderRadius: "999px", background: "none", border: "none",
  fontSize: "13px", fontWeight: 600, color: "#4a5080", cursor: "pointer",
};

const tabActiveStyle = {
  padding: "8px 16px", borderRadius: "999px", background: "#1a237e", border: "none",
  fontSize: "13px", fontWeight: 700, color: "#c5cae9", cursor: "pointer",
};
