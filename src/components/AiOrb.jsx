// Scholar's golden orb — the app's AI identity mark. Shared by the PDF reader
// chat, the global Scholar sheet, and any surface that speaks for the AI.
// Requires the `sc-orb-pulse` keyframes (injected by the host component's
// <style> block — see GlobalScholar / PdfReader).
export default function AiOrb({ size = 18, pulsing = false, style }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: "radial-gradient(circle at 32% 28%, #FFE1A6, #F5A623 52%, #B06F0A)",
        boxShadow: "0 0 10px rgba(245,166,35,0.45), inset 0 1px 2px rgba(255,255,255,0.5)",
        animation: pulsing ? "sc-orb-pulse 1.4s ease-in-out infinite" : "none",
        ...style,
      }}
    />
  );
}
