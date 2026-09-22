"use client";

import { useState } from "react";
import { formatRating, ratingToSliderIndex, RATING_SLIDER_MAX, RATING_SLIDER_MIN, sliderIndexToRating, type Rating } from "@/lib/rating";
import type { FeedbackRecord, RatingStatus } from "@/lib/feedback";
import { useFeedback } from "./FeedbackProvider";
const statuses = [{ label:"想听", value:"want_to_listen" }, { label:"已听", value:"listened" }, { label:"不感兴趣", value:"not_interested" }] as const;

export function FeedbackPanel({ albumId }: { albumId: string }) {
  const { feedback } = useFeedback();
  const existing = feedback[albumId];
  // Feedback updates can change updatedAt. Only an album change may re-initialize its local draft.
  return <FeedbackPanelForm key={albumId} albumId={albumId} existing={existing} />;
}

function FeedbackPanelForm({ albumId, existing }: { albumId: string; existing: FeedbackRecord | undefined }) {
  const { saveFeedback } = useFeedback();
  const [status, setStatus] = useState<(typeof statuses)[number]["value"] | null>(existing?.status ?? null);
  const [rating, setRating] = useState<Rating>(existing?.rating ?? null);
  const [ratingStatus, setRatingStatus] = useState<RatingStatus>(existing?.ratingStatus ?? "pending");
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(patch: { status?: (typeof statuses)[number]["value"] | null; rating?: Rating; ratingStatus?: RatingStatus; comment?: string }) {
    return saveFeedback(albumId, patch);
  }
  async function save() {
    setIsSaving(true); setMessage("");
    try {
      const savedFeedback = await submit({ status, rating, ratingStatus: rating === null ? ratingStatus : "rated", comment });
      setStatus(savedFeedback.status); setRating(savedFeedback.rating); setRatingStatus(savedFeedback.ratingStatus); setComment(savedFeedback.comment);
      setIsDirty(false); setMessage("已记下。");
    } catch (error) { setMessage(error instanceof Error ? error.message : "无法保存记录。"); }
    finally { setIsSaving(false); }
  }
  const sliderIndex = ratingToSliderIndex(rating, ratingStatus);
  const scoreLabel = ratingStatus === "no_rating" ? "不评分" : rating === null ? "未评分" : formatRating(rating);
  const selectSliderIndex = (index: number) => { const next = sliderIndexToRating(index); setRating(next.rating); setRatingStatus(next.ratingStatus); setIsDirty(true); setMessage(""); };
  async function updateStatus(nextStatus:(typeof statuses)[number]["value"] | null) {
    const previousStatus = status;
    setStatus(nextStatus); setMessage("");
    try { await submit({ status:nextStatus }); }
    catch (error) { setStatus(previousStatus); setMessage(error instanceof Error ? error.message : "无法更新状态。"); }
  }
  return <div className="feedback"><span className="mobile-note">你的记录</span>{statuses.map(item => <button className={`status ${status === item.value ? "active" : ""}`} type="button" onClick={() => void updateStatus(item.value)} key={item.value}>{item.label}</button>)}{status && <button className="status" type="button" onClick={() => void updateStatus(null)}>清除状态</button>}<div className="rating" aria-label="个人评分"><span className="rating-score">{scoreLabel}{ratingStatus !== "no_rating" && <small>/ 10</small>}</span><div className="rating-slider"><input type="range" aria-label="不评分到 10.0，20 个档位" aria-valuetext={ratingStatus === "no_rating" ? "不评分" : rating === null ? "未评分" : `${formatRating(rating)} / 10`} min={RATING_SLIDER_MIN} max={RATING_SLIDER_MAX} step="1" value={sliderIndex} onChange={event => selectSliderIndex(Number(event.target.value))} onPointerUp={event => { const rect = event.currentTarget.getBoundingClientRect(); const index = Math.round(((event.clientX - rect.left) / rect.width) * RATING_SLIDER_MAX); selectSliderIndex(Math.max(RATING_SLIDER_MIN, Math.min(RATING_SLIDER_MAX, index))); }} /><span className="rating-scale" aria-hidden="true"><span>不评分</span><span>10</span></span></div></div><textarea className="comment" value={comment} onChange={event => { setComment(event.target.value); setIsDirty(true); setMessage(""); }} placeholder="留一句给未来自己的短评：哪一刻让你想重听？" /><button className="status active" type="button" disabled={isSaving} onClick={() => void save()}>{isSaving ? "保存中…" : isDirty ? "保存记录" : "保存记录"}</button>{message && <span className="mobile-note" role="status">{message}</span>}</div>;
}
