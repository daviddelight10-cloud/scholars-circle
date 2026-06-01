import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      "#07080F",
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NotificationsTab({ token, currentUser }) {
  const [unreadCount,          setUnreadCount]          = useState(0);
  const [announcements,        setAnnouncements]        = useState([]);
  const [isLoading,            setIsLoading]            = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [showComments,         setShowComments]         = useState(false);
  const [newComment,           setNewComment]           = useState("");
  const [isSubmittingComment,  setIsSubmittingComment]  = useState(false);
  const [activeTab,            setActiveTab]            = useState("all");

  useEffect(() => {
    fetchUnreadCount();
    fetchAnnouncements();
    const iv = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(iv);
  }, [token]);

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

  const handleOpenComments = (announcement) => {
    setSelectedAnnouncement(announcement);
    setShowComments(true);
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
        @keyframes scFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scSpin { to { transform: rotate(360deg); } }
        .sc-notif-scroll::-webkit-scrollbar { width: 6px; }
        .sc-notif-scroll::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
        .sc-notif-scroll::-webkit-scrollbar-thumb { background: rgba(61,126,255,0.3); border-radius: 10px; }
        .sc-notif-scroll::-webkit-scrollbar-thumb:hover { background: rgba(61,126,255,0.5); }
        .sc-notif-input::placeholder { color: #475569; }
        .sc-notif-row-unread { background: rgba(61,126,255,0.04) !important; border-color: rgba(61,126,255,0.15) !important; }
        .sc-notif-row:hover { background: #111220 !important; transform: translateX(4px); }
        .sc-notif-row { transition: all 0.2s ease; }
        .sc-notif-tab { 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          cursor: pointer; 
          position: relative;
          overflow: hidden;
        }
        .sc-notif-tab::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(61,126,255,0.15), transparent);
          transition: left 0.5s;
        }
        .sc-notif-tab:hover::before { left: 100%; }
        .sc-notif-tab:hover { 
          background: rgba(255,255,255,0.06) !important; 
          transform: translateY(-2px);
        }
        .sc-notif-tab-active { 
          background: rgba(61,126,255,0.15) !important; 
          border-color: rgba(61,126,255,0.4) !important; 
          color: #3D7EFF !important; 
          transform: scale(1.03);
          box-shadow: 0 4px 12px rgba(61,126,255,0.2);
        }
        .sc-notif-modal-overlay { 
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 20px;
          animation: scFadeIn 0.2s ease;
        }
        .sc-notif-modal { 
          background: #0D0E18;
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 22px;
          width: 100%;
          max-width: 580px;
          animation: scFadeIn 0.3s cubic-bezier(0.34,1.2,0.64,1) both;
        }
      `}</style>

      {/* ── Comments Modal ── */}
      {showComments && selectedAnnouncement && (() => {
        const a    = selectedAnnouncement;
        const cat  = getCat(a.category);
        const prio = getPrio(a.priority);
        return (
          <div className="sc-notif-modal-overlay" onClick={e => { if(e.target===e.currentTarget) setShowComments(false); }}>
            <div className="sc-notif-modal" style={{ display:"flex", flexDirection:"column", maxHeight:"82vh" }}>
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
              <div className="sc-notif-scroll" style={{ padding:"16px 22px", overflowY:"auto", flex:1, display:"flex", flexDirection:"column", gap:10 }}>
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
                    className="sc-notif-input"
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

      {/* ── Main Notifications View ── */}
      <div style={{ minHeight:"100vh", background:T.bg, padding:"20px", animation:"scFadeIn 0.4s ease" }}>
        <div style={{ maxWidth:1200, margin:"0 auto" }}>
          
          {/* Header */}
          <div style={{ marginBottom:32 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <div style={{ width:48, height:48, borderRadius:14, background:T.blueG, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>
                🔔
              </div>
              <div>
                <h1 style={{ fontFamily:T.syne, fontWeight:800, fontSize:32, color:T.text, margin:0, marginBottom:4 }}>Notifications</h1>
                <p style={{ fontFamily:T.body, fontSize:14, color:T.muted, margin:0 }}>Stay updated with announcements and important messages</p>
              </div>
            </div>

            {/* Action bar */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              {/* Tabs */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`sc-notif-tab${activeTab === tab.id ? " sc-notif-tab-active" : ""}`}
                    style={{
                      padding:"10px 18px",
                      borderRadius:12,
                      background: activeTab === tab.id ? "rgba(61,126,255,0.15)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${activeTab === tab.id ? "rgba(61,126,255,0.4)" : T.border}`,
                      color: activeTab === tab.id ? T.blue : T.muted,
                      fontFamily:T.mono,
                      fontSize:12,
                      fontWeight:600,
                      cursor:"pointer",
                      display:"flex",
                      alignItems:"center",
                      gap:6,
                      whiteSpace:"nowrap"
                    }}>
                    {tab.icon && <span style={{ fontSize:16 }}>{tab.icon}</span>}
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span style={{
                        background: activeTab === tab.id ? "rgba(61,126,255,0.25)" : "rgba(255,255,255,0.1)",
                        borderRadius:99,
                        padding:"2px 7px",
                        fontSize:10,
                        fontWeight:700
                      }}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Mark all as read */}
              {unreadCount > 0 && (
                <button onClick={handleMarkAllAsRead}
                  style={{ background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.3)", color:"#10B981", cursor:"pointer", padding:"10px 18px", borderRadius:12, fontSize:12, fontFamily:T.mono, fontWeight:600, transition:"all 0.2s", display:"flex", alignItems:"center", gap:6 }}
                  onMouseEnter={e=>{ e.currentTarget.style.background="rgba(16,185,129,0.18)"; e.currentTarget.style.transform="translateY(-2px)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.background="rgba(16,185,129,0.12)"; e.currentTarget.style.transform="translateY(0)"; }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Mark all as read
                </button>
              )}
            </div>
          </div>

          {/* Notifications list */}
          <div className="sc-notif-scroll" style={{ overflowY:"auto", maxHeight:"calc(100vh - 240px)" }}>
            {isLoading ? (
              <div style={{ display:"flex", justifyContent:"center", padding:"60px 0" }}>
                <div style={{ width:32, height:32, border:`3px solid rgba(61,126,255,0.3)`, borderTopColor:T.blue, borderRadius:"50%", animation:"scSpin 0.8s linear infinite" }} />
              </div>
            ) : filteredAnnouncements.length === 0 ? (
              <div style={{ textAlign:"center", padding:"80px 20px", color:T.dim }}>
                <div style={{ fontSize:64, marginBottom:16 }}>
                  {activeTab === "unread" ? "✅" : activeTab === "important" ? "⚠️" : activeTab === "lectures" ? "📚" : "🔔"}
                </div>
                <h3 style={{ fontFamily:T.syne, fontWeight:700, fontSize:20, color:T.muted, marginBottom:8 }}>
                  {activeTab === "unread" ? "All caught up!" : `No ${activeTab} notifications`}
                </h3>
                <p style={{ fontFamily:T.body, fontSize:14, color:T.dim }}>
                  {activeTab === "unread" ? "You've read all your notifications" : "Check back later for updates"}
                </p>
              </div>
            ) : Object.entries(groupedAnnouncements).map(([dateGroup, groupAnnouncements]) => (
              <div key={dateGroup} style={{ marginBottom:32 }}>
                {/* Date group header */}
                <div style={{ padding:"12px 0", marginBottom:12, position:"sticky", top:0, background:T.bg, zIndex:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted, letterSpacing:"0.1em", textTransform:"uppercase", fontWeight:700 }}>{dateGroup}</span>
                    <div style={{ flex:1, height:1, background:T.borderB }} />
                  </div>
                </div>

                {/* Notifications in this group */}
                <div style={{ display:"grid", gap:12 }}>
                  {groupAnnouncements.map((a) => {
                    const cat  = getCat(a.category);
                    const prio = getPrio(a.priority);
                    return (
                      <div key={a.id}
                        className={`sc-notif-row${!a.isRead?" sc-notif-row-unread":""}`}
                        onClick={() => { if(!a.isRead) handleMarkAsRead(a.id); handleOpenComments(a); }}
                        style={{ 
                          padding:"20px", 
                          background:T.card, 
                          border:`1px solid ${T.border}`, 
                          borderRadius:16, 
                          cursor:"pointer", 
                          display:"flex", 
                          gap:16
                        }}>

                        {/* Category icon */}
                        <div style={{ width:48, height:48, borderRadius:12, background:cat.bg, border:`1px solid ${cat.border}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                          {cat.icon}
                        </div>

                        <div style={{ flex:1, minWidth:0 }}>
                          {/* Badges row */}
                          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10, alignItems:"center" }}>
                            <Badge label={cat.label}  color={cat.color}  bg={cat.bg}  border={cat.border}  />
                            <Badge label={prio.label} color={prio.color} bg={prio.bg} border={prio.border} />
                            {!a.isRead && (
                              <div style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 8px", borderRadius:99, background:"rgba(61,126,255,0.15)", border:"1px solid rgba(61,126,255,0.3)" }}>
                                <div style={{ width:6, height:6, borderRadius:"50%", background:T.blue, boxShadow:`0 0 6px ${T.blue}` }} />
                                <span style={{ fontFamily:T.mono, fontSize:9, color:T.blue, fontWeight:700, letterSpacing:"0.05em" }}>NEW</span>
                              </div>
                            )}
                          </div>

                          {/* Title */}
                          <h3 style={{ fontFamily:T.syne, fontWeight:700, fontSize:16, color:T.text, marginBottom:8, lineHeight:1.3 }}>{a.title}</h3>

                          {/* Content preview */}
                          <p style={{ color:T.muted, fontSize:14, lineHeight:1.6, marginBottom:12 }}>{a.content}</p>

                          {/* Meta row */}
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <span style={{ fontFamily:T.mono, fontSize:11, color:T.dim, display:"flex", alignItems:"center", gap:4 }}>
                                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                                {new Date(a.createdAt).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}
                              </span>
                              {a.sender?.username && (
                                <span style={{ fontFamily:T.mono, fontSize:11, color:T.dim, display:"flex", alignItems:"center", gap:4 }}>
                                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                                  {a.sender.username}
                                </span>
                              )}
                            </div>
                            {a.commentCount > 0 && (
                              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:8, background:"rgba(255,255,255,0.04)", border:`1px solid ${T.borderB}` }}>
                                <svg width="13" height="13" fill="none" stroke={T.muted} strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                                <span style={{ fontFamily:T.mono, fontSize:11, color:T.muted, fontWeight:600 }}>{a.commentCount}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
