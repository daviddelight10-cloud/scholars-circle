import React, { useState, useEffect } from "react";
import { API_BASE } from "../lib/constants";


// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#0A0D13",
  card:    "#0D0E18",
  cardHov: "#111220",
  border:  "rgba(255,255,255,0.07)",
  borderB: "rgba(255,255,255,0.04)",
  blue:    "#3D7EFF",
  blueG:   "linear-gradient(135deg,#3D7EFF,#6E4AFF)",
  text:    "#F1F5F9",
  muted:   "#64748B",
  dim:     "#334155",
  syne:    "Syne,sans-serif",
  mono:    "JetBrains Mono,monospace",
  body:    "Manrope,sans-serif",
};

const CATEGORIES = {
  IMPORTANT: { label:"Important", color:"#EF4444", bg:"rgba(239,68,68,0.12)",  border:"rgba(239,68,68,0.3)",  dot:"#EF4444", icon:"⚠️" },
  LECTURES:  { label:"Lectures",  color:"#3D7EFF", bg:"rgba(61,126,255,0.12)", border:"rgba(61,126,255,0.3)", dot:"#3D7EFF", icon:"📚" },
  GENERAL:   { label:"General",   color:"#10B981", bg:"rgba(16,185,129,0.12)", border:"rgba(16,185,129,0.3)", dot:"#10B981", icon:"📢" },
  UPDATE:    { label:"Update",    color:"#F5A623", bg:"rgba(245,166,35,0.12)", border:"rgba(245,166,35,0.3)", dot:"#F5A623", icon:"🔔" },
};

const PRIORITIES = {
  LOW:      { label:"Low",      color:"#64748B", bg:"rgba(100,116,139,0.12)", border:"rgba(100,116,139,0.3)" },
  NORMAL:   { label:"Normal",   color:"#3D7EFF", bg:"rgba(61,126,255,0.12)",  border:"rgba(61,126,255,0.3)"  },
  HIGH:     { label:"High",     color:"#F5A623", bg:"rgba(245,166,35,0.12)",  border:"rgba(245,166,35,0.3)"  },
  CRITICAL: { label:"Critical", color:"#EF4444", bg:"rgba(239,68,68,0.12)",   border:"rgba(239,68,68,0.3)"   },
};

const getCat  = (v) => CATEGORIES[v] || CATEGORIES.GENERAL;
const getPrio = (v) => PRIORITIES[v]  || PRIORITIES.NORMAL;

// ─── Shared atoms ─────────────────────────────────────────────────────────────
function Badge({ label, color, bg, border }) {
  return (
    <span style={{ padding:"2px 9px", borderRadius:999, fontSize:10, fontFamily:T.mono, fontWeight:600, color, background:bg, border:`1px solid ${border}`, letterSpacing:"0.04em", whiteSpace:"nowrap" }}>
      {label}
    </span>
  );
}

