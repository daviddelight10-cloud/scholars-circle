import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

const CATEGORIES = [
  { value: "IMPORTANT", label: "Important", color: "from-red-500 to-rose-600" },
  { value: "LECTURES", label: "Lectures", color: "from-blue-500 to-indigo-600" },
  { value: "GENERAL", label: "General", color: "from-emerald-500 to-teal-600" },
  { value: "UPDATE", label: "Update", color: "from-amber-500 to-orange-600" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "from-slate-400 to-slate-500" },
  { value: "NORMAL", label: "Normal", color: "from-blue-400 to-blue-500" },
  { value: "HIGH", label: "High", color: "from-orange-500 to-amber-600" },
  { value: "CRITICAL", label: "Critical", color: "from-red-600 to-rose-700" },
];

const ROLES = ["STUDENT", "TEACHER", "LECTURER"];

export default function CampusComm({ token, currentUser }) {
  const [category, setCategory] = useState("GENERAL");
  const [priority, setPriority] = useState("NORMAL");
  const [targetRoles, setTargetRoles] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("send"); // "send" or "analytics"
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await fetch(`${API_BASE}/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/announcements/analytics/my`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setMessage({ type: "error", text: "Title and content are required" });
      return;
    }

    setIsSending(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category,
          priority,
          targetRoles,
          title,
          content,
          expiresAt: expiresAt || null,
        }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Announcement sent successfully!" });
        setTitle("");
        setContent("");
        setExpiresAt("");
        setCategory("GENERAL");
        setPriority("NORMAL");
        setTargetRoles([]);
        fetchAnnouncements();
      } else {
        const err = await response.json();
        setMessage({ type: "error", text: err.error || "Failed to send announcement" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to send announcement" });
    } finally {
      setIsSending(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this announcement?")) return;

    try {
      const response = await fetch(`${API_BASE}/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        setMessage({ type: "success", text: "Announcement deleted" });
        fetchAnnouncements();
        if (activeTab === "analytics") fetchAnalytics();
      } else {
        setMessage({ type: "error", text: "Failed to delete announcement" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete announcement" });
    }
  };

  const toggleRole = (role) => {
    setTargetRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  const getCategoryInfo = (cat) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[2];
  const getPriorityInfo = (prio) => PRIORITIES.find((p) => p.value === prio) || PRIORITIES[1];

  return (
    <div className="max-w-5xl mx-auto p-3 min-h-screen bg-slate-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7V7.12c.69 0 1.35-.07 2-.2m0 0c2.08-.37 3.92-1.64 5-3.46a21.88 21.88 0 012 5.2m-7 3.34V19a2 2 0 002 2h2a2 2 0 002-2v-2.18a25.73 25.73 0 004 .16V8a25.73 25.73 0 00-4-.16V4.66a2 2 0 00-2-2h-2a2 2 0 00-2 2v5.16" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">Campus Communications</h1>
            <p className="text-xs text-slate-500">Broadcast announcements</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-lg p-0.5 border border-slate-200">
          <button
            onClick={() => setActiveTab("send")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "send"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Send
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === "analytics"
                ? "bg-blue-600 text-white"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            Analytics
          </button>
        </div>
      </div>

      {activeTab === "send" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Send Announcement Form */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Compose Announcement</h2>

            {message && (
              <div className={`mb-3 p-2.5 rounded-lg flex items-center gap-2 text-xs ${
                message.type === "success"
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Category & Priority Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {PRIORITIES.map((prio) => (
                      <option key={prio.value} value={prio.value}>{prio.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Target Audience</label>
                <div className="flex flex-wrap gap-1.5">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                        targetRoles.includes(role)
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Announcement title"
                  maxLength={100}
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={3}
                  placeholder="Write your announcement..."
                  maxLength={1000}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-[10px] ${content.length > 900 ? "text-amber-500" : "text-slate-400"}`}>
                    {content.length}/1000
                  </span>
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="text-[10px] font-semibold text-slate-500 uppercase mb-1 block">Expiration (Optional)</label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSending ? "Sending..." : "Send Announcement"}
              </button>
            </form>
          </div>

          {/* Recent Announcements */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-slate-800">Recent</h2>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {announcements.filter((a) => a.senderId === currentUser?.id).length}
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : announcements.filter((a) => a.senderId === currentUser?.id).length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                <div className="text-2xl mb-1">📭</div>
                <p>No announcements yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {announcements
                  .filter((a) => a.senderId === currentUser?.id)
                  .slice(0, 5)
                  .map((announcement) => {
                    const catInfo = getCategoryInfo(announcement.category);
                    const prioInfo = getPriorityInfo(announcement.priority);
                    return (
                      <div
                        key={announcement.id}
                        className="group bg-slate-50 rounded-lg p-3 hover:bg-slate-100 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div className="flex gap-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r ${prioInfo.color}`}>
                              {prioInfo.label}
                            </span>
                          </div>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <h3 className="font-semibold text-slate-800 text-xs mb-0.5 truncate">{announcement.title}</h3>
                        <p className="text-slate-500 text-[11px] line-clamp-1">{announcement.content}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                          <span>{new Date(announcement.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                          <span>•</span>
                          <span>{announcement.readCount} reads</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-800 mb-4">Analytics</h2>

          {analyticsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : analytics ? (
            <>
              {/* Overall Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-3 text-white">
                  <p className="text-xl font-bold">{analytics.overall.totalAnnouncements}</p>
                  <p className="text-[10px] text-blue-100">Sent</p>
                </div>
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg p-3 text-white">
                  <p className="text-xl font-bold">{analytics.overall.totalReads}</p>
                  <p className="text-[10px] text-emerald-100">Reads</p>
                </div>
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg p-3 text-white">
                  <p className="text-xl font-bold">{analytics.overall.totalComments}</p>
                  <p className="text-[10px] text-violet-100">Comments</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg p-3 text-white">
                  <p className="text-xl font-bold">{analytics.overall.avgReadRate}%</p>
                  <p className="text-[10px] text-amber-100">Read Rate</p>
                </div>
              </div>

              {/* By Announcement */}
              <h3 className="text-[10px] font-semibold text-slate-500 uppercase mb-2">Performance</h3>
              <div className="space-y-2">
                {analytics.byAnnouncement.map((a) => {
                  const catInfo = getCategoryInfo(a.category);
                  const prioInfo = getPriorityInfo(a.priority);
                  return (
                    <div
                      key={a.id}
                      className="bg-slate-50 rounded-lg p-3"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="flex gap-1">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r ${catInfo.color}`}>
                            {catInfo.label}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold text-white bg-gradient-to-r ${prioInfo.color}`}>
                            {prioInfo.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-800 text-xs mb-2 truncate">{a.title}</h4>
                      <div className="flex gap-2 text-[10px] text-slate-500">
                        <span>{a.readCount} reads</span>
                        <span>•</span>
                        <span>{a.commentCount} comments</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-slate-400 text-xs">
              <div className="text-2xl mb-1">📊</div>
              <p>No analytics data</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
