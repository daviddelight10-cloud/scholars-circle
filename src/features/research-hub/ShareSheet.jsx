import { useEffect, useState } from "react";
import QRCode from "qrcode";
import CircleSheet from "./CircleSheet.jsx";
import McIcon from "./McIcon.jsx";
import { feedApi } from "../feed/feedApi.js";
import { groupsApi } from "../groups/groupsApi.js";
import { messagesApi } from "../messages/messagesApi.js";
import { api } from "../../lib/appUtils.js";
// The sheet imports its own styles so it works from any feature
// (feed, teacher hubs, resource viewer) — not just inside ResearchHub.
import "../../research-hub.css";

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  } catch {
    return {};
  }
}

const buildUrl = (t) =>
  !t?.shareToken
  || (t?.type === "folder" && t?.visibility === "private")
  || (t?.type === "resource" && t?.linkShared === false)
    ? null
    : `${window.location.origin}${t.type === "folder" ? "/folders/" : "/resources/"}${t.shareToken}`;

const RECENTS_KEY = "sc-share-recents";
const loadRecents = () => {
  try {
    const list = JSON.parse(localStorage.getItem(RECENTS_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const pushRecent = (r) => {
  const next = [r, ...loadRecents().filter((x) => !(x.kind === r.kind && x.id === r.id))].slice(0, 4);
  try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
  return next;
};

const PREVIEW_ICON = {
  mcq: "list", exam: "grad", summary: "books", flashcard: "list",
};

const VISIBILITY = {
  link: { icon: "globe", label: "Anyone with the link" },
  shared: { icon: "landmark", label: "Department" },
  private: { icon: "lock", label: "Private — link off" },
};

/**
 * Unified share sheet — one entry point for every "Share" action in the app.
 * target: { type: "resource"|"folder", id, shareToken, title, meta, visibility,
 *           contentType, isOwner }
 * onEnableLink / onDisableLink: async (target) => shareToken — toggles link
 * sharing on a folder (returns the token when enabling).
 * onOpenDestination: (dest) => void — lets hosts deep-link "Open chats"/"View feed".
 * allowAnnounce: renders the teacher "Announce to students" row.
 */
export default function ShareSheet({ open, onClose, target, notify, onEnableLink, onDisableLink, onRequireAuth, onOpenDestination, allowAnnounce }) {
  const [pane, setPane] = useState("main"); // main | groups | friends | sent
  const [url, setUrl] = useState(() => buildUrl(target));
  const [enabling, setEnabling] = useState(false);
  const [note, setNote] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [present, setPresent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState("");
  const [recents, setRecents] = useState(loadRecents);
  const [sentTo, setSentTo] = useState(null); // { label, dest, destLabel }
  const [announcing, setAnnouncing] = useState(false);
  const [announced, setAnnounced] = useState(false);

  // Sub-view data
  const [groups, setGroups] = useState(null);
  const [peerQ, setPeerQ] = useState("");
  const [peers, setPeers] = useState(null);

  const say = notify || ((m) => { setNote(m); setTimeout(() => setNote(""), 2200); });
  const authed = !!getAuth().authToken;
  const isResource = target?.type === "resource";
  const cap = caption.trim();

  // Reset sheet state when a new target is shared (adjust-during-render,
  // React's recommended alternative to an effect for prop-derived resets).
  const [prevTarget, setPrevTarget] = useState(null);
  if (target !== prevTarget) {
    setPrevTarget(target);
    setPane("main");
    setUrl(buildUrl(target));
    setNote("");
    setQrOpen(false);
    setQrDataUrl(null);
    setPresent(false);
    setCaption("");
    setSentTo(null);
    setAnnounced(false);
    setPeerQ("");
    setPeers(null);
    setGroups(null);
    setRecents(loadRecents());
  }

  // Device/browser back (via CircleSheet's overlay entry): QR pane → hide it,
  // a sub-pane → back to main, main → close the sheet.
  const handleSheetClose = () => {
    if (qrOpen) { setQrOpen(false); return; }
    if (pane !== "main") { setPane("main"); return; }
    onClose?.();
  };

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

  // Generate the QR locally — no third-party service sees the share URL.
  // Stale codes are cleared on target change / disableLink; they never render
  // while url is null anyway (the QR UI only shows inside the url branch).
  useEffect(() => {
    if (!url) return;
    let live = true;
    QRCode.toDataURL(url, { width: 360, margin: 1, color: { dark: "#111111", light: "#ffffff" } })
      .then((d) => { if (live) setQrDataUrl(d); })
      .catch(() => { if (live) setQrDataUrl(null); });
    return () => { live = false; };
  }, [url]);

  if (!target) return null;

  const shareText = () =>
    [cap, `📚 ${target.title}`, `Open it here: ${url}`].filter(Boolean).join("\n");

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
        await navigator.share({ title: target.title, text: cap || target.meta || target.title, url });
      } else {
        await copy();
      }
    } catch {
      // cancelled
    }
  };

  const whatsapp = () => {
    if (!url) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, "_blank");
  };

  // Resources can toggle their own link — parents can still override via
  // onEnableLink/onDisableLink (needed for folders, which sync list state).
  const resourceLinkPatch = async (on) => {
    await api(`/api/resources/${target.id}`, {
      token: getAuth().authToken,
      method: "PATCH",
      body: { linkShared: on },
    });
    return on ? target.shareToken : null;
  };
  const doEnable = target.isOwner ? (onEnableLink || (isResource ? () => resourceLinkPatch(true) : null)) : null;
  const doDisable = target.isOwner ? (onDisableLink || (isResource ? () => resourceLinkPatch(false) : null)) : null;

  const enableLink = async () => {
    if (enabling || !doEnable) return;
    setEnabling(true);
    try {
      const shareToken = await doEnable(target);
      if (shareToken) {
        setUrl(buildUrl({ ...target, shareToken, visibility: "link", linkShared: true }));
        say("Link sharing on ✓");
      }
    } catch (e) {
      say(e.message || "Couldn't enable link sharing");
    }
    setEnabling(false);
  };

  const disableLink = async () => {
    if (enabling || !doDisable) return;
    setEnabling(true);
    try {
      await doDisable(target);
      setUrl(null);
      setQrDataUrl(null);
      setQrOpen(false);
      say(isResource ? "Link sharing off — the old link no longer opens" : "Link sharing off — the old link no longer opens this space");
    } catch (e) {
      say(e.message || "Couldn't turn off link sharing");
    }
    setEnabling(false);
  };

  const succeed = (label, dest, destLabel) => {
    setSentTo({ label, dest, destLabel });
    setPane("sent");
  };

  const postToFeed = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await feedApi.createPost({ text: cap || `📚 ${target.title}`, resourceId: target.id });
      succeed("Posted to your circle", "feed", "View feed");
    } catch (e) {
      say(e.message || "Couldn't post");
    }
    setBusy(false);
  };

  const sendToGroup = async (g) => {
    if (busy) return;
    setBusy(true);
    try {
      await groupsApi.sendMessage({
        id: g.id,
        ...(isResource
          ? { text: cap || `Shared ${target.title}`, resourceId: target.id }
          : { text: [cap, `📁 ${target.title}`, url].filter(Boolean).join("\n") }),
      });
      setRecents(pushRecent({ kind: "group", id: g.id, name: g.name, icon: g.icon || "💬", sub: g.subject }));
      succeed(`Sent to ${g.name}`, "chats", "Open chats");
    } catch (e) {
      say(e.message || "Couldn't send");
    }
    setBusy(false);
  };

  const sendToFriend = async (p) => {
    if (busy) return;
    setBusy(true);
    try {
      await messagesApi.send({ toUserId: p.id, content: [cap, `📚 ${target.title}`, url].filter(Boolean).join("\n") });
      setRecents(pushRecent({ kind: "friend", id: p.id, name: p.name || p.username, sub: p.handle || p.uni }));
      succeed(`Sent to ${p.name || p.username}`, "chats", "Open chats");
    } catch (e) {
      say(e.message || "Couldn't send");
    }
    setBusy(false);
  };

  const announce = async () => {
    if (announcing || announced || !url) return;
    setAnnouncing(true);
    try {
      await api("/announcements", {
        token: getAuth().authToken,
        method: "POST",
        body: {
          title: `📚 ${target.title}`,
          content: `New material shared with you:\n\n${url}\n\nOpen it to start studying.`,
          category: "GENERAL",
          priority: "NORMAL",
          targetRoles: ["STUDENT"],
        },
      });
      setAnnounced(true);
      say("Announcement sent to students ✓");
    } catch (e) {
      say(e.message || "Couldn't announce");
    }
    setAnnouncing(false);
  };

  const requireAuth = () => {
    onClose?.();
    onRequireAuth?.();
  };

  const openDest = () => {
    if (sentTo?.dest && onOpenDestination) onOpenDestination(sentTo.dest);
    onClose?.();
  };

  const vis = target.type === "folder"
    ? VISIBILITY[target.visibility || (url ? "link" : "private")]
    : url
      ? { icon: "globe", label: "Anyone with the link" }
      : { icon: "lock", label: "Link off" };
  const previewIcon = target.type === "folder" ? "folder" : PREVIEW_ICON[target.contentType] || "filetext";

  return (
    <CircleSheet open={open} onClose={handleSheetClose} title={pane === "main" ? "Share" : pane === "groups" ? "Send to a group" : pane === "friends" ? "Send to a friend" : "Shared"} kind={isResource ? "Material" : "Space"}>
      {(pane === "groups" || pane === "friends") && (
        <button className="sh-back" onClick={() => setPane("main")}>
          <McIcon name="chev" style={{ transform: "rotate(90deg)" }} /> Back
        </button>
      )}

      {pane === "sent" && sentTo && (
        <div className="sh-sent">
          <div className="sh-sent-check"><McIcon name="check" /></div>
          <div className="sh-sent-label">{sentTo.label}</div>
          <div className="sh-sent-actions">
            {onOpenDestination && sentTo.dest && (
              <button className="sh-btn" onClick={openDest}>{sentTo.destLabel}</button>
            )}
            <button className="sh-btn sh-btn-primary" onClick={onClose}>Done</button>
          </div>
        </div>
      )}

      {pane === "main" && (
        <>
          {/* Preview */}
          <div className="sh-preview">
            <span className="sh-preview-icon"><McIcon name={previewIcon} /></span>
            <div className="sh-preview-info">
              <div className="sh-preview-title">{target.title}</div>
              <div className="sh-preview-meta">
                {target.meta && <span>{target.meta}</span>}
                {vis && (
                  <span className={`sh-vis${url || target.visibility === "shared" ? " on" : ""}`}>
                    <McIcon name={vis.icon} /> {vis.label}
                  </span>
                )}
              </div>
            </div>
          </div>

          {authed && (
            <input
              className="sh-caption"
              placeholder="Add a note… (optional)"
              value={caption}
              maxLength={200}
              onChange={(e) => setCaption(e.target.value)}
            />
          )}

          {/* In-circle destinations */}
          {authed ? (
            <>
              {recents.length > 0 && (
                <>
                  <div className="sh-section">Recent</div>
                  {recents.map((r) => (
                    <button
                      key={`${r.kind}-${r.id}`}
                      className="mc-act-row compact"
                      onClick={() => (r.kind === "group" ? sendToGroup(r) : sendToFriend(r))}
                      disabled={busy}
                    >
                      <span className="sh-row-ic">{r.kind === "group" ? r.icon || "💬" : "👤"}</span>
                      <div>
                        <div className="mc-r-t">{r.name}</div>
                        {r.sub && <div className="mc-r-s">{r.sub}</div>}
                      </div>
                      <span className="sh-chev"><McIcon name="share" /></span>
                    </button>
                  ))}
                </>
              )}
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
              {allowAnnounce && url && (
                <button className="mc-act-row" onClick={announce} disabled={announcing || announced}>
                  <span className="sh-row-ic">📣</span>
                  <div>
                    <div className="mc-r-t">{announced ? "Announced to students ✓" : announcing ? "Sending…" : "Announce to students"}</div>
                    <div className="mc-r-s">Posts the link as an announcement for your class</div>
                  </div>
                </button>
              )}
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
              <div className="sh-actions" style={{ marginTop: 8 }}>
                <button className="sh-btn" onClick={() => setQrOpen((v) => !v)}>
                  <McIcon name="grid" /> {qrOpen ? "Hide QR" : "QR code"}
                </button>
                {qrDataUrl && (
                  <button className="sh-btn" onClick={() => setPresent(true)}>
                    <McIcon name="eye" /> Present
                  </button>
                )}
                {target.isOwner && doDisable && (
                  <button className="sh-btn sh-btn-danger" onClick={disableLink} disabled={enabling}>
                    <McIcon name="lock" /> {enabling ? "Turning off…" : "Turn off"}
                  </button>
                )}
              </div>
              {qrOpen && qrDataUrl && (
                <button className="sh-qr" onClick={() => setPresent(true)} title="Present fullscreen">
                  <img src={qrDataUrl} alt="QR code" width={140} height={140} />
                  <div className="sh-qr-cap">Tap to present — students scan to open</div>
                </button>
              )}
            </>
          ) : doEnable ? (
            <button className="mc-act-row" onClick={enableLink} disabled={enabling}>
              <McIcon name="lock" />
              <div>
                <div className="mc-r-t">{enabling ? "Turning on…" : "Turn on link sharing"}</div>
                <div className="mc-r-s">{isResource ? "This material is private — anyone with the link will be able to open it" : "This space is private — anyone with the link will be able to view it"}</div>
              </div>
            </button>
          ) : null}

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

      {/* Gate on `open` too — CircleSheet keeps children mounted while closed,
          so an ungated autoFocus input would pop the keyboard on every render
          after the user closes the sheet while on this pane. */}
      {open && pane === "friends" && (
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

      {/* Fullscreen QR for classroom projection */}
      {present && qrDataUrl && (
        <div className="sh-present" onClick={() => setPresent(false)}>
          <div className="sh-present-card" onClick={(e) => e.stopPropagation()}>
            <div className="sh-present-title">{target.title}</div>
            <img src={qrDataUrl} alt="QR code" className="sh-present-qr" />
            <div className="sh-present-url">{url.replace(/^https?:\/\//, "")}</div>
            <div className="sh-qr-cap">Students scan to open — tap anywhere to close</div>
          </div>
        </div>
      )}
    </CircleSheet>
  );
}
