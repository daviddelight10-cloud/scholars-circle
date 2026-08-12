import { useRef, useState, useCallback, useEffect } from "react";

export function usePullToRefresh(onRefresh) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const pulling = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const elRef = useRef(null);
  const THRESHOLD = 70;
  const MAX_PULL = 100;

  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { isRefreshingRef.current = isRefreshing; }, [isRefreshing]);
  useEffect(() => { pullDistanceRef.current = pullDistance; }, [pullDistance]);

  const handleTouchStart = useCallback((e) => {
    if (isRefreshingRef.current) return;
    if (elRef.current && elRef.current.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    pulling.current = true;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current || isRefreshingRef.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      if (pullDistanceRef.current > 0) setPullDistance(0);
      return;
    }
    e.preventDefault();
    const dist = Math.min(dy * 0.5, MAX_PULL);
    setPullDistance(dist);
  }, []);

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current) return;
    pulling.current = false;
    if (pullDistanceRef.current >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD);
      try {
        await onRefreshRef.current();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, []);

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("touchmove", handleTouchMove, { passive: false });
    el.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("touchmove", handleTouchMove);
      el.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const setRef = useCallback((node) => {
    elRef.current = node;
  }, []);

  const indicatorStyle = {
    height: pullDistance,
    opacity: pullDistance > 0 ? 1 : 0,
    overflow: "hidden",
  };

  const showSpinner = isRefreshing || pullDistance >= THRESHOLD;

  return { ref: setRef, pullDistance, isRefreshing, indicatorStyle, showSpinner, THRESHOLD };
}
