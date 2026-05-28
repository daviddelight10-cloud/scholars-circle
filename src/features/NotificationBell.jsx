import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

const CATEGORIES = {
  IMPORTANT: { label: "Important", color: "bg-red-500", icon: "🔴" },
  LECTURES: { label: "Lectures", color: "bg-blue-500", icon: "📚" },
  GENERAL: { label: "General", color: "bg-green-500", icon: "📢" },
  UPDATE: { label: "Update", color: "bg-yellow-500", icon: "🔄" },
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

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (isOpen) {
      fetchAnnouncements();
    }
  }, [isOpen, token]);

  useEffect(() => {
    // Check for new unread announcements on mount
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

  const getCategoryInfo = (cat) => CATEGORIES[cat] || CATEGORIES.GENERAL;

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
                return (
                  <div key={announcement.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-2xl">{catInfo.icon}</span>
                      <span
                        className={`px-3 py-1 rounded-full text-white text-xs font-medium ${catInfo.color}`}
                      >
                        {catInfo.label}
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
                        onClick={() => handleDismissPopup(announcement.id)}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg font-medium hover:bg-gray-300 transition"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 rounded-full hover:bg-gray-100 transition relative"
        >
          <svg
            className="w-6 h-6 text-gray-700"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
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
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{catInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-white text-xs font-medium ${catInfo.color}`}
                            >
                              {catInfo.label}
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
