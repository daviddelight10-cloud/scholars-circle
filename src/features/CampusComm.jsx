import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

const CATEGORIES = [
  { value: "IMPORTANT", label: "Important", color: "bg-red-500" },
  { value: "LECTURES", label: "Lectures", color: "bg-blue-500" },
  { value: "GENERAL", label: "General Announcement", color: "bg-green-500" },
  { value: "UPDATE", label: "Update", color: "bg-yellow-500" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-400" },
  { value: "NORMAL", label: "Normal", color: "bg-blue-400" },
  { value: "HIGH", label: "High", color: "bg-orange-500" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-600" },
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
    <div className="max-w-4xl mx-auto p-4 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/25">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7V7.12c.69 0 1.35-.07 2-.2m0 0c2.08-.37 3.92-1.64 5-3.46a21.88 21.88 0 012 5.2m-7 3.34V19a2 2 0 002 2h2a2 2 0 002-2v-2.18a25.73 25.73 0 004 .16V8a25.73 25.73 0 00-4-.16V4.66a2 2 0 00-2-2h-2a2 2 0 00-2 2v5.16" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">Campus Communications</h1>
            <p className="text-sm text-slate-500">Broadcast announcements to your campus community</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 mb-6 p-1 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/50 shadow-sm w-fit">
        <button
          onClick={() => setActiveTab("send")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
            activeTab === "send"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
              : "text-slate-600 hover:text-slate-800 hover:bg-white/80"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
          Send
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
            activeTab === "analytics"
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
              : "text-slate-600 hover:text-slate-800 hover:bg-white/80"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
          </svg>
          Analytics
        </button>
      </div>

      {activeTab === "send" ? (
        <>
          {/* Send Announcement Form */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-slate-200/50 p-6 mb-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Compose Announcement</h2>
            </div>

            {message && (
              <div className={`mb-5 p-3.5 rounded-xl flex items-center gap-2.5 border ${
                message.type === "success"
                  ? "bg-emerald-50/80 border-emerald-200 text-emerald-700"
                  : "bg-rose-50/80 border-rose-200 text-rose-700"
              }`}>
                {message.type === "success" ? (
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                )}
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Category */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 block">Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`relative px-3 py-3 rounded-xl text-sm font-semibold transition-all duration-200 flex flex-col items-center gap-1.5 border-2 ${
                        category === cat.value
                          ? `border-transparent bg-gradient-to-br ${cat.color} text-white shadow-lg shadow-blue-500/20 scale-[1.02]`
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white hover:shadow-sm"
                      }`}
                    >
                      <span className="text-lg">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 block">Priority</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRIORITIES.map((prio) => (
                    <button
                      key={prio.value}
                      type="button"
                      onClick={() => setPriority(prio.value)}
                      className={`relative px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 border-2 ${
                        priority === prio.value
                          ? `border-transparent bg-gradient-to-r ${prio.color} text-white shadow-lg shadow-blue-500/20`
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <span>{prio.icon}</span>
                      <span>{prio.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target Audience */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5 block">Target Audience</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 border-2 flex items-center gap-1.5 ${
                        targetRoles.includes(role)
                          ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm shadow-blue-500/10"
                          : "border-slate-100 bg-white text-slate-500 hover:border-slate-200 hover:text-slate-700"
                      }`}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                      </svg>
                      {role}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2 font-medium">
                  {targetRoles.length === 0 ? "Sending to all users" : `Sending to: ${targetRoles.join(", ")}`}
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-white transition-all duration-200 font-medium"
                  placeholder="What's this announcement about?"
                  maxLength={100}
                />
              </div>

              {/* Content */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-white transition-all duration-200 font-medium resize-none"
                  rows={4}
                  placeholder="Write your announcement here..."
                  maxLength={1000}
                />
                <div className="flex justify-end mt-1.5">
                  <span className={`text-xs font-medium transition-colors ${content.length > 900 ? "text-amber-500" : "text-slate-400"}`}>
                    {content.length}/1000
                  </span>
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                  </svg>
                  Expiration (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-white transition-all duration-200 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                {isSending ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                    Send Announcement
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Recent Announcements */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-slate-200/50 p-6">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Recent Announcements</h2>
              <span className="ml-auto px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold">
                {announcements.filter((a) => a.senderId === currentUser?.id).length}
              </span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : announcements.filter((a) => a.senderId === currentUser?.id).length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-slate-500 font-medium">No announcements sent yet</p>
                <p className="text-slate-400 text-sm mt-1">Your broadcasts will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements
                  .filter((a) => a.senderId === currentUser?.id)
                  .map((announcement) => {
                    const catInfo = getCategoryInfo(announcement.category);
                    const prioInfo = getPriorityInfo(announcement.priority);
                    return (
                      <div
                        key={announcement.id}
                        className="group bg-white rounded-xl border border-slate-100 p-4 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                      >
                        <div className="flex items-start justify-between mb-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`px-2.5 py-1 rounded-lg text-white text-[11px] font-bold bg-gradient-to-r ${catInfo.color}`}>
                              {catInfo.icon} {catInfo.label}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-white text-[11px] font-bold bg-gradient-to-r ${prioInfo.color}`}>
                              {prioInfo.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-slate-400">
                              {new Date(announcement.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                            <button
                              onClick={() => handleDelete(announcement.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        <h3 className="font-bold text-slate-800 text-sm mb-1 leading-snug">{announcement.title}</h3>
                        <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">{announcement.content}</p>
                        {announcement.targetRoles && announcement.targetRoles.length > 0 && (
                          <div className="flex items-center gap-1 mt-2.5 text-[11px] text-slate-400 font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                            {announcement.targetRoles.join(", ")}
                          </div>
                        )}
                        {announcement.expiresAt && (
                          <div className="flex items-center gap-1 mt-1.5 text-[11px] text-amber-500 font-medium">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 9v7.5" />
                            </svg>
                            Expires {new Date(announcement.expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-50 text-xs text-slate-400 font-medium">
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {announcement.readCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.08-4.08a.75.75 0 01.53-.22h3.558c1.69 0 3.054-1.375 3.054-3.074V6.074C19.422 4.375 18.058 3 16.368 3H5.074C3.384 3 2.02 4.375 2.02 6.074v6.686z" />
                            </svg>
                            {announcement.commentCount}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Analytics Dashboard */}
          <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-slate-200/50 p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-slate-800">Analytics Overview</h2>
            </div>

            {analyticsLoading ? (
              <div className="flex items-center justify-center py-12">
                <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            ) : analytics ? (
              <>
                {/* Overall Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-5 text-white shadow-lg shadow-blue-500/20">
                    <div className="relative z-10">
                      <p className="text-3xl font-bold">{analytics.overall.totalAnnouncements}</p>
                      <p className="text-sm font-medium text-blue-100 mt-1">Total Sent</p>
                    </div>
                    <svg className="absolute -bottom-2 -right-2 w-16 h-16 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7V7.12c.69 0 1.35-.07 2-.2m0 0c2.08-.37 3.92-1.64 5-3.46a21.88 21.88 0 012 5.2m-7 3.34V19a2 2 0 002 2h2a2 2 0 002-2v-2.18a25.73 25.73 0 004 .16V8a25.73 25.73 0 00-4-.16V4.66a2 2 0 00-2-2h-2a2 2 0 00-2 2v5.16" />
                    </svg>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white shadow-lg shadow-emerald-500/20">
                    <div className="relative z-10">
                      <p className="text-3xl font-bold">{analytics.overall.totalReads}</p>
                      <p className="text-sm font-medium text-emerald-100 mt-1">Total Reads</p>
                    </div>
                    <svg className="absolute -bottom-2 -right-2 w-16 h-16 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-5 text-white shadow-lg shadow-violet-500/20">
                    <div className="relative z-10">
                      <p className="text-3xl font-bold">{analytics.overall.totalComments}</p>
                      <p className="text-sm font-medium text-violet-100 mt-1">Comments</p>
                    </div>
                    <svg className="absolute -bottom-2 -right-2 w-16 h-16 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.08-4.08a.75.75 0 01.53-.22h3.558c1.69 0 3.054-1.375 3.054-3.074V6.074C19.422 4.375 18.058 3 16.368 3H5.074C3.384 3 2.02 4.375 2.02 6.074v6.686z" />
                    </svg>
                  </div>
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-lg shadow-amber-500/20">
                    <div className="relative z-10">
                      <p className="text-3xl font-bold">{analytics.overall.avgReadRate}%</p>
                      <p className="text-sm font-medium text-amber-100 mt-1">Avg Read Rate</p>
                    </div>
                    <svg className="absolute -bottom-2 -right-2 w-16 h-16 text-white/10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                    </svg>
                  </div>
                </div>

                {/* By Announcement */}
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">Performance by Announcement</h3>
                <div className="space-y-3">
                  {analytics.byAnnouncement.map((a) => {
                    const catInfo = getCategoryInfo(a.category);
                    const prioInfo = getPriorityInfo(a.priority);
                    return (
                      <div
                        key={a.id}
                        className="group bg-white rounded-xl border border-slate-100 p-4 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                      >
                        <div className="flex items-start justify-between mb-2.5">
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`px-2.5 py-1 rounded-lg text-white text-[11px] font-bold bg-gradient-to-r ${catInfo.color}`}>
                              {catInfo.icon} {catInfo.label}
                            </span>
                            <span className={`px-2.5 py-1 rounded-lg text-white text-[11px] font-bold bg-gradient-to-r ${prioInfo.color}`}>
                              {prioInfo.label}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-slate-400">
                            {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <h4 className="font-bold text-slate-800 text-sm mb-3 leading-snug">{a.title}</h4>
                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 font-medium">
                          <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {a.readCount} reads
                          </span>
                          <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.08-4.08a.75.75 0 01.53-.22h3.558c1.69 0 3.054-1.375 3.054-3.074V6.074C19.422 4.375 18.058 3 16.368 3H5.074C3.384 3 2.02 4.375 2.02 6.074v6.686z" />
                            </svg>
                            {a.commentCount} comments
                          </span>
                          {a.targetRoles && a.targetRoles.length > 0 && (
                            <span className="flex items-center gap-1 bg-slate-50 px-2 py-1 rounded-lg">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                              </svg>
                              {a.targetRoles.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-slate-100">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-slate-500 font-medium">No analytics data available</p>
                <p className="text-slate-400 text-sm mt-1">Send some announcements to see stats</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
