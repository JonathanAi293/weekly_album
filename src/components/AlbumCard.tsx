import Link from "next/link";
import type { Album } from "@/lib/models";

export function AlbumCard({ album, issueSlug }: { album: Album; issueSlug: string }) {
  return <Link href={`/issues/${issueSlug}#${album.id}`} className="album-card">{album.cover ? <img className="cover" src={album.cover} alt={`${album.title} 专辑封面`} /> : <div className="cover" aria-label={`${album.title} 暂无封面`} />}<div><div className="card-kicker"><span className={`pill ${album.type === "探索推荐" ? "explore" : ""}`}>{album.type}</span><span>{album.releaseYear}</span></div><h3>{album.title}</h3><p className="artist">{album.artist}</p><div className="tags">{album.tags.map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><p className="reason">{album.reason}</p></div></Link>;
}
