import { useEffect, useState } from "react";
import CircleSheet from "./CircleSheet.jsx";
import McIcon from "./McIcon.jsx";
import { feedApi } from "../feed/feedApi.js";
import { groupsApi } from "../groups/groupsApi.js";
import { messagesApi } from "../messages/messagesApi.js";
import { API_BASE } from "../../lib/constants.js";

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  } catch {
    return {};
  }
}

const buildUrl = (t) =>
  !t?.shareToken
    ? null
    : `${window.location.origin}${t.type === "folder" ? "/folders/" : "/resources/"}${t.shareToken}`;

/**
 * Unified share sheet — one entry point for every "Share" action in the app.
 * target: { type: "resource"|"folder", id, shareToken, title, meta, visibility }
 * onEnableLink: async (target) => shareToken — turns on link sharing for a
 * private folder and returns the new token.
 */
export default function ShareSheet({ open, onClose, target, notify, onEnableLink, onRequireAuth }) {
  const [pane, setPane] = useState("main"); // main | groups | friends
  const [url, setUrl] = useState(() => buildUrl(target));
  const [enabling, setEnabling] = useState(false);
  const [note, setNote] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Sub-view data
  const [groups, setGroups] = useState(null);
  const [peerQ, setPeerQ] = useState("");
  const [peers, setPeers] = useState(null);

  const say = notify || ((m) => { setNote(m); setTimeout(() => setNote(""), 2200); });
  const authed = !!getAuth().authToken;
  const isResource = target?.type === "resource";

  // Reset sheet state when a new target is shared (adjust-during-render,
  // React's recommended alternative to an effect for prop-derived resets).
  const [prevTarget, setPrevTarget] = useState(null);
  if (target !== prevTarget) {
    setPrevTarget(target);
    setPane("main");
    setUrl(buildUrl(target));
    setNote("");
    setQrOpen(false);
    setPeerQ("");
    setPeers(null);
    setGroups(null);
  }

  useEffect(() => {
    if (pane !== "groups" || groups !== null || !authed) return;
    groupsApi.myGroups({}).then((g) => setGroups(Array.isArray(g) ? g : g?.groups || [])).catch(() => setGroups([]));
  }, [pane, groups, authed]);

  useEffect(() => {
    if (pane !== "friends" || !authed) return;
    const t = setTimeout(() => {
      messagesApi.searchPeers({ q: peerQ }).then(setPeers).catch(() => setPeers([]));
    }, 250);
    return () => clearTimeout(t);
  }, [peerQ, pane, authed]);

  if (!target) return null;

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const el = document.createElement("textarea");
      el.value = url;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
    }
    say("Link copied ✓");
  };

  const shareNative = async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: target.title, text: target.meta || target.title, url });
      } else {
        await copy();
      }
    } catch {
      // cancelled
    }
  };

  const whatsapp = () => {
    if (!url) return;
    const text = `📚 ${target.title}\n\nOpen it here: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const enableLink = async () => {
    if (enabling || !onEnableLink) return;
    setEnabling(true);
    try {
      const shareToken = await onEnableLink(target);
      if (shareToken) {
        const t = { ...target, shareToken };
        setUrl(buildUrl(t));
        say("Link sharing on ✓");
      }
    } catch (e) {
      say(e.message || "Couldn't enable link sharing");
    }
    setEnabling(false);
  };

  const postToFeed = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await feedApi.createPost({ text: `📚 ${target.title}`, resourceId: target.id });
      setNote("Posted to your circle ✓");
    } catch (e) {
      say(e.message || "Couldn't post");
    }
    setBusy(false);
  };

  const sendToGroup = async (g) => {
    if (busy) return;
    setBusy(true);
    try {
      const { authToken } = getAuth();
      const res = await fetch(`${API_BASE}/study-group/${g.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify(
          isResource
            ? { text: `Shared ${target.title}`, resourceId: target.id }
            : { text: `📁 ${target.title}\n${url}` }
        ),
      });
      if (!res.ok) throw new Error("Couldn't send to this group");
      setPane("main");
      setNote(`Sent to ${g.name} ✓`);
    } catch (e) {
      say(e.message || "Couldn't send");
    }
    setBusy(false);
  };

  const sendToFriend = async (p) => {
    if (busy) return;
    setBusy(true);
    try {
      await messagesApi.send({ toUserId: p.id, content: `📚 ${target.title}\n${url}` });
      setPane("main");
      setNote(`Sent to ${p.name || p.username} ✓`);
    } catch (e) {
      say(e.message || "Couldn't send");
    }
    setBusy(false);
  };

  const requireAuth = () => {
    onClose?.();
    onRequireAuth?.();
  };

  const qrUrl = url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(url)}`
    : null;

  return (
    <CircleSheet open={open} onClose={onClose} title={pane === "main" ? "Share" : pane === "groups" ? "Send to a group" : "Send to a friend"} kind={isResource ? "Material" : "Space"}>
      {pane !== "main" && (
        <button className="sh-back" onClick={() => setPane("main")}>
          <McIcon name="chev" style={{ transform: "rotate(90deg)" }} /> Back
        </button>
      )}

      {pane === "main" && (
        <>
          {/* Preview */}
          <div className="sh-preview">
            <span className="sh-preview-icon">{isResource ? "📄" : "📁"}</span>
            <div className="sh-preview-info">
              <div className="sh-preview-title">{target.title}</div>
              {target.meta && <div className="sh-preview-meta">{target.meta}</div>}
            </div>
          </div>

          {/* In-circle destinations */}
          {authed ? (
            <>
              <div className="sh-section">Send in Circle</div>
              {isResource && (
                <button className="mc-act-row" onClick={postToFeed} disabled={busy}>
                  <span className="sh-row-ic">👥</span>
                  <div>
                    <div className="mc-r-t">{busy ? "Posting…" : "Post to my circle"}</div>
                    <div className="mc-r-s">Shows up on your friends' feed with the material attached</div>
                  </div>
                </button>
              )}
              <button className="mc-act-row" onClick={() => setPane("groups")}>
                <span className="sh-row-ic">💬</span>
                <div>
                  <div className="mc-r-t">Send to a study group</div>
                  <div className="mc-r-s">Drops it into the group's chat</div>
                </div>
                <span className="sh-chev"><McIcon name="chev-r" /></span>
              </button>
              <button className="mc-act-row" onClick={() => setPane("friends")}>
                <span className="sh-row-ic">👤</span>
                <div>
                  <div className="mc-r-t">Send to a friend</div>
                  <div className="mc-r-s">Private message with a link</div>
                </div>
                <span className="sh-chev"><McIcon name="chev-r" /></span>
              </button>
            </>
          ) : (
            onRequireAuth && (
              <button className="mc-act-row" onClick={requireAuth}>
                <span className="sh-row-ic">👥</span>
                <div>
                  <div className="mc-r-t">Log in to share in Circle</div>
                  <div className="mc-r-s">Post to your feed, groups, or friends</div>
                </div>
              </button>
            )
          )}

          {/* Link */}
          <div className="sh-section">Get the link</div>
          {url ? (
            <>
              <div className="sh-linkbox">
                <span className="sh-linkbox-url">{url}</span>
                <button className="sh-copy" onClick={copy}>Copy</button>
              </div>
              <div className="sh-actions">
                <button className="sh-btn" onClick={shareNative}>
                  <McIcon name="share" /> Share via…
                </button>
                <button className="sh-btn sh-btn-wa" onClick={whatsapp}>
                  <span className="sh-row-ic" style={{ fontSize: 15 }}>💬</span> WhatsApp
                </button>
              </div>
              <button className="sh-qr-toggle" onClick={() => setQrOpen((v) => !v)}>
                {qrOpen ? "Hide QR code" : "Show QR code"}
              </button>
              {qrOpen && (
                <div className="sh-qr">
                  <img src={qrUrl} alt="QR code" width={140} height={140} />
                  <div className="sh-qr-cap">Project in class — students scan to open</div>
                </div>
              )}
            </>
          ) : (
            <button className="mc-act-row" onClick={enableLink} disabled={enabling || !onEnableLink}>
              <McIcon name="lock" />
              <div>
                <div className="mc-r-t">{enabling ? "Turning on…" : "Turn on link sharing"}</div>
                <div className="mc-r-s">This space is private — anyone with the link will be able to view it</div>
              </div>
            </button>
          )}

          {note && <div className="sh-note">{note}</div>}
        </>
      )}

      {pane === "groups" && (
        <div className="sh-list">
          {groups === null && <div className="sh-empty">Loading your groups…</div>}
          {groups?.length === 0 && <div className="sh-empty">No study groups yet — create one from the Groups tab.</div>}
          {(groups || []).map((g) => (
            <button key={g.id} className="mc-act-row" onClick={() => sendToGroup(g)} disabled={busy}>
              <span className="sh-row-ic">{g.icon || "💬"}</span>
              <div>
                <div className="mc-r-t">{g.name}</div>
                <div className="mc-r-s">{[g.subject, g.memberCount != null ? `${g.memberCount} members` : null].filter(Boolean).join(" · ")}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {pane === "friends" && (
        <>
          <input
            className="sh-search"
            placeholder="Search people…"
            value={peerQ}
            onChange={(e) => setPeerQ(e.target.value)}
            autoFocus
          />
          <div className="sh-list">
            {peers === null && <div className="sh-empty">Loading…</div>}
            {peers?.length === 0 && <div className="sh-empty">No one found{peerQ ? ` for "${peerQ}"` : " — search for a classmate"}.</div>}
            {(peers || []).map((p) => (
              <button key={p.id} className="mc-act-row" onClick={() => sendToFriend(p)} disabled={busy}>
                <span className="sh-ava">{(p.name || p.username || "?").slice(0, 2).toUpperCase()}</span>
                <div>
                  <div className="mc-r-t">{p.name || p.username}</div>
                  <div className="mc-r-s">{[p.handle || (p.username ? `@${p.username}` : null), p.uni].filter(Boolean).join(" · ")}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </CircleSheet>
  );
}
