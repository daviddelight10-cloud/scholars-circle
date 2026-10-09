import { useCallback, useEffect, useRef, useState } from "react";
import { useOverlayBackClose } from "../hooks/useOverlayBackClose.js";
import {
  X, Gem, Stethoscope, Pill, FlaskConical, Calculator, ChevronRight,
  BarChart3, CalendarDays, User, Settings, Gift,
  BookOpen, School, GraduationCap, FileText, Laptop, Megaphone,
  Building2, KeyRound, Mail, Cog,
} from "lucide-react";

const CLOSE_ANIMATION_MS = 240;
const DISMISS_DISTANCE_PX = 90;
const DISMISS_VELOCITY_PX_PER_MS = 0.4;

/**
 * Mobile "More" bottom sheet. Owns its open/close lifecycle:
 * plays the exit animation first, then calls onClose so the parent
 * unmounts it. Drag-to-dismiss works from the grip/handle zone so it
 * never fights with content scrolling.
 */
export default function MoreSheet({ tab, onNavigate, onClose, isFaculty, isTeacher, isActivated }) {
  const [closing, setClosing] = useState(false);
  const [entered, setEntered] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);
  const closeBtnRef = useRef(null);

  const close = useCallback(() => setClosing(true), []);

  // Device/browser back button dismisses the sheet (with exit animation)
  // instead of leaving the app.
  const { close: backClose, isTop } = useOverlayBackClose(close);

  // Let the exit animation finish before the parent unmounts us
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(onClose, CLOSE_ANIMATION_MS + 60);
    return () => clearTimeout(t);
  }, [closing, onClose]);

  // Esc to close, body scroll lock, focus the close button for a11y
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && isTop()) backClose(); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [backClose, isTop]);

  const go = useCallback((next) => {
    onNavigate(next);
    close();
  }, [onNavigate, close]);

  // Pointer drag on the grip zone (handle + header). Buttons are ignored
  // so the close button still gets its click.
  const onPointerDown = (e) => {
    if (closing || e.target.closest("button")) return;
    dragRef.current = {
      startY: e.clientY,
      prevY: e.clientY,
      prevT: performance.now(),
      velocity: 0,
      dy: 0,
    };
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const now = performance.now();
    const dt = now - d.prevT;
    if (dt > 0) d.velocity = (e.clientY - d.prevY) / dt;
    d.prevY = e.clientY;
    d.prevT = now;
    d.dy = Math.max(0, e.clientY - d.startY);
    setDragY(d.dy);
  };

  const onPointerEnd = () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDragging(false);
    setDragY(0);
    if (d.dy > DISMISS_DISTANCE_PX || d.velocity > DISMISS_VELOCITY_PX_PER_MS) close();
  };

  const scrimStyle = dragY > 0 ? { opacity: Math.max(0, 1 - dragY / 350) } : undefined;
  const sheetStyle = dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined;

  return (
    <div className={`mm-overlay${closing ? " closing" : ""}`} style={scrimStyle} onClick={close}>
      <div
        className={`mm-sheet${closing ? " closing" : ""}${dragging ? " dragging" : ""}${entered ? "" : " entering"}`}
        style={sheetStyle}
        onAnimationEnd={(e) => {
          if (e.target === e.currentTarget && e.animationName === "mmSlideUp") setEntered(true);
        }}
        role="dialog"
        aria-modal="true"
        aria-label="More"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mm-grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div className="mm-handle" />
          <div className="mm-head">
            <h1>More</h1>
            <button
              ref={closeBtnRef}
              className="mm-close"
              type="button"
              aria-label="Close menu"
              onClick={close}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {!isFaculty && !isActivated && (
          <button className="mm-premium" type="button" onClick={() => go("premium")}>
            <span className="mm-premium-ic"><Gem size={22} /></span>
            <span className="mm-premium-copy"><b>Go Premium</b><span>Unlock every study tool</span></span>
            <ChevronRight size={18} />
          </button>
        )}

        {/* Medical tools — 2-col tile grid */}
        <section className="mm-group">
          <div className="mm-label">Medical tools</div>
          <div className="mm-grid">
            <button className={`mm-tile${tab === "clinical-cases" ? " active" : ""}`} type="button" onClick={() => go("clinical-cases")}>
              <span className="mm-tile-ic"><Stethoscope size={18} /></span>
              <span className="mm-tile-txt"><b>Clinical Cases</b><span>Case practice</span></span>
            </button>
            <button className={`mm-tile${tab === "drug-ref" ? " active" : ""}`} type="button" onClick={() => go("drug-ref")}>
              <span className="mm-tile-ic"><Pill size={18} /></span>
              <span className="mm-tile-txt"><b>Drug Reference</b><span>Look up drugs</span></span>
            </button>
            <button className={`mm-tile${tab === "lab-values" ? " active" : ""}`} type="button" onClick={() => go("lab-values")}>
              <span className="mm-tile-ic"><FlaskConical size={18} /></span>
              <span className="mm-tile-txt"><b>Lab Values</b><span>Normal ranges</span></span>
            </button>
            <button className={`mm-tile${tab === "medical-calculators" ? " active" : ""}`} type="button" onClick={() => go("medical-calculators")}>
              <span className="mm-tile-ic"><Calculator size={18} /></span>
              <span className="mm-tile-txt"><b>Med Calculators</b><span>Dosing &amp; scores</span></span>
            </button>
          </div>
        </section>

        {/* Tools — list rows */}
        <section className="mm-group">
          <div className="mm-label">Tools</div>
          <div className="mm-list">
            <button className={`mm-row${["analytics", "leaderboard", "achievements", "gamification"].includes(tab) ? " active" : ""}`} type="button" onClick={() => go("analytics")}>
              <BarChart3 size={20} /><span>Progress</span><ChevronRight className="mm-chev" size={16} />
            </button>
            <button className={`mm-row${tab === "timetable" ? " active" : ""}`} type="button" onClick={() => go("timetable")}>
              <CalendarDays size={20} /><span>Schedule</span><ChevronRight className="mm-chev" size={16} />
            </button>
          </div>
        </section>

        {/* Account — list rows */}
        <section className="mm-group">
          <div className="mm-label">Account</div>
          <div className="mm-list">
            <button className={`mm-row${tab === "profile" ? " active" : ""}`} type="button" onClick={() => go("profile")}>
              <User size={20} /><span>Profile</span><ChevronRight className="mm-chev" size={16} />
            </button>
            <button className={`mm-row${tab === "settings" ? " active" : ""}`} type="button" onClick={() => go("settings")}>
              <Settings size={20} /><span>Settings</span><ChevronRight className="mm-chev" size={16} />
            </button>
            {!isFaculty && (
              <button className={`mm-row${tab === "refer" ? " active" : ""}`} type="button" onClick={() => go("refer")}>
                <Gift size={20} /><span>Refer &amp; Earn</span><ChevronRight className="mm-chev" size={16} />
              </button>
            )}
          </div>
        </section>

        {/* Faculty-only sections — same list style */}
        {isFaculty && (
          <>
            <section className="mm-group">
              <div className="mm-label">Study resources</div>
              <div className="mm-list">
                <button className={`mm-row${tab === "resources" ? " active" : ""}`} type="button" onClick={() => go("resources")}>
                  <BookOpen size={20} /><span>Resources</span><ChevronRight className="mm-chev" size={16} />
                </button>
              </div>
            </section>

            <section className="mm-group">
              <div className="mm-label">Classroom &amp; community</div>
              <div className="mm-list">
                <button className={`mm-row${tab === "classroom" ? " active" : ""}`} type="button" onClick={() => go("classroom")}>
                  <School size={20} /><span>Classroom</span><ChevronRight className="mm-chev" size={16} />
                </button>
                <button className={`mm-row${tab === "lecturers" ? " active" : ""}`} type="button" onClick={() => go("lecturers")}>
                  <GraduationCap size={20} /><span>Lecturers</span><ChevronRight className="mm-chev" size={16} />
                </button>
              </div>
            </section>

            <section className="mm-group">
              <div className="mm-label">Faculty tools</div>
              <div className="mm-list">
                <button className={`mm-row${tab === "teacher-questions" ? " active" : ""}`} type="button" onClick={() => go("teacher-questions")}>
                  <FileText size={20} /><span>My Questions</span><ChevronRight className="mm-chev" size={16} />
                </button>
                <button className={`mm-row${tab === "teacher-resources" ? " active" : ""}`} type="button" onClick={() => go("teacher-resources")}>
                  <Laptop size={20} /><span>Teacher Resources</span><ChevronRight className="mm-chev" size={16} />
                </button>
                <button className={`mm-row${tab === "campus-comm" ? " active" : ""}`} type="button" onClick={() => go("campus-comm")}>
                  <Megaphone size={20} /><span>Announcements</span><ChevronRight className="mm-chev" size={16} />
                </button>
                <button className={`mm-row${tab === "universities" ? " active" : ""}`} type="button" onClick={() => go("universities")}>
                  <Building2 size={20} /><span>Universities</span><ChevronRight className="mm-chev" size={16} />
                </button>
                <button className={`mm-row${tab === "departments" ? " active" : ""}`} type="button" onClick={() => go("departments")}>
                  <Building2 size={20} /><span>Departments</span><ChevronRight className="mm-chev" size={16} />
                </button>
                {isTeacher && (
                  <>
                    <button className={`mm-row${tab === "keys" ? " active" : ""}`} type="button" onClick={() => go("keys")}>
                      <KeyRound size={20} /><span>Student Keys</span><ChevronRight className="mm-chev" size={16} />
                    </button>
                    <button className={`mm-row${tab === "invites" ? " active" : ""}`} type="button" onClick={() => go("invites")}>
                      <Mail size={20} /><span>Invites</span><ChevronRight className="mm-chev" size={16} />
                    </button>
                    <button className={`mm-row${tab === "admin" ? " active" : ""}`} type="button" onClick={() => go("admin")}>
                      <Cog size={20} /><span>Admin Panel</span><ChevronRight className="mm-chev" size={16} />
                    </button>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
