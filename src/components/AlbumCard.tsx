import Link from "next/link";
import { AlbumCover } from "@/components/AlbumCover";
import { formatReleaseDate } from "@/lib/release-date";
import type { Album } from "@/lib/models";

export function AlbumCard({ album, issueSlug }: { album: Album; issueSlug: string }) {
  return <Link href={`/issues/${issueSlug}#${album.id}`} className="album-card">
    <AlbumCover className="cover" cover={album.cover} title={album.title} />
    <div className="card-kicker"><span className={`pill ${album.type === "探索推荐" ? "explore" : ""}`}>{album.type}</span><span>{formatReleaseDate(album.releaseDate, album.releaseYear)}</span></div>
    <h3>{album.title}</h3>
    <p className="artist">{album.artist}</p>
    <div className="tags">{album.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div>
    <p className="reason">{album.reason}</p>
    <span className="card-read-more">READ THE NOTE&nbsp; →</span>
  </Link>;
}
