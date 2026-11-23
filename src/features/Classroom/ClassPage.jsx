import { useCallback, useEffect, useMemo, useState } from "react";
import { classroomApi, initials, classPalette } from "./classroomApi.js";
import { TodayTab } from "./TodayTab.jsx";
import { WorkTab } from "./WorkTab.jsx";
import { MaterialsTab } from "./MaterialsTab.jsx";
import { ManageTab } from "./ManageTab.jsx";
import { ClassChatTab } from "./ClassChatTab.jsx";

const TABS = [
  { id: "today", icon: "☀️", label: "Today" },
  { id: "work", icon: "✅", label: "Work" },
  { id: "materials", icon: "📁", label: "Materials" },
  { id: "chat", icon: "💬", label: "Chat" },
];

/** Level 2 — inside one class. Banner header + four labeled tabs (+ Manage). */
export function ClassPage(props) {
  const { classroom, attentionItems, attentionCounts, isHost, token, currentUser, subjects, onBack, onChanged } = props;
  const [detail, setDetail] = useState(classroom);
  const [tab, setTab] = useState("today");
  const [workFilter, setWorkFilter] = useState("all");
  const [popup, setPopup] = useState(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await classroomApi.get(classroom.id, token);
      setDetail(d);
    } catch { /* keep last good detail */ }
  }, [classroom.id, token]);

  useEffect(() => { load(); }, [load]);

  // Important announcements pop once until marked read
  useEffect(() => {
    const unread = (detail?.announcements || []).find((a) => a.isImportant && (!a.reads || a.reads.length === 0));
    if (unread && !popup) setPopup(unread);
  }, [detail?.announcements]); // eslint-disable-line react-hooks/exhaustive-deps

  const dismissPopup = async () => {
    if (!popup) return;
    try { await classroomApi.markRead(popup.id, token); } catch {}
    setPopup(null);
    load();
  };

  const tabs = useMemo(
    () => (isHost ? [...TABS, { id: "manage", icon: "🛠️", label: "Manage" }] : TABS),
    [isHost]
  );

  const hasLive = (attentionCounts.attendanceOpen || 0) > 0 || (attentionCounts.testsOpen || 0) > 0;
  const memberCount = detail?._count?.members ?? detail?.members?.length ?? 0;
  const [c1, c2] = classPalette(detail?.name || classroom.name);

  const goWork = (filter) => { setWorkFilter(filter); setTab("work"); };
  const shareCode = async () => {
    const code = detail?.joinCode;
    if (!code) return;
    try {
      if (navigator.share) await navigator.share({ title: detail.name, text: `Join my class "${detail.name}" on Scholar's Circle — code: ${code}` });
      else { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  };

  return (
    <div className="cx-root">
      <div className={`cx-page${tab === "chat" ? " chat-mode" : ""}`}>
        <div className="cx-banner" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
          <button className="cx-back" onClick={onBack} aria-label="Back to classes">‹</button>
          <div className="cx-banner-avatar">{initials(detail?.name)}</div>
          <div className="cx-banner-info">
            <div className="cx-banner-name">{detail?.name || classroom.name}</div>
            <div className="cx-banner-sub">
              {detail?.section ? `${detail.section} · ` : ""}{memberCount} member{memberCount === 1 ? "" : "s"}
              {detail?.lecturer?.name ? ` · ${detail.lecturer.name}` : ""}
            </div>
          </div>
          {isHost && detail?.joinCode && (
            <button className="cx-code-chip" onClick={shareCode} title="Share class code">
              {copied ? "✓ Copied" : `⌗ ${detail.joinCode}`}
            </button>
          )}
        </div>

        <div className="cx-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`cx-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <span className="cx-tab-ic">{t.icon}</span>{t.label}
              {t.id === "today" && hasLive && <span className="cx-tab-dot" />}
            </button>
          ))}
        </div>

        <div className="cx-body" key={tab}>
          {tab === "today" && (
            <TodayTab
              classroom={detail}
              attentionItems={attentionItems}
              isHost={isHost}
              token={token}
              onGoWork={goWork}
              onGoManage={() => setTab("manage")}
              onChanged={load}
              onRefreshAll={onChanged}
            />
          )}
          {tab === "work" && (
            <WorkTab
              classroom={detail}
              filter={workFilter}
              onFilter={setWorkFilter}
              isHost={isHost}
              teacherMode={props.teacherMode}
              token={token}
              subjects={subjects}
              currentUser={currentUser}
              assignments={props.assignments}
              onComplete={props.onComplete}
              onChanged={load}
            />
          )}
          {tab === "materials" && (
            <MaterialsTab classroom={detail} isHost={isHost} token={token} onChanged={load} />
          )}
          {tab === "chat" && (
            <ClassChatTab
              classroom={detail}
              memberCount={memberCount}
              token={token}
              currentUser={currentUser}
              isHost={isHost}
            />
          )}
          {tab === "manage" && isHost && (
            <ManageTab
              classroom={detail}
              token={token}
              subjects={subjects}
              onChanged={load}
            />
          )}
        </div>
      </div>

      {popup && (
        <div className="cx-modal" onClick={dismissPopup}>
          <div className="cx-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cx-modal-title">⚠️ {popup.title}</div>
            <div className="cx-panel-body" style={{ marginBottom: 4 }}>{popup.content}</div>
            <div className="cx-modal-actions">
              <button className="cx-btn" onClick={dismissPopup}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
