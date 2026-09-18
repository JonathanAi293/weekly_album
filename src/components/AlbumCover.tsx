"use client";

/* eslint-disable @next/next/no-img-element -- Runtime cover hosts are intentionally dynamic and unconfigured. */
import { useState } from "react";
import { resolveAlbumCover, type AlbumCover as CoverData } from "@/lib/cover";

type Props = {
  cover:CoverData;
  title:string;
  className:string;
  preview?:boolean;
  fallbackMode?:"placeholder" | "hide";
  onAvailabilityChange?:(available:boolean) => void;
};

export function AlbumCover({ cover, title, className, preview = false, fallbackMode = "placeholder", onAvailabilityChange }: Props) {
  const candidates = resolveAlbumCover(cover);
  return <AlbumCoverState key={candidates.join("|")} candidates={candidates} title={title} className={className} preview={preview} fallbackMode={fallbackMode} onAvailabilityChange={onAvailabilityChange} />;
}

function AlbumCoverState({ candidates, title, className, preview, fallbackMode, onAvailabilityChange }: { candidates:string[]; title:string; className:string; preview:boolean; fallbackMode:"placeholder" | "hide"; onAvailabilityChange?: (available:boolean) => void }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = candidates[sourceIndex];
  if (!src) {
    if (fallbackMode === "hide") return null;
    return <div className={`${className} album-cover-placeholder`} aria-label={`${title} 暂无封面`}><span className="record" /><span>{preview ? "封面暂不可用" : "暂无封面"}</span></div>;
  }
  return <img className={className} src={src} alt={`${title} 专辑封面`} loading="lazy" decoding="async" onLoad={() => onAvailabilityChange?.(true)} onError={() => setSourceIndex(index => {
    const nextIndex = index + 1;
    if (nextIndex >= candidates.length) onAvailabilityChange?.(false);
    return nextIndex;
  })} />;
}
