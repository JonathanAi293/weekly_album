"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { hasInAppBackHistory } from "./AppNavigationTracker";

function isStandaloneIOS() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
}

export function MobileBackNavigation({ fallbackHref, label = "返回" }: { fallbackHref: string; label?: string }) {
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const activated = useRef(false);

  const goBack = () => {
    if (hasInAppBackHistory()) router.back();
    else router.push(fallbackHref);
  };

  useEffect(() => {
    // Safari already owns the system edge-swipe gesture. Limit this fallback to
    // standalone mode, where browser chrome is absent and the gesture is less reliable.
    if (!isStandaloneIOS()) return;
    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch && touch.clientX <= 24) touchStart.current = { x: touch.clientX, y: touch.clientY };
      else touchStart.current = null;
      activated.current = false;
    };
    const onMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      const start = touchStart.current;
      if (!touch || !start) return;
      const horizontalDistance = touch.clientX - start.x;
      const verticalDistance = Math.abs(touch.clientY - start.y);
      if (horizontalDistance > 88 && verticalDistance < 56) activated.current = true;
      if (verticalDistance >= 56) touchStart.current = null;
    };
    const onEnd = () => {
      if (activated.current) goBack();
      touchStart.current = null;
      activated.current = false;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  });

  return <button className="back-button" type="button" onClick={goBack} aria-label={label}><span aria-hidden="true">←</span><span>{label}</span></button>;
}
