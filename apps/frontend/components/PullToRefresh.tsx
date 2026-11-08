"use client";

import { useEffect, useRef, useState } from "react";

const REFRESH_THRESHOLD = 68;
const MAX_PULL_DISTANCE = 96;

export default function PullToRefresh() {
  const startY = useRef(0);
  const pulling = useRef(false);
  const refreshing = useRef(false);
  const distanceRef = useRef(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const resetPull = () => {
      pulling.current = false;
      distanceRef.current = 0;
      setDistance(0);
    };

    const startsInsideIndependentScroller = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return true;

      // Sidebar navigation must always retain its own native touch scrolling.
      if (target.closest(
        ".pwfb-sidebar, .pwfb-nav, .pwfb-menu-button, .pwfb-sidebar-overlay"
      )) return true;

      // Do not hijack gestures that begin inside another scrollable panel.
      let element: Element | null = target;
      while (element && element !== document.body && element !== document.documentElement) {
        const style = window.getComputedStyle(element);
        const overflowY = style.overflowY;
        if (
          (overflowY === "auto" || overflowY === "scroll") &&
          element.scrollHeight > element.clientHeight + 1
        ) return true;
        element = element.parentElement;
      }
      return false;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (refreshing.current) return;
      const touch = event.touches[0];
      if (!touch) return;

      if (
        startsInsideIndependentScroller(event.target) ||
        window.scrollY > 1 ||
        document.documentElement.scrollTop > 1
      ) {
        resetPull();
        return;
      }

      startY.current = touch.clientY;
      pulling.current = true;
      distanceRef.current = 0;
      setDistance(0);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pulling.current || refreshing.current) return;
      if (window.scrollY > 1 || document.documentElement.scrollTop > 1) {
        resetPull();
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;
      const delta = touch.clientY - startY.current;
      if (delta <= 0) {
        distanceRef.current = 0;
        setDistance(0);
        return;
      }

      const amount = Math.min(MAX_PULL_DISTANCE, Math.round(delta * 0.45));
      if (amount > 2) {
        event.preventDefault();
        distanceRef.current = amount;
        setDistance(amount);
      }
    };

    const onTouchEnd = () => {
      if (!pulling.current || refreshing.current) {
        pulling.current = false;
        return;
      }

      const shouldRefresh = distanceRef.current >= REFRESH_THRESHOLD;
      pulling.current = false;
      if (!shouldRefresh) {
        distanceRef.current = 0;
        setDistance(0);
        return;
      }

      refreshing.current = true;
      distanceRef.current = 64;
      setDistance(64);
      window.setTimeout(() => window.location.reload(), 250);
    };

    const onTouchCancel = () => {
      // A cancelled gesture is never a refresh request.
      if (!refreshing.current) resetPull();
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchCancel, { passive: true });

    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchCancel);
    };
  }, []);

  if (distance <= 0) return null;
  const ready = distance >= REFRESH_THRESHOLD;

  return (
    <div
      className="pwfb-pull-refresh"
      style={{ height: distance + "px" }}
      aria-live="polite"
      aria-label={ready ? "Release to refresh" : "Pull to refresh"}
    >
      <span className={ready ? "pwfb-pull-refresh-icon ready" : "pwfb-pull-refresh-icon"}>↻</span>
      <span>{ready ? "Release to refresh" : "Pull to refresh"}</span>
    </div>
  );
}
