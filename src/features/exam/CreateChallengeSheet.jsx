import { useEffect, useState } from "react";
import { createChallenge } from "./examApi";
import { challengeUrl } from "./challengeUtils";
import { groupsApi } from "../groups/groupsApi";
import { feedApi } from "../feed/feedApi";
import { useOverlayBackClose } from "../../hooks/useOverlayBackClose.js";
import "./exam.css";

const DEADLINES = [
  [null, "No deadline"],
  [24, "24h"],
  [72, "3 days"],
  [168, "7 days"],
];

/**
 * Bottom sheet for turning a saved exam into an async challenge.
 * Creates the ExamChallenge, optionally attaches it to a study group, then
 * shows a share view (copy link / native share / join code).
 */
export default function CreateChallengeSheet({ exam, fixedGroupId = null, onClose, onCreated }) {
  useOverlayBackClose(onClose, { open: true });
  const [deadlineHours, setDeadlineHours] = useState(168);
  const [scoring, setScoring] = useState("first");
  const [reveal, setReveal] = useState("immediate");
  const [groupId, setGroupId] = useState(fixedGroupId);
  const [groups, setGroups] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null); // { challenge, shareUrl, code }
  const [copied, setCopied] = useState(false);
  const [feedShared, setFeedShared] = useState(false);

  useEffect(() => {
    if (fixedGroupId) return; // group is pre-picked (Play tab flow)
    groupsApi.myGroups({})
      .then((d) => setGroups(d?.groups || d?.classrooms || []))
      .catch(() => setGroups([]));
  }, [fixedGroupId]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const data = await createChallenge({
        examResourceId: exam.id,
        groupId: groupId || null,
        deadlineHours,
        scoring,
        reveal,
      });
      setDone(data);
      onCreated?.(data);
    } catch (e) {
      setErr(e.message || "Couldn't create the challenge");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard?.writeText(challengeUrl(done.challenge.token)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }).catch(() => {});
  };

  const shareNative = () => {
    const url = challengeUrl(done.challenge.token);
    if (navigator.share) {
      navigator.share({ title: `Exam challenge: ${done.challenge?.examResource?.title || "Exam"}`, text: "Take my exam challenge on Scholar's Circle", url }).catch(() => {});
    } else {
      copyLink();
    }
  };

  const shareToFeed = async () => {
    if (feedShared) return;
    try {
      await feedApi.createPost({
        text: `⚔️ I set an exam challenge — ${exam?.title || "exam"}. Think you can top the board?`,
        challengeToken: done.challenge.token,
      });
      setFeedShared(true);
    } catch { /* feed post is best-effort */ }
  };

  return (
    <div className="exr-sheet-bg" onClick={onClose}>
      <div className="exr-sheet exc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="exr-sheet-grab" />

        {!done ? (
          <>
            <div className="exr-sheet-title">⚔ Challenge friends</div>
            <p className="exr-sheet-sub">
              Share a link — everyone takes <b>{exam?.title || "this exam"}</b> on their own time and ranks on one board.
            </p>

            <div className="exh-section">Deadline</div>
            <div className="exc-pills">
              {DEADLINES.map(([h, label]) => (
                <button key={label} className={`exr-fchip${deadlineHours === h ? " on" : ""}`} onClick={() => setDeadlineHours(h)}>
                  {label}
                </button>
              ))}
            </div>

            <div className="exh-section">Scoring</div>
            <div className="exc-opts">
              <button className={`exc-opt${scoring === "first" ? " on" : ""}`} onClick={() => setScoring("first")}>
                <b>🎯 First attempt counts</b>
                <span>One shot each — fairest for a real exam feel</span>
              </button>
              <button className={`exc-opt${scoring === "best" ? " on" : ""}`} onClick={() => setScoring("best")}>
                <b>🔁 Best score wins</b>
                <span>Unlimited retakes, best attempt ranks</span>
              </button>
            </div>

            <div className="exh-section">Answers</div>
            <div className="exc-opts">
              <button className={`exc-opt${reveal === "immediate" ? " on" : ""}`} onClick={() => setReveal("immediate")}>
                <b>👀 Right away</b>
                <span>Takers review answers as soon as they finish</span>
              </button>
              <button className={`exc-opt${reveal === "onClose" ? " on" : ""}`} onClick={() => setReveal("onClose")}>
                <b>🔒 When it ends</b>
                <span>Answer review unlocks for everyone at once</span>
              </button>
            </div>

            {groups && groups.length > 0 && (
              <>
                <div className="exh-section">Post to a group <i>(optional)</i></div>
                <div className="exc-pills">
                  <button className={`exr-fchip${!groupId ? " on" : ""}`} onClick={() => setGroupId(null)}>Just a link</button>
                  {groups.map((g) => (
                    <button key={g.id} className={`exr-fchip${groupId === g.id ? " on" : ""}`} onClick={() => setGroupId(g.id)}>
                      {g.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            {err && <div className="exr-warn" style={{ marginTop: 10 }}>⚠️ {err}</div>}
            <button className="exr-btn primary big" style={{ marginTop: 14 }} onClick={submit} disabled={busy}>
              {busy ? "Creating…" : "Create challenge →"}
            </button>
          </>
        ) : (
          <>
            <div className="exr-sheet-title">🎉 Challenge created</div>
            <p className="exr-sheet-sub">
              Share the link or code — results gather on one leaderboard{done.challenge.deadline ? ` until ${new Date(done.challenge.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}.
            </p>

            <div className="exc-sharebox">
              <div className="exc-sharelink">{challengeUrl(done.challenge.token)}</div>
              <div className="exc-code">Code <b>{done.code}</b></div>
            </div>

            <div className="exc-sharebtns">
              <button className="exr-btn primary" onClick={copyLink}>{copied ? "✓ Copied" : "🔗 Copy link"}</button>
              {typeof navigator !== "undefined" && navigator.share && (
                <button className="exr-btn ghost" onClick={shareNative}>📤 Share</button>
              )}
            </div>

            <button className="exc-feedshare" onClick={shareToFeed} disabled={feedShared}>
              {feedShared ? "✓ Posted to your feed" : "📣 Share to feed"}
            </button>

            <button className="exr-btn ghost big" style={{ marginTop: 10 }} onClick={onClose}>Done</button>
          </>
        )}
      </div>
    </div>
  );
}
