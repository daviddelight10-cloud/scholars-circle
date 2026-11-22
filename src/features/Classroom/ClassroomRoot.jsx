import { useCallback, useEffect, useMemo, useState } from "react";
import { classroomApi } from "./classroomApi.js";
import { ClassList } from "./ClassList.jsx";
import { ClassPage } from "./ClassPage.jsx";
import "./classroom.css";

const LAST_CLASS_KEY = "sc_last_class";

/**
 * Classroom root: a simple list of your classes → a class page.
 * Replaces the old sidebar / icon-rail / six-tab layout. Props are unchanged
 * from the old <Classroom> so pages/Classroom.jsx (student app + faculty
 * portal) keeps working.
 */
export function ClassroomRoot(props) {
  const { token, teacherMode, currentUser } = props;
  const [classes, setClasses] = useState(null);
  const [attention, setAttention] = useState({ byClass: {}, items: [] });
  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(LAST_CLASS_KEY) || null; } catch { return null; }
  });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [mine, attn] = await Promise.all([
        classroomApi.my(token),
        classroomApi.attention(token).catch(() => ({ byClass: {}, items: [] })),
      ]);
      setClasses(mine || []);
      setAttention(attn || { byClass: {}, items: [] });
    } catch {
      setClasses((c) => c ?? []);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(() => {
      classroomApi.attention(token).then(setAttention).catch(() => {});
    }, 45000);
    return () => clearInterval(t);
  }, [token]);

  const selected = useMemo(
    () => (classes || []).find((c) => c.id === selectedId) || null,
    [classes, selectedId]
  );

  const openClass = (id) => {
    setSelectedId(id);
    try { localStorage.setItem(LAST_CLASS_KEY, id); } catch {}
  };
  const closeClass = () => {
    setSelectedId(null);
    try { localStorage.removeItem(LAST_CLASS_KEY); } catch {}
  };

  const meId = currentUser?.id || currentUser?.sub;

  if (loading) {
    return (
      <div className="cx-root">
        <div className="cx-head"><div className="cx-title">🏫 Classroom</div></div>
        <div className="cx-empty"><div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} /><div className="cx-empty-sub">Loading your classes…</div></div>
      </div>
    );
  }

  if (selected) {
    return (
      <ClassPage
        {...props}
        classroom={selected}
        attentionItems={attention.items?.filter((i) => i.classroomId === selected.id) || []}
        attentionCounts={attention.byClass?.[selected.id] || {}}
        isHost={teacherMode && selected.createdById === meId}
        onBack={closeClass}
        onChanged={load}
      />
    );
  }

  return (
    <ClassList
      classes={classes || []}
      attention={attention.byClass || {}}
      teacherMode={teacherMode}
      token={token}
      subjects={props.subjects}
      onOpen={openClass}
      onChanged={load}
    />
  );
}
