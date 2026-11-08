"use client";

import { useEffect, useRef, useState } from "react";

export default function PullToRefresh() {
  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const onTouchStart = (event: TouchEvent) => {
      if (refreshing.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      startY.current = touch.clientY;
      pulling.current = window.scrollY <= 1;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (!pulling.current || refreshing.current || window.scrollY > 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY.current;
      if (delta <= 0) { setDistance(0); return; }
      const amount = Math.min(92, Math.round(delta * 0.45));
      if (amount > 2) { event.preventDefault(); setDistance(amount); }
    };
    const onTouchEnd = () => {
      if (!pulling.current || refreshing.current) { pulling.current = false; return; }
      const shouldRefresh = distance >= 54;
      pulling.current = false;
      if (!shouldRefresh) { setDistance(0); return; }
      refreshing.current = true;
      setDistance(64);
      window.setTimeout(() => window.location.reload(), 80);
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [distance]);

  if (distance <= 0) return null;
  const ready = distance >= 54;
  return (
    <div className="pwfb-pull-refresh" style={{ height: distance + "px" }} aria-live="polite"
      aria-label={ready ? "Release to refresh" : "Pull to refresh"}>
      <span className={ready ? "pwfb-pull-refresh-icon ready" : "pwfb-pull-refresh-icon"}>↻</span>
      <span>{ready ? "Release to refresh" : "Pull to refresh"}</span>
    </div>
  );
}
