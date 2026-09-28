"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const STORAGE_KEY = "weekly-album:route-stack";

/**
 * Tracks client-side routes only. It lets a standalone iOS PWA distinguish an
 * in-app return from a direct launch, so an edge swipe never sends a user to
 * an unexpected external history entry.
 */
export function AppNavigationTracker() {
  const pathname = usePathname();
  const router = useRouter();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    let stack: string[] = [];
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      stack = saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }

    if (previousPath.current === null) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([pathname]));
    } else if (previousPath.current !== pathname) {
      const existingIndex = stack.lastIndexOf(pathname);
      const nextStack = existingIndex >= 0 ? stack.slice(0, existingIndex + 1) : [...stack, pathname];
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextStack));
    }
    previousPath.current = pathname;
  }, [pathname]);

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!ios || !standalone) return;

    let start: { x: number; y: number } | null = null;
    let shouldNavigateBack = false;
    function onStart(event: TouchEvent) {
      const touch = event.touches[0];
      start = touch && touch.clientX <= 24 && document.body.dataset.siteDrawerOpen !== "true"
        ? { x: touch.clientX, y: touch.clientY }
        : null;
      shouldNavigateBack = false;
    }
    function onMove(event: TouchEvent) {
      const touch = event.touches[0];
      if (!touch || !start) return;
      const horizontal = touch.clientX - start.x;
      const vertical = Math.abs(touch.clientY - start.y);
      if (horizontal > 88 && vertical < 56) shouldNavigateBack = true;
      if (vertical >= 56) start = null;
    }
    function onEnd() {
      if (shouldNavigateBack) {
        if (hasInAppBackHistory()) router.back();
        else if (pathname !== "/") router.push("/");
      }
      start = null;
      shouldNavigateBack = false;
    }
    function onCancel() { start = null; shouldNavigateBack = false; }

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onCancel);
    };
  }, [pathname, router]);

  return null;
}

export function hasInAppBackHistory() {
  if (typeof window === "undefined") return false;
  try {
    const stack = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]") as string[];
    return stack.length > 1;
  } catch {
    return false;
  }
}
