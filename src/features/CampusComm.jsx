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
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Campus Communications</h1>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab("send")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === "send" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Send Announcement
        </button>
        <button
          onClick={() => setActiveTab("analytics")}
          className={`px-4 py-2 rounded-lg font-medium transition ${
            activeTab === "analytics" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }`}
        >
          Analytics
        </button>
      </div>

      {activeTab === "send" ? (
        <>
          {/* Send Announcement Form */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Send New Announcement</h2>
            
            {message && (
              <div
                className={`mb-4 p-3 rounded ${
                  message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}
              >
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => setCategory(cat.value)}
                      className={`px-4 py-2 rounded-full text-white text-sm font-medium transition ${
                        category === cat.value ? cat.color : "bg-gray-300 hover:bg-gray-400"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                <div className="flex flex-wrap gap-2">
                  {PRIORITIES.map((prio) => (
                    <button
                      key={prio.value}
                      type="button"
                      onClick={() => setPriority(prio.value)}
                      className={`px-4 py-2 rounded-full text-white text-sm font-medium transition ${
                        priority === prio.value ? prio.color : "bg-gray-300 hover:bg-gray-400"
                      }`}
                    >
                      {prio.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Target Audience (Optional)</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                        targetRoles.includes(role)
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {targetRoles.length === 0 ? "Send to all users" : `Send to: ${targetRoles.join(", ")}`}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter announcement title..."
                  maxLength={100}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={5}
                  placeholder="Enter announcement content..."
                  maxLength={1000}
                />
                <p className="text-xs text-gray-500 mt-1">{content.length}/1000 characters</p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {isSending ? "Sending..." : "Send Announcement"}
              </button>
            </form>
          </div>

          {/* Recent Announcements */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Your Recent Announcements</h2>
            
            {isLoading ? (
              <p className="text-gray-500">Loading...</p>
            ) : announcements.length === 0 ? (
              <p className="text-gray-500">No announcements sent yet.</p>
            ) : (
              <div className="space-y-4">
                {announcements
                  .filter((a) => a.senderId === currentUser?.id)
                  .map((announcement) => {
                    const catInfo = getCategoryInfo(announcement.category);
                    const prioInfo = getPriorityInfo(announcement.priority);
                    return (
                      <div
                        key={announcement.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-white text-xs font-medium ${catInfo.color}`}
                            >
                              {catInfo.label}
                            </span>
                            <span
                              className={`px-3 py-1 rounded-full text-white text-xs font-medium ${prioInfo.color}`}
                            >
                              {prioInfo.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(announcement.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-800 mb-1">{announcement.title}</h3>
                        <p className="text-gray-600 text-sm mb-2">{announcement.content}</p>
                        {announcement.targetRoles && announcement.targetRoles.length > 0 && (
                          <p className="text-xs text-gray-500 mb-2">
                            Target: {announcement.targetRoles.join(", ")}
                          </p>
                        )}
                        {announcement.expiresAt && (
                          <p className="text-xs text-gray-500 mb-2">
                            Expires: {new Date(announcement.expiresAt).toLocaleString()}
                          </p>
                        )}
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Read by {announcement.readCount} users • {announcement.commentCount} comments</span>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-700">Announcement Analytics</h2>
            
            {analyticsLoading ? (
              <p className="text-gray-500">Loading analytics...</p>
            ) : analytics ? (
              <>
                {/* Overall Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-blue-600">{analytics.overall.totalAnnouncements}</p>
                    <p className="text-sm text-gray-600">Total Sent</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-green-600">{analytics.overall.totalReads}</p>
                    <p className="text-sm text-gray-600">Total Reads</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-purple-600">{analytics.overall.totalComments}</p>
                    <p className="text-sm text-gray-600">Total Comments</p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <p className="text-2xl font-bold text-orange-600">{analytics.overall.avgReadRate}%</p>
                    <p className="text-sm text-gray-600">Avg Read Rate</p>
                  </div>
                </div>

                {/* By Announcement */}
                <h3 className="text-md font-semibold mb-3 text-gray-700">Performance by Announcement</h3>
                <div className="space-y-3">
                  {analytics.byAnnouncement.map((a) => {
                    const catInfo = getCategoryInfo(a.category);
                    const prioInfo = getPriorityInfo(a.priority);
                    return (
                      <div
                        key={a.id}
                        className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex gap-2">
                            <span
                              className={`px-2 py-1 rounded-full text-white text-xs font-medium ${catInfo.color}`}
                            >
                              {catInfo.label}
                            </span>
                            <span
                              className={`px-2 py-1 rounded-full text-white text-xs font-medium ${prioInfo.color}`}
                            >
                              {prioInfo.label}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {new Date(a.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 className="font-medium text-gray-800 text-sm mb-2">{a.title}</h4>
                        <div className="flex gap-4 text-xs text-gray-600">
                          <span>👁 {a.readCount} reads</span>
                          <span>💬 {a.commentCount} comments</span>
                          {a.targetRoles && a.targetRoles.length > 0 && (
                            <span>🎯 {a.targetRoles.join(", ")}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-gray-500">No analytics data available.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
