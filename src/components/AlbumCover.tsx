"use client";

/* eslint-disable @next/next/no-img-element -- Runtime cover hosts are intentionally dynamic and unconfigured. */
import { useState } from "react";
import { resolveAlbumCover, type AlbumCover as CoverData } from "@/lib/cover";

type Props = { cover:CoverData; title:string; className:string; preview?:boolean };

export function AlbumCover({ cover, title, className, preview = false }: Props) {
  const candidates = resolveAlbumCover(cover);
  return <AlbumCoverState key={candidates.join("|")} candidates={candidates} title={title} className={className} preview={preview} />;
}

function AlbumCoverState({ candidates, title, className, preview }: { candidates:string[]; title:string; className:string; preview:boolean }) {
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = candidates[sourceIndex];
  if (!src) return <div className={`${className} album-cover-placeholder`} aria-label={`${title} 暂无封面`}><span className="record" /><span>{preview ? "封面暂不可用" : "暂无封面"}</span></div>;
  return <img className={className} src={src} alt={`${title} 专辑封面`} loading="lazy" decoding="async" onError={() => setSourceIndex(index => index + 1)} />;
}
