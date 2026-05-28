import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

const CATEGORIES = [
  { value: "IMPORTANT", label: "Important", color: "bg-red-500" },
  { value: "LECTURES", label: "Lectures", color: "bg-blue-500" },
  { value: "GENERAL", label: "General Announcement", color: "bg-green-500" },
  { value: "UPDATE", label: "Update", color: "bg-yellow-500" },
];

export default function CampusComm({ token, currentUser }) {
  const [category, setCategory] = useState("GENERAL");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
      } else {
        setMessage({ type: "error", text: "Failed to delete announcement" });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to delete announcement" });
    }
  };

  const getCategoryInfo = (cat) => CATEGORIES.find((c) => c.value === cat) || CATEGORIES[2];

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Campus Communications</h1>

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
                return (
                  <div
                    key={announcement.id}
                    className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-white text-xs font-medium ${catInfo.color}`}
                      >
                        {catInfo.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(announcement.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <h3 className="font-semibold text-gray-800 mb-1">{announcement.title}</h3>
                    <p className="text-gray-600 text-sm mb-2">{announcement.content}</p>
                    {announcement.expiresAt && (
                      <p className="text-xs text-gray-500 mb-2">
                        Expires: {new Date(announcement.expiresAt).toLocaleString()}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Read by {announcement.readCount} students</span>
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
    </div>
  );
}
