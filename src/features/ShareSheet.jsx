import { useState } from "react";
import { api } from "../lib/appUtils";

const C = {
  bg: "#11132a", line: "#1e2245", text: "#e8eaf6", muted: "#8b92c4", hint: "#4a5080",
  gold: "#DAA520", goldBright: "#FFD700", green: "#25D366",
};

export default function ShareSheet({ title, shareUrl, announceTitle, token, notify, onClose }) {
  const [note, setNote] = useState("");
  const say = notify || ((msg) => { setNote(msg); setTimeout(() => setNote(""), 2200); });
  const [announcing, setAnnouncing] = useState(false);
  const [announced, setAnnounced] = useState(false);

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(shareUrl)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      say("Link copied ✓");
    } catch {
      // clipboard fallback
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      el.remove();
      say("Link copied ✓");
    }
  };

  const whatsapp = () => {
    const text = `📚 ${title}\n\nOpen it here (no login needed): ${shareUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const announce = async () => {
    setAnnouncing(true);
    try {
      await api("/announcements", {
        token,
        method: "POST",
        body: {
          title: `📚 ${announceTitle || title}`,
          content: `New material shared with you:\n\n${shareUrl}\n\nOpen it to start studying.`,
          category: "GENERAL",
          priority: "NORMAL",
          targetRoles: ["STUDENT"],
        },
      });
      setAnnounced(true);
      say("Announcement sent to students ✓");
    } catch (e) {
      say(e.message);
    }
    setAnnouncing(false);
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,6,12,0.7)", zIndex: 500 }} />
      <div style={{
        position: "fixed", left: "50%", bottom: 0, transform: "translateX(-50%)",
        width: "min(460px,100vw)", background: C.bg, border: `0.5px solid ${C.line}`,
        borderBottom: "none", borderRadius: "18px 18px 0 0", zIndex: 501, padding: "18px 18px 24px",
      }}>
        <div style={{ width: 36, height: 4, background: C.line, borderRadius: 2, margin: "0 auto 14px" }} />
        <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "Syne,sans-serif", marginBottom: 4 }}>🔗 Share this material</div>
        <div style={{ fontSize: 11, color: C.hint, marginBottom: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>

        {/* QR */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 8 }}>
            <img src={qrUrl} alt="QR code" width={140} height={140} style={{ display: "block" }} />
          </div>
        </div>
        <div style={{ fontSize: 10, color: C.hint, textAlign: "center", marginBottom: 14 }}>
          Project this in class — students scan to open instantly
        </div>

        {/* Link */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <div style={{ flex: 1, background: "#0a0c1e", border: `0.5px solid ${C.line}`, borderRadius: 8, padding: "9px 12px", fontSize: 11, color: C.muted, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {shareUrl}
          </div>
          <button onClick={copy} style={{ background: "rgba(218,165,32,0.15)", border: `0.5px solid ${C.gold}55`, color: C.goldBright, borderRadius: 8, padding: "9px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            📋 Copy
          </button>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={whatsapp} style={{ flex: 1, background: "rgba(37,211,102,0.12)", border: "0.5px solid rgba(37,211,102,0.4)", color: "#4ade80", borderRadius: 10, padding: "12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            💬 WhatsApp
          </button>
          <button
            onClick={announce}
            disabled={announcing || announced}
            style={{
              flex: 1, borderRadius: 10, padding: "12px", fontSize: 12, fontWeight: 700, cursor: announced ? "default" : "pointer",
              background: announced ? "rgba(52,211,153,0.15)" : "rgba(218,165,32,0.15)",
              border: announced ? "0.5px solid rgba(52,211,153,0.4)" : `0.5px solid ${C.gold}55`,
              color: announced ? "#34d399" : C.goldBright,
              opacity: announcing ? 0.6 : 1,
            }}
          >
            {announced ? "✓ Announced" : announcing ? "Sending…" : "📣 Announce to students"}
          </button>
        </div>

        {note && (
          <div style={{ marginTop: 10, textAlign: "center", fontSize: 11.5, color: "#34d399", fontWeight: 600 }}>{note}</div>
        )}
      </div>
    </>
  );
}