function CategoryDot({ cat }) {
  const info = getCat(cat);
  return (
    <div style={{ width:8, height:8, borderRadius:"50%", background:info.dot, boxShadow:`0 0 6px ${info.dot}`, flexShrink:0, marginTop:4 }} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NotificationBellImproved({ token, currentUser, onOpenTab }) {
  const [isOpen,               setIsOpen]               = useState(false);
  const [unreadCount,          setUnreadCount]          = useState(0);
  const [announcements,        setAnnouncements]        = useState([]);
  const [isLoading,            setIsLoading]            = useState(false);
  const [showPopup,            setShowPopup]            = useState(false);
  const [dismissedPopupIds,    setDismissedPopupIds]    = useState(() => {
    try { return JSON.parse(localStorage.getItem("sc_dismissed_popups") || "[]"); } catch { return []; }
  });
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showComments,         setShowComments]         = useState(false);
  const [newComment,           setNewComment]           = useState("");
  const [isSubmittingComment,  setIsSubmittingComment]  = useState(false);
  const [activeTab,            setActiveTab]            = useState("all"); // all, unread, important, lectures, general, update

  useEffect(() => {
    fetchUnreadCount();
    const iv = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => { if (isOpen) fetchAnnouncements(); }, [isOpen, token]);
  useEffect(() => { checkForNewAnnouncements(); }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.sc-nb-dropdown') && !e.target.closest('.sc-nb-bell-btn')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const r = await fetch(`${API_BASE}/announcements/unread-count`, { headers:{ Authorization:`Bearer ${token}` } });
      if (r.ok) { const d = await r.json(); setUnreadCount(d.count); }
    } catch(e) { console.error(e); }
  };

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const r = await fetch(`${API_BASE}/announcements`, { headers:{ Authorization:`Bearer ${token}` } });
      if (r.ok) setAnnouncements(await r.json());
    } catch(e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  const checkForNewAnnouncements = async () => {
    try {
      const r = await fetch(`${API_BASE}/announcements`, { headers:{ Authorization:`Bearer ${token}` } });
      if (r.ok) {
        const data = await r.json();
        if (data.some(a => !a.isRead && !dismissedPopupIds.includes(a.id))) setShowPopup(true);
      }
    } catch(e) { console.error(e); }
  };

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`${API_BASE}/announcements/${id}/read`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } });
      setAnnouncements(p => p.map(a => a.id === id ? { ...a, isRead:true } : a));
      fetchUnreadCount();
    } catch(e) { console.error(e); }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = announcements.filter(a => !a.isRead).map(a => a.id);
      await Promise.all(unreadIds.map(id => 
        fetch(`${API_BASE}/announcements/${id}/read`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } })
      ));
      setAnnouncements(p => p.map(a => ({ ...a, isRead:true })));
      fetchUnreadCount();
    } catch(e) { console.error(e); }
  };

  const handleDismissPopup = (id) => {
    setDismissedPopupIds(p => {
      const u = [...p, id];
      localStorage.setItem("sc_dismissed_popups", JSON.stringify(u));
      return u;
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
      const r = await fetch(`${API_BASE}/announcements/${selectedAnnouncement.id}/comments`, {
        method:"POST",
        headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ content: newComment }),
      });
      if (r.ok) {
        const comment = await r.json();
        const update = a => ({ ...a, comments:[...(a.comments||[]), comment], commentCount:(a.commentCount||0)+1 });
        setAnnouncements(p => p.map(a => a.id === selectedAnnouncement.id ? update(a) : a));
        setSelectedAnnouncement(p => update(p));
        setNewComment("");
      }
    } catch(e) { console.error(e); }
    finally { setIsSubmittingComment(false); }
  };

  // Filter announcements based on active tab
  const filteredAnnouncements = announcements.filter(a => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !a.isRead;
    if (activeTab === "important") return a.category === "IMPORTANT";
    if (activeTab === "lectures") return a.category === "LECTURES";
    if (activeTab === "general") return a.category === "GENERAL";
    if (activeTab === "update") return a.category === "UPDATE";
    return true;
  });

  // Group announcements by date
  const groupedAnnouncements = filteredAnnouncements.reduce((groups, announcement) => {
    const date = new Date(announcement.createdAt);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let groupKey;
    if (date.toDateString() === today.toDateString()) {
      groupKey = "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = "Yesterday";
    } else {
      groupKey = date.toLocaleDateString(undefined, { month: "long", day: "numeric" });
    }
    
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(announcement);
    return groups;
  }, {});

  // popup announcement (first unread, undismissed)
  const popupAnnouncement = announcements.find(a => !a.isRead && !dismissedPopupIds.includes(a.id));

  const tabs = [
    { id: "all", label: "All", count: announcements.length },
    { id: "unread", label: "Unread", count: announcements.filter(a => !a.isRead).length },
    { id: "important", label: "Important", icon: "⚠️", count: announcements.filter(a => a.category === "IMPORTANT").length },
    { id: "lectures", label: "Lectures", icon: "📚", count: announcements.filter(a => a.category === "LECTURES").length },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes scSlideDown { 
          from { 
            opacity: 0; 
            transform: translateY(-20px) scale(0.95); 
          } 
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          } 
        }
        @keyframes scSlideIn  { from{opacity:0;transform:scale(0.95) translateY(8px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes scPulse    { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 50%{box-shadow:0 0 0 6px rgba(239,68,68,0)} }
        @keyframes scSpin     { to{transform:rotate(360deg)} }
        @keyframes scBounceIn { 
          0% { transform: scale(0.9); opacity: 0; }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
        .sc-nb-scroll::-webkit-scrollbar { width:3px; }
        .sc-nb-scroll::-webkit-scrollbar-thumb { background:rgba(61,126,255,0.2); border-radius:99px; }
        .sc-nb-input::placeholder { color:#1E293B; }
        .sc-nb-overlay { position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:9998;padding:20px; }
        .sc-nb-modal  { background:#0D0E18;border:1px solid rgba(255,255,255,0.07);border-radius:22px;width:100%;max-width:520px;animation:scSlideIn 0.3s cubic-bezier(0.34,1.2,0.64,1) both; }
        .sc-nb-row-unread { background:rgba(61,126,255,0.04) !important; border-color:rgba(61,126,255,0.1) !important; }
        .sc-nb-row:hover { background:#111220 !important; }
        .sc-nb-tab { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
          position: relative;
          overflow: hidden;
        }
        .sc-nb-tab::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(61,126,255,0.1), transparent);
          transition: left 0.5s;
        }
        .sc-nb-tab:hover::before {
          left: 100%;
        }
        .sc-nb-tab:hover { 
          background: rgba(255,255,255,0.05) !important; 
          transform: translateY(-1px);
        }
        .sc-nb-tab-active { 
          background: rgba(61,126,255,0.12) !important; 
          border-color: rgba(61,126,255,0.3) !important; 
          color: #3D7EFF !important; 
          transform: scale(1.02);
        }
        .sc-nb-dropdown { 
          animation: scSlideDown 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @media (max-width: 768px) {
          .sc-nb-dropdown { 
            right: 10px !important; 
            left: 10px !important; 
            width: auto !important; 
          }
        }
      `}</style>

      {/* ── New Announcement Popup ── */}
      {showPopup && popupAnnouncement && (() => {
        const a    = popupAnnouncement;
        const cat  = getCat(a.category);
        const prio = getPrio(a.priority);
        return (
          <div className="sc-nb-overlay" onClick={e => { if(e.target===e.currentTarget) handleDismissPopup(a.id); }}>
            <div className="sc-nb-modal" style={{ padding:28, maxWidth:420 }}>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:38, height:38, borderRadius:12, background:cat.bg, border:`1px solid ${cat.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>
                    {cat.icon}
                  </div>
                  <div>
                    <p style={{ fontFamily:T.mono, fontSize:10, color:T.muted, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:2 }}>New Announcement</p>
                    <div style={{ display:"flex", gap:6 }}>
                      <Badge label={cat.label}  color={cat.color}  bg={cat.bg}  border={cat.border}  />
                      <Badge label={prio.label} color={prio.color} bg={prio.bg} border={prio.border} />
                    </div>
                  </div>
                </div>
                <button onClick={() => handleDismissPopup(a.id)}
                  style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", padding:4, lineHeight:0, borderRadius:8, transition:"color 0.2s" }}
                  onMouseEnter={e=>e.currentTarget.style.color=T.muted}
                  onMouseLeave={e=>e.currentTarget.style.color=T.dim}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Content */}
              <h3 style={{ fontFamily:T.syne, fontWeight:800, fontSize:18, color:T.text, marginBottom:10, lineHeight:1.2 }}>{a.title}</h3>
              <p style={{ color:T.muted, fontSize:14, lineHeight:1.72, marginBottom:22 }}>{a.content}</p>

              {/* Expiry */}
              {a.expiresAt && (
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:20, padding:"7px 12px", borderRadius:10, background:"rgba(245,166,35,0.07)", border:"1px solid rgba(245,166,35,0.18)" }}>
                  <svg width="12" height="12" fill="none" stroke="#F5A623" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                  <span style={{ fontFamily:T.mono, fontSize:10, color:"#F5A623" }}>Expires {new Date(a.expiresAt).toLocaleDateString()}</span>
                </div>
              )}

              {/* Actions */}
              <div style={{ display:"flex", gap:10 }}>
                <button
                  onClick={() => { handleMarkAsRead(a.id); handleDismissPopup(a.id); }}
                  style={{ flex:1, padding:"12px", borderRadius:13, background:T.blueG, border:"none", color:"#fff", fontFamily:T.syne, fontWeight:700, fontSize:14, cursor:"pointer", boxShadow:"0 0 20px rgba(61,126,255,0.25)", transition:"transform 0.2s" }}
                  onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                  onMouseLeave={e=>e.currentTarget.style.transform="translateY(0)"}>
                  Mark as Read
                </button>
                <button
                  onClick={() => { handleOpenComments(a); handleDismissPopup(a.id); }}
                  style={{ flex:1, padding:"12px", borderRadius:13, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, color:T.muted, fontFamily:T.syne, fontWeight:700, fontSize:14, cursor:"pointer", transition:"all 0.2s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.07)"; e.currentTarget.style.color=T.text; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.color=T.muted; }}>
                  View & Comment
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Comments Modal ── */}
      {showComments && selectedAnnouncement && (() => {
        const a    = selectedAnnouncement;
        const cat  = getCat(a.category);
        const prio = getPrio(a.priority);
        return (
          <div className="sc-nb-overlay" onClick={e => { if(e.target===e.currentTarget) setShowComments(false); }}>
            <div className="sc-nb-modal" style={{ maxWidth:580, display:"flex", flexDirection:"column", maxHeight:"82vh" }}>

              {/* Modal header */}
              <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.borderB}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ width:3, height:16, background:T.blueG, borderRadius:2 }} />
                  <h3 style={{ fontFamily:T.syne, fontWeight:700, fontSize:15, color:T.text, margin:0 }}>Discussion</h3>
                </div>
                <button onClick={()=>setShowComments(false)}
                  style={{ background:"none", border:"none", color:T.dim, cursor:"pointer", padding:6, lineHeight:0, borderRadius:9, transition:"color 0.2s,background 0.2s" }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.05)"; e.currentTarget.style.color=T.text; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="none"; e.currentTarget.style.color=T.dim; }}>
                  <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>

              {/* Announcement summary */}
              <div style={{ padding:"18px 22px", borderBottom:`1px solid ${T.borderB}`, flexShrink:0 }}>
                <div style={{ display:"flex", gap:6, marginBottom:10 }}>
                  <Badge label={cat.label}  color={cat.color}  bg={cat.bg}  border={cat.border}  />
                  <Badge label={prio.label} color={prio.color} bg={prio.bg} border={prio.border} />
                </div>
                <h4 style={{ fontFamily:T.syne, fontWeight:700, fontSize:15, color:T.text, marginBottom:6 }}>{a.title}</h4>
                <p style={{ color:T.muted, fontSize:13, lineHeight:1.7 }}>{a.content}</p>
              </div>

              {/* Comments list */}
              <div className="sc-nb-scroll" style={{ padding:"16px 22px", overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
                {(a.comments && a.comments.length > 0) ? a.comments.map((c) => (
                  <div key={c.id} style={{ background:"rgba(255,255,255,0.025)", border:`1px solid ${T.borderB}`, borderRadius:13, padding:"12px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                      <div style={{ width:28, height:28, borderRadius:"50%", background:T.blueG, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:T.syne, fontWeight:700, fontSize:11, color:"#fff", flexShrink:0 }}>
                        {(c.user?.username||"?")[0].toUpperCase()}
                      </div>
                      <span style={{ fontFamily:T.syne, fontWeight:700, fontSize:13, color:T.text }}>{c.user?.username}</span>
                      <span style={{ fontFamily:T.mono, fontSize:10, color:T.dim, marginLeft:"auto" }}>
                        {new Date(c.createdAt).toLocaleDateString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}
                      </span>
                    </div>
                    <p style={{ color:T.muted, fontSize:13, lineHeight:1.65 }}>{c.content}</p>
                  </div>
                )) : (
                  <div style={{ textAlign:"center", padding:"32px 20px", color:T.dim }}>
                    <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
                    <p style={{ fontFamily:T.mono, fontSize:12 }}>No comments yet. Be the first!</p>
                  </div>
                )}
              </div>

              {/* Comment input */}
              <div style={{ padding:"14px 22px", borderTop:`1px solid ${T.borderB}`, flexShrink:0 }}>
                <form onSubmit={handleSubmitComment} style={{ display:"flex", gap:10 }}>
                  <input
                    className="sc-nb-input"
                    type="text" value={newComment} onChange={e=>setNewComment(e.target.value)}
                    placeholder="Add a comment..." disabled={isSubmittingComment}
                    style={{ flex:1, background:"rgba(255,255,255,0.03)", border:`1px solid ${T.border}`, borderRadius:12, padding:"10px 14px", fontSize:14, fontFamily:T.body, color:T.text, outline:"none", transition:"border-color 0.2s" }}
                    onFocus={e=>e.target.style.borderColor=T.blue}
                    onBlur={e=>e.target.style.borderColor=T.border}
                  />
                  <button type="submit" disabled={isSubmittingComment || !newComment.trim()}
                    style={{ padding:"10px 18px", borderRadius:12, background: (isSubmittingComment||!newComment.trim()) ? "rgba(61,126,255,0.3)" : T.blueG, border:"none", color:"#fff", fontFamily:T.syne, fontWeight:700, fontSize:13, cursor:(isSubmittingComment||!newComment.trim())?"not-allowed":"pointer", transition:"all 0.2s", boxShadow:(isSubmittingComment||!newComment.trim())?"none":"0 0 14px rgba(61,126,255,0.25)", display:"flex", alignItems:"center", gap:6 }}>
                    {isSubmittingComment
                      ? <div style={{ width:13, height:13, border:"2px solid rgba(255,255,255,0.4)", borderTopColor:"#fff", borderRadius:"50%", animation:"scSpin 0.8s linear infinite" }} />
                      : <><svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg> Send</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Bell Button + Dropdown ── */}
      <div style={{ position:"relative" }}>

        {/* Bell */}
        <button onClick={()=>onOpenTab?.('notifications')} aria-label={`Notifications${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`} className="sc-nb-bell-btn"
          style={{ position:"relative", width:40, height:40, borderRadius:13, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.border}`, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", transition:"all 0.2s", outline:"none" }}
          onMouseEnter={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.07)"; e.currentTarget.style.borderColor="rgba(255,255,255,0.12)"; }}
          onMouseLeave={e=>{ e.currentTarget.style.background="rgba(255,255,255,0.04)"; e.currentTarget.style.borderColor=T.border; }}>

          {/* Bell icon */}
          <svg width="17" height="17" fill="none" stroke={isOpen?T.blue:T.muted} strokeWidth={1.8} viewBox="0 0 24 24" style={{ transition:"stroke 0.2s" }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <div style={{ position:"absolute", top:-4, right:-4, minWidth:18, height:18, borderRadius:999, background:"#EF4444", border:"2px solid #0A0D13", display:"flex", alignItems:"center", justifyContent:"center", animation:"scPulse 2s ease-in-out infinite" }}>
              <span style={{ fontFamily:T.mono, fontSize:9, fontWeight:700, color:"#fff", lineHeight:1 }}>{unreadCount>9?"9+":unreadCount}</span>
            </div>
          )}
        </button>

      </div>
    </>
  );
}
