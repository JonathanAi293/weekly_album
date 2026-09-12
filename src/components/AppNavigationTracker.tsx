"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

const STORAGE_KEY = "weekly-album:route-stack";

/**
 * Tracks client-side routes only. It lets a standalone iOS PWA distinguish an
 * in-app return from a direct launch, so an edge swipe never sends a user to
 * an unexpected external history entry.
 */
export function AppNavigationTracker() {
  const pathname = usePathname();
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
