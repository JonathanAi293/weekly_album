"use client";

import { CollectionAlbumCard } from "./CollectionAlbumCard";
import { useFeedback } from "./FeedbackProvider";
import type { LibraryAlbum } from "@/lib/models";

export function WantShelf({ items }: { items: LibraryAlbum[] }) {
  const { feedback } = useFeedback();
  const wanted = items
    .filter(item => feedback[item.album.id]?.status === "want_to_listen")
    .sort((a, b) => (feedback[b.album.id].statusUpdatedAt ?? "").localeCompare(feedback[a.album.id].statusUpdatedAt ?? ""));

  if (!wanted.length) return <div className="collection-empty"><span className="record" /><h2 className="serif">还没有留下想听的唱片。</h2><p>在某一期专栏里标记「想听」，它会安静地收在这里。</p></div>;
  return <div className="want-list">{wanted.map(item => <CollectionAlbumCard item={item} context={`${item.issueNumber} · ${item.issueDate} 推荐`} key={item.album.id} />)}</div>;
}
