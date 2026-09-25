"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedbackPatch, FeedbackRecord } from "@/lib/feedback";

type FeedbackMap = Record<string, FeedbackRecord>;
type FeedbackContextValue = { feedback: FeedbackMap; saveFeedback: (albumId: string, patch: FeedbackPatch) => Promise<FeedbackRecord> };
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

function toMap(records: FeedbackRecord[]) { return Object.fromEntries(records.map(record => [record.albumId, record])); }

export function FeedbackProvider({ children, initialFeedback }: { children: React.ReactNode; initialFeedback: FeedbackRecord[] }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState<FeedbackMap>(() => toMap(initialFeedback));
  const requestVersions = useRef<Record<string, number>>({});

  const saveFeedback = useCallback(async (albumId: string, patch: FeedbackPatch) => {
    const requestVersion = (requestVersions.current[albumId] ?? 0) + 1;
    requestVersions.current[albumId] = requestVersion;
    const now = new Date().toISOString();
    let optimistic: FeedbackRecord | null = null; let previous: FeedbackRecord | undefined;
    setFeedback(currentMap => {
      previous = currentMap[albumId];
      const current = currentMap[albumId] ?? { albumId, status:null, rating:null, ratingStatus:"pending", comment:"", updatedAt:now, statusUpdatedAt:null };
      const statusChanged = Object.prototype.hasOwnProperty.call(patch, "status") && patch.status !== current.status;
      const explicitlyNoRating = patch.ratingStatus === "no_rating";
      const hasNumericRating = typeof patch.rating === "number";
      optimistic = { ...current, ...patch, rating:explicitlyNoRating ? null : patch.rating === undefined ? current.rating : patch.rating, ratingStatus:explicitlyNoRating ? "no_rating" : hasNumericRating ? "rated" : patch.ratingStatus === undefined ? current.ratingStatus : patch.ratingStatus, updatedAt:now, statusUpdatedAt:statusChanged ? now : current.statusUpdatedAt };
      return { ...currentMap, [albumId]: optimistic };
    });
    const response = await fetch("/api/feedback", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ albumId, ...patch }) });
    const payload = await response.json();
    if (!response.ok) {
      if (optimistic && requestVersions.current[albumId] === requestVersion) setFeedback(currentMap => previous ? { ...currentMap, [albumId]:previous } : (() => { const { [albumId]: _, ...rest } = currentMap; return rest; })());
      throw new Error(payload.error ?? "保存反馈失败");
    }
    const savedFeedback = payload.feedback as FeedbackRecord;
    if (requestVersions.current[albumId] === requestVersion) setFeedback(currentMap => ({ ...currentMap, [albumId]: savedFeedback }));
    router.refresh();
    return savedFeedback;
  }, [router]);

  const value = useMemo(() => ({ feedback, saveFeedback }), [feedback, saveFeedback]);
  return <FeedbackContext.Provider value={value}>{children}</FeedbackContext.Provider>;
}

export function useFeedback() {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error("useFeedback must be used inside FeedbackProvider");
  return value;
}
