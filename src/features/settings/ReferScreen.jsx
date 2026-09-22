import { useEffect, useState } from "react";
import "./settings.css";
import { getMyReferral } from "../../lib/referralApi";
import { toast } from "../../components/Toast";

export default function ReferScreen({ token, onBack }) {
  const [referral, setReferral] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyReferral(token).then((data) => {
      if (!cancelled) {
        setReferral(data);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [token]);

  function copyCode() {
    const code = referral?.code;
    if (!code) return;
    if (navigator.clipboard) navigator.clipboard.writeText(code).catch(() => {});
    toast.success("📋 Copied: " + code);
  }

  function shareCode() {
    const code = referral?.code || "";
    const msg = encodeURIComponent(
      `🎓 Join me on ScholarsCircle — practice questions, AI Tutor & streaks!\n\nUse my code ${code} and you'll get 3 FREE days of Premium 🎁\n\n${window.location.origin}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  const code = referral?.code || (loading ? "••••••" : "—");
  const invited = referral?.invited || 0;
  const earned = referral?.earned || 0;
  const banked = referral?.banked || 0;
  const active = referral?.active;

  return (
    <div className="st-root">
      <header className="st-topbar">
        <button className="st-iconbtn st-press" onClick={onBack || (() => {})} aria-label="Back">←</button>
        <h1>🎁 Refer & Earn</h1>
      </header>

      <section className="st-refhero">
        <div className="st-gift">🎁</div>
        <h2>Invite friends, earn free days</h2>
        <p>
          For every friend who joins ScholarsCircle with your code, you{" "}
          <b style={{ color: "var(--st-accent)" }}>both get 3 days of Premium</b>. No limit — invite the whole class 😄
        </p>
      </section>

      <div className="st-codebox">
        <div className="st-cb-l">YOUR REFERRAL CODE</div>
        <div className="st-cb-code">{code}</div>
        <div className="st-cbrow">
          <button className="st-cbbtn st-press" onClick={copyCode}>📋 Copy code</button>
          <button className="st-cbbtn st-wa st-press" onClick={shareCode}>💬 Share on WhatsApp</button>
        </div>
      </div>

      <div className="st-refstats">
        <div className="st-rbox">
          <b>{invited}</b>
          <span>FRIENDS JOINED</span>
          <small>{banked > 0 && !active ? `${banked} day${banked === 1 ? "" : "s"} banked` : ""}</small>
        </div>
        <div className="st-rbox">
          <b>{earned} day{earned === 1 ? "" : "s"}</b>
          <span>FREE DAYS EARNED</span>
          <small>{active && earned > 0 ? "applied to plan ✓" : ""}</small>
        </div>
      </div>

      <section className="st-steps">
        <h4>How it works</h4>
        <div className="st-step">
          <span className="st-n">1</span>
          <p><b>Share your code</b> with coursemates on WhatsApp, class groups or status.</p>
        </div>
        <div className="st-step">
          <span className="st-n">2</span>
          <p>They enter it during sign-up — <b>they instantly get 3 free days</b> of Premium too.</p>
        </div>
        <div className="st-step">
          <span className="st-n">3</span>
          <p><b>You get +3 days per friend.</b> Days stack — active Premium extends instantly.</p>
        </div>
      </section>

      <p className="st-fineprint">
        Banked days apply automatically the moment you subscribe.<br />
        Referral days have no cash value and never expire.
      </p>
    </div>
  );
}
