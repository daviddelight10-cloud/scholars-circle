import { useEffect, useRef, useState } from "react";
import ExitPill from "../../components/ExitPill.jsx";
import { useOverlayBackClose } from "../../hooks/useOverlayBackClose.js";
import { XP_PER_CORRECT } from "../../data.js";
import "./anatomyAtlas.css";

const ATLAS_URL = "/atlas/index.html";
// Assets the "Install for offline" button pre-downloads into the SW's
// CacheFirst "atlas" cache (registerRoute in src/sw.js).
const ATLAS_ASSETS = [ATLAS_URL, "/atlas/model.b64"];
const MODEL_URL = "/atlas/model.b64";

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Embedded anatomy atlas — the standalone atlas app lives in /public/atlas
 * and renders in a same-origin iframe. This wrapper:
 *  - seeds the atlas's theme from the app's data-theme (shared localStorage
 *    key "atlas-theme" + live "sc-theme" postMessage on theme change)
 *  - forwards atlas quiz answers to XP via the global "sc-xp-gained" event
 *    (listener in App.jsx)
 *  - offers an opt-in "download for offline" that prefetches the ~30MB model
 *    into the service-worker's CacheFirst "atlas" cache
 */
export default function AnatomyAtlas({ onBack, initialHash }) {
  const frameRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [progress, setProgress] = useState(null);   // {got, total} while downloading

  useOverlayBackClose(() => onBack?.(), { open: !!onBack });

  // Seed the atlas theme before first paint — it reads "atlas-theme" on boot.
  // Then watch <html data-theme> for changes (covers manual toggle + OS switch
  // tracked by the theme engine) and forward them into the iframe.
  useEffect(() => {
    const send = (theme) => {
      try { localStorage.setItem("atlas-theme", theme); } catch { /* ignore */ }
      frameRef.current?.contentWindow?.postMessage({ type: "sc-theme", theme }, location.origin);
    };
    send(currentTheme());
    const obs = new MutationObserver(() => send(currentTheme()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  // Bridge: atlas -> app. Only same-origin messages are accepted.
  useEffect(() => {
    const onMsg = (e) => {
      if (e.origin !== location.origin || !e.data) return;
      if (e.data.type === "atlas:quiz-correct") {
        window.dispatchEvent(new CustomEvent("sc-xp-gained", { detail: { xp: XP_PER_CORRECT } }));
      } else if (e.data.type === "atlas:ready") {
        setReady(true);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // Is the big model already in the SW cache? (survives reloads)
  useEffect(() => {
    let alive = true;
    if ("caches" in window) {
      caches.match(MODEL_URL).then((r) => { if (alive && r) setInstalled(true); })
        .catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  const install = async () => {
    if (progress) return;
    setProgress({ got: 0, total: 0 });
    try {
      for (const url of ATLAS_ASSETS) {
        const res = await fetch(url);              // SW CacheFirst caches the response
        if (!res.ok || !res.body) { await res.arrayBuffer(); continue; }
        const total = +res.headers.get("content-length") || 0;
        const reader = res.body.getReader();
        let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got += value.length;
          setProgress({ got, total });
        }
      }
      setInstalled(true);
    } catch { /* offline or aborted — leave as not-installed */ }
    setProgress(null);
  };

  const uninstall = async () => {
    if (!("caches" in window)) return;
    await caches.delete("atlas").catch(() => {});
    setInstalled(false);
  };

  const installBtn = (
    <button
      className={`aa-offline${installed ? " on" : ""}`}
      type="button"
      title={
        installed
          ? "Downloaded — works offline. Tap to remove the download."
          : "Download the atlas (~30MB) so it works offline"
      }
      onClick={installed ? uninstall : install}
      disabled={!!progress}
    >
      {progress
        ? `↓ ${(progress.got / 1e6).toFixed(0)}MB${progress.total ? ` / ${(progress.total / 1e6).toFixed(0)}MB` : ""}`
        : installed ? "✓ Offline" : "↓ Offline"}
    </button>
  );

  return (
    <div className="aa-page">
      <ExitPill title="Anatomy Atlas" onBack={onBack} right={installBtn} />
      {!ready && <div className="aa-loading">Loading atlas…</div>}
      <iframe
        ref={frameRef}
        className="aa-frame"
        src={ATLAS_URL + (initialHash || "#/")}
        title="Anatomy Atlas — interactive 3D human body"
        allow="fullscreen"
      />
    </div>
  );
}
