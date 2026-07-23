import React, { useEffect, useRef, useState } from "react";
import MarkdownText from "./MarkdownText.jsx";

// Progressively reveals `text` in small chunks to simulate a live-typing
// streaming effect (Claude/ChatGPT style), without requiring a real
// server-sent-events stream. Renders through MarkdownText as it grows.
export default function TypewriterText({ text, theme = "dark", active = true, onDone, onTick, style }) {
  const [revealed, setRevealed] = useState(active ? 0 : (text || "").length);
  const doneRef = useRef(false);
  const skipRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    skipRef.current = false;

    if (!active || !text) {
      setRevealed((text || "").length);
      return;
    }

    setRevealed(0);
    const total = text.length;
    // Aim for a smooth reveal that doesn't drag on for very long responses.
    // Longer text reveals in bigger chunks so total duration stays bounded.
    const targetDurationMs = Math.min(2600, Math.max(600, total * 8));
    const tickMs = 16;
    const ticks = Math.max(1, Math.round(targetDurationMs / tickMs));
    const chunkSize = Math.max(1, Math.ceil(total / ticks));

    let i = 0;
    const interval = setInterval(() => {
      if (skipRef.current) {
        i = total;
      } else {
        i = Math.min(total, i + chunkSize);
      }
      setRevealed(i);
      if (onTick) onTick();
      if (i >= total) {
        clearInterval(interval);
        if (!doneRef.current) {
          doneRef.current = true;
          if (onDone) onDone();
        }
      }
    }, tickMs);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, active]);

  const skip = () => {
    skipRef.current = true;
  };

  const isRevealing = active && revealed < (text || "").length;

  return (
    <div style={style} onClick={isRevealing ? skip : undefined}>
      <MarkdownText theme={theme}>{(text || "").slice(0, revealed)}</MarkdownText>
      {isRevealing && (
        <span
          style={{
            display: "inline-block",
            width: 7,
            height: 14,
            marginLeft: 1,
            background: "currentColor",
            opacity: 0.75,
            animation: "sc-cursor-blink 0.9s steps(1) infinite",
            verticalAlign: "text-bottom",
          }}
        />
      )}
    </div>
  );
}
