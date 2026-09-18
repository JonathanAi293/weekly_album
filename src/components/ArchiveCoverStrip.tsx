"use client";

import { useMemo, useState } from "react";
import { AlbumCover } from "@/components/AlbumCover";
import { resolveAlbumCover } from "@/lib/cover";
import type { ArchiveAlbumCover } from "@/lib/models";

type Props = { albums:ArchiveAlbumCover[] };

/** The archive never renders a placeholder: failed covers leave the strip. */
export function ArchiveCoverStrip({ albums }: Props) {
  const candidates = useMemo(() => albums.filter(album => resolveAlbumCover(album.cover).length > 0), [albums]);
  const [availableIds, setAvailableIds] = useState<Set<string>>(() => new Set());
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());

  if (candidates.length === 0 || (failedIds.size === candidates.length && availableIds.size === 0)) return null;

  return <div className="archive-cover-strip" aria-label="本期专辑封面预览">
    {candidates.map(album => <AlbumCover
      key={album.id}
      className="archive-cover"
      cover={album.cover}
      title={album.title}
      fallbackMode="hide"
      onAvailabilityChange={available => {
        if (available) setAvailableIds(previous => previous.has(album.id) ? previous : new Set(previous).add(album.id));
        else setFailedIds(previous => previous.has(album.id) ? previous : new Set(previous).add(album.id));
      }}
    />)}
  </div>;
}
