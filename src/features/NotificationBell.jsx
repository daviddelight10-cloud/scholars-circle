import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

const CATEGORIES = {
  IMPORTANT: { label: "Important", color: "bg-red-500", icon: "🔴" },
  LECTURES: { label: "Lectures", color: "bg-blue-500", icon: "📚" },
  GENERAL: { label: "General", color: "bg-green-500", icon: "📢" },
  UPDATE: { label: "Update", color: "bg-yellow-500", icon: "🔄" },
};

const PRIORITIES = {
  LOW: { label: "Low", color: "bg-gray-400" },
  NORMAL: { label: "Normal", color: "bg-blue-400" },
  HIGH: { label: "High", color: "bg-orange-500" },
  CRITICAL: { label: "Critical", color: "bg-red-600" },
};

export default function NotificationBell({ token, currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [announcements, setAnnouncements] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [dismissedPopupIds, setDismissedPopupIds] = useState(() => {
    const saved = localStorage.getItem("sc_dismissed_popups");
    return saved ? JSON.parse(saved) : [];
  });
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchAnnouncements();
    }
  }, [isOpen, token]);

  useEffect(() => {
    checkForNewAnnouncements();
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`${API_BASE}/announcements/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (err) {
      console.error("Failed to fetch unread count:", err);
    }
  };

  const fetchAnnouncements = async () => {
    setIsLoading(true);
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

  const checkForNewAnnouncements = async () => {
    try {
      const response = await fetch(`${API_BASE}/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        const unread = data.filter((a) => !a.isRead && !dismissedPopupIds.includes(a.id));
        if (unread.length > 0) {
          setShowPopup(true);
        }
      }
    } catch (err) {
      console.error("Failed to check for new announcements:", err);
    }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`${API_BASE}/announcements/${id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === id ? { ...a, isRead: true } : a))
      );
      fetchUnreadCount();
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const handleDismissPopup = (id) => {
    setDismissedPopupIds((prev) => {
      const updated = [...prev, id];
      localStorage.setItem("sc_dismissed_popups", JSON.stringify(updated));
      return updated;
    });
    setShowPopup(false);
  };

  const handleOpenComments = (announcement) => {
    setSelectedAnnouncement(announcement);
    setShowComments(true);
    setIsOpen(false);
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const response = await fetch(`${API_BASE}/announcements/${selectedAnnouncement.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: newComment }),
      });

      if (response.ok) {
        const comment = await response.json();
        setAnnouncements((prev) =>
          prev.map((a) =>
            a.id === selectedAnnouncement.id
              ? { ...a, comments: [...(a.comments || []), comment], commentCount: (a.commentCount || 0) + 1 }
              : a
          )
        );
        setSelectedAnnouncement((prev) => ({
          ...prev,
          comments: [...(prev.comments || []), comment],
          commentCount: (prev.commentCount || 0) + 1,
        }));
        setNewComment("");
      }
    } catch (err) {
      console.error("Failed to submit comment:", err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const getCategoryInfo = (cat) => CATEGORIES[cat] || CATEGORIES.GENERAL;
  const getPriorityInfo = (prio) => PRIORITIES[prio] || PRIORITIES.NORMAL;

  return (
    <>
      {/* Popup for new announcements */}
      {showPopup && announcements.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 animate-bounce-in">
            {announcements
              .filter((a) => !a.isRead && !dismissedPopupIds.includes(a.id))
              .slice(0, 1)
              .map((announcement) => {
                const catInfo = getCategoryInfo(announcement.category);
                const prioInfo = getPriorityInfo(announcement.priority);
                return (
                  <div key={announcement.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{catInfo.icon}</span>
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
                    <h3 className="text-lg font-bold text-gray-800 mb-2">{announcement.title}</h3>
                    <p className="text-gray-600 mb-4">{announcement.content}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          handleMarkAsRead(announcement.id);
                          handleDismissPopup(announcement.id);
                        }}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition"
                      >
                        Mark as Read
                      </button>
                      <button
                        onClick={() => {
                          handleOpenComments(announcement);
                          handleDismissPopup(announcement.id);
                        }}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
                      >
                        View & Comment
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Comments Modal */}
      {showComments && selectedAnnouncement && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-semibold text-gray-800">Announcement Comments</h3>
              <button
                onClick={() => setShowComments(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex gap-2 mb-2">
                  <span
                    className={`px-2 py-1 rounded-full text-white text-xs font-medium ${getCategoryInfo(selectedAnnouncement.category).color}`}
                  >
                    {getCategoryInfo(selectedAnnouncement.category).label}
                  </span>
                  <span
                    className={`px-2 py-1 rounded-full text-white text-xs font-medium ${getPriorityInfo(selectedAnnouncement.priority).color}`}
                  >
                    {getPriorityInfo(selectedAnnouncement.priority).label}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-800">{selectedAnnouncement.title}</h4>
                <p className="text-gray-600 text-sm mt-1">{selectedAnnouncement.content}</p>
              </div>

              <div className="space-y-3">
                {selectedAnnouncement.comments && selectedAnnouncement.comments.length > 0 ? (
                  selectedAnnouncement.comments.map((comment) => (
                    <div key={comment.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm text-gray-800">{comment.user?.username}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700">{comment.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-sm text-center py-4">No comments yet. Be the first to comment!</p>
                )}
              </div>
            </div>
            <div className="p-4 border-t border-gray-200">
              <form onSubmit={handleSubmitComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSubmittingComment}
                />
                <button
                  type="submit"
                  disabled={isSubmittingComment || !newComment.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 transition"
                >
                  {isSubmittingComment ? "..." : "Send"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-full hover:bg-gray-100 transition relative"
          title="Notifications"
        >
          <span className="text-2xl">🔔</span>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">Notifications</h3>
            </div>
            
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : announcements.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No notifications</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {announcements.map((announcement) => {
                  const catInfo = getCategoryInfo(announcement.category);
                  const prioInfo = getPriorityInfo(announcement.priority);
                  return (
                    <div
                      key={announcement.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition ${
                        !announcement.isRead ? "bg-blue-50" : ""
                      }`}
                      onClick={() => {
                        if (!announcement.isRead) {
                          handleMarkAsRead(announcement.id);
                        }
                        handleOpenComments(announcement);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{catInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span
                              className={`px-2 py-0.5 rounded text-white text-xs font-medium ${catInfo.color}`}
                            >
                              {catInfo.label}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-white text-xs font-medium ${prioInfo.color}`}
                            >
                              {prioInfo.label}
                            </span>
                            {!announcement.isRead && (
                              <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            )}
                          </div>
                          <h4 className="font-medium text-gray-800 text-sm truncate">
                            {announcement.title}
                          </h4>
                          <p className="text-gray-600 text-xs mt-1 line-clamp-2">
                            {announcement.content}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-xs text-gray-500">
                              {new Date(announcement.createdAt).toLocaleDateString()}
                            </span>
                            <span className="text-xs text-gray-500">
                              by {announcement.sender?.username}
                            </span>
                          </div>
                          {announcement.commentCount > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              💬 {announcement.commentCount} comment{announcement.commentCount !== 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
