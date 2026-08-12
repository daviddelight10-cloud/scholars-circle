import { useState, useRef, useCallback, useEffect } from "react";

const SLOW_THRESHOLD = 2000;
const VERY_SLOW_THRESHOLD = 5000;
const RESET_AFTER = 30000;

export function useConnectionQuality() {
  const [quality, setQuality] = useState("good");
  const lastSlowRef = useRef(0);

  const trackRequest = useCallback((durationMs) => {
    if (durationMs >= VERY_SLOW_THRESHOLD) {
      setQuality("very-slow");
      lastSlowRef.current = Date.now();
    } else if (durationMs >= SLOW_THRESHOLD) {
      setQuality("slow");
      lastSlowRef.current = Date.now();
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (lastSlowRef.current && Date.now() - lastSlowRef.current > RESET_AFTER) {
        setQuality("good");
        lastSlowRef.current = 0;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return { quality, trackRequest };
}
