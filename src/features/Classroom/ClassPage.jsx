import { useCallback, useEffect, useMemo, useState } from "react";
import { classroomApi } from "./classroomApi.js";
import { TodayTab } from "./TodayTab.jsx";
import { WorkTab } from "./WorkTab.jsx";
import { MaterialsTab } from "./MaterialsTab.jsx";
import { ManageTab } from "./ManageTab.jsx";
import { GroupView } from "../groups/GroupView.jsx";

const TABS = [
  { id: "today", icon: "☀️", label: "Today" },
  { id: "work", icon: "✅", label: "Work" },
  { id: "materials", icon: "📁", label: "Materials" },
  { id: "chat", icon: "💬", label: "Chat" },
];

/** Level 2 — inside one class. Four labeled tabs (+ Manage for the lecturer). */
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

  // Important announcements pop once until marked read (preserves old behaviour)
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
      <div className="cx-page">
        <div className="cx-page-head">
          <button className="cx-back" onClick={onBack} aria-label="Back to classes">‹</button>
          <div className="cx-page-name">{detail?.name || classroom.name}</div>
          {isHost && detail?.joinCode && (
            <button className="cx-btn ghost small" onClick={shareCode}>
              {copied ? "Copied ✓" : `Code ${detail.joinCode}`}
            </button>
          )}
        </div>
        <div className="cx-page-sub">{memberCount} member{memberCount === 1 ? "" : "s"}</div>

        <div className="cx-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`cx-tab${tab === t.id ? " active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
              {t.id === "today" && hasLive && <span className="cx-tab-dot" />}
            </button>
          ))}
        </div>

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
          <GroupView
            group={{ ...detail, kind: "classroom", isCreator: isHost, memberCount }}
            token={token}
            currentUser={currentUser}
            subjects={subjects}
            isFaculty={props.teacherMode}
            onBack={null}
          />
        )}
        {tab === "manage" && isHost && (
          <ManageTab
            classroom={detail}
            token={token}
            subjects={subjects}
            onImportQuestions={props.onImportQuestions}
            onChanged={load}
          />
        )}
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
