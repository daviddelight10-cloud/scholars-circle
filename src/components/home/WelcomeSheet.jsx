import { memo, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import HIcon from "./HIcon.jsx";
import { useModalA11y } from "../../hooks/useModalA11y.js";
import { titleForLevel } from "../../features/streak-survival/survivalStore.js";

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

// Per-kind visual + copy. accent feeds the CSS var --wc-a (icon tile + glow).
const KINDS = {
  levelup: {
    icon: "trophy",
    accent: "#F5A623",
    kicker: "LEVEL UP",
    title: (m) => `Level ${m.level} — ${titleForLevel(m.level)}`,
    sub: (m) =>
      m.dueCount
        ? `You climbed a level, ${m.name}. ${m.dueCount} item${m.dueCount === 1 ? "" : "s"} waiting — ride the momentum.`
        : `You climbed a level, ${m.name}. Keep the momentum going.`,
  },
  streak: {
    icon: "flame",
    accent: "#FF5470",
    kicker: (m) => `${m.streak}-DAY STREAK`,
    title: (m) => `${m.streak} days strong, ${m.name}`,
    sub: (m) =>
      `You've shown up ${m.streak} days in a row — that's rare. One session today keeps the chain alive.`,
  },
  comeback: {
    icon: "spark",
    accent: "#4F8EF7",
    kicker: "WELCOME BACK",
    title: (m) => `Good to see you, ${m.name}`,
    sub: (m) =>
      `${m.daysAway} days away — your memory's been waiting.${
        m.dueCount ? ` ${m.dueCount} item${m.dueCount === 1 ? "" : "s"} due;` : ""
      } one quick session clears the fog.`,
  },
  greeting: {
    icon: "star",
    accent: "#4F8EF7",
    kicker: () =>
      new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase(),
    title: (m) => `Good ${greetingWord()}, ${m.name}`,
    sub: (m) =>
      m.dueCount != null
        ? `${m.dueCount} item${m.dueCount === 1 ? "" : "s"} due for review today.`
        : "Your daily review is ready when you are.",
  },
};

function WelcomeSheet({ message, onClose, onStartDaily }) {
  const open = !!message;
  const { modalProps, focusRef } = useModalA11y({
    isOpen: open,
    onClose,
    labelledBy: "hm-wc-title",
  });
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    return () => { cancelAnimationFrame(raf); setShown(false); };
  }, [open]);

  if (!open) return null;
  const k = KINDS[message.kind] || KINDS.greeting;
  const kicker = typeof k.kicker === "function" ? k.kicker(message) : k.kicker;

  return createPortal(
    <>
      <div
        className={`hm-sheet-backdrop hm-wc-backdrop${shown ? " show" : ""}`}
        onClick={onClose}
      />
      <div
        {...modalProps}
        ref={focusRef}
        tabIndex={-1}
        className={`hm-sheet hm-wc${shown ? " show" : ""}`}
        style={{ "--wc-a": k.accent }}
      >
        <div className="hm-sh-handle" />
        {/* Icon tile + glow */}
        <div className="hm-wc-icon"><HIcon name={k.icon} size={28} color={k.accent} /></div>
        <div className="hm-wc-kicker">{kicker}</div>
        <h3 id="hm-wc-title" className="hm-wc-title">{k.title(message)}</h3>
        <p className="hm-wc-sub">{k.sub(message)}</p>

        {/* Stat strip */}
        <div className="hm-wc-chips">
          <span className="hm-wc-chip"><HIcon name="flame" size={11} color="#FF8A3D" /><b>{message.streak || 0}</b>streak</span>
          <span className="hm-wc-chip"><HIcon name="trophy" size={11} color="#FFC55C" /><b>LVL {message.level || 1}</b></span>
          {message.dueCount != null && (
            <span className="hm-wc-chip"><HIcon name="layers" size={11} color="#6EC1FF" /><b>{message.dueCount}</b>due</span>
          )}
        </div>

        {/* Primary CTA is the first focusable element in DOM order — useModalA11y
            moves initial focus here. The close button is absolutely positioned
            and intentionally last in DOM order. */}
        <button className="hm-wc-cta" onClick={() => { onClose(); onStartDaily?.(); }}>
          <HIcon name="play" size={14} />Start daily review
        </button>
        <button className="hm-wc-later" onClick={onClose}>Not now</button>
        <button className="hm-wc-x" onClick={onClose} aria-label="Dismiss welcome">
          <HIcon name="x" size={14} />
        </button>
      </div>
    </>,
    document.body
  );
}

export default memo(WelcomeSheet);
