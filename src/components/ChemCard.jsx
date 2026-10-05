import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MODES, MODE_LABELS, toStandaloneSvg } from "../lib/moleculeDraw.js";
import { skinFor } from "./chemSkin.js";

const viewBoxWidth = (markup) => {
  const m = /viewBox="[-\d.e]+ [-\d.e]+ ([\d.e]+) [-\d.e]+"/.exec(markup);
  return m ? parseFloat(m[1]) : 300;
};

export function ZoomModal({ markup, skin, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const width = Math.min(Math.max(viewBoxWidth(markup) * 2.2, 320), 1100);
  return createPortal(
    <div
      role="dialog" aria-label="Enlarged chemical structure" onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, cursor: "zoom-out" }}
    >
      <style>{".chem-zoom svg{width:100%!important;height:auto!important;max-width:none!important}"}</style>
      <div
        className="chem-zoom" onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 94vw)`, maxHeight: "90vh", overflow: "auto", background: skin.bg, border: `0.5px solid ${skin.border}`, borderRadius: 14, padding: 18, cursor: "default" }}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>,
    document.body
  );
}

const btn = (skin, on) => ({
  border: "none", cursor: "pointer", borderRadius: 999, padding: "3px 10px", fontSize: 10.5, fontWeight: 700,
  fontFamily: "Manrope,sans-serif", background: on ? skin.chipOn : skin.chip, color: on ? skin.chipOnText : skin.muted,
});

// Shared frame for molecule + reaction views: style chips, copy/download, and
// tap-to-enlarge. `children` may be a function receiving { zoom(markup) }.
export default function ChemCard({ theme = "dark", modes = MODES, mode, onMode, copyText = "", downloadMarkup = "", children }) {
  const skin = skinFor(theme);
  const [zoomed, setZoomed] = useState("");
  const [copied, setCopied] = useState(false);

  const copy = () => {
    if (!copyText || !navigator.clipboard) return;
    navigator.clipboard.writeText(copyText).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1200); }).catch(() => {});
  };
  const download = () => {
    const blob = new Blob([toStandaloneSvg(downloadMarkup, { background: skin.plate })], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "structure.svg"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div style={{ margin: "10px 0", padding: "10px 14px 12px", borderRadius: 12, background: skin.bg, border: `0.5px solid ${skin.border}`, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
        <div role="group" aria-label="Drawing style" style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {modes.length > 1 && modes.map((m) => (
            <button key={m} type="button" onClick={() => onMode(m)} aria-pressed={mode === m} style={btn(skin, mode === m)}>{MODE_LABELS[m]}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {copyText && <button type="button" onClick={copy} style={btn(skin, false)} title="Copy SMILES">{copied ? "Copied" : "Copy SMILES"}</button>}
          {downloadMarkup && <button type="button" onClick={download} style={btn(skin, false)} title="Download as SVG">SVG</button>}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
        {typeof children === "function" ? children({ zoom: setZoomed, skin }) : children}
      </div>
      {zoomed && <ZoomModal markup={zoomed} skin={skin} onClose={() => setZoomed("")} />}
    </div>
  );
}
