import Link from "next/link";
import { AlbumCover } from "@/components/AlbumCover";
import { formatReleaseDate } from "@/lib/release-date";
import type { LibraryAlbum } from "@/lib/models";
import { formatRating, type Rating } from "@/lib/rating";

export function CollectionAlbumCard({ item, context, rating }: { item: LibraryAlbum; context: string; rating?: Rating }) {
  const { album } = item;
  return <Link className="collection-card" href={`/issues/${item.issueSlug}#${album.id}`}><AlbumCover className="collection-cover" cover={album.cover} title={album.title} /><div className="collection-copy"><h3 className="serif">{album.title}</h3><p>{album.artist} · {formatReleaseDate(album.releaseDate, album.releaseYear)}</p><div className="tags">{album.tags.slice(0, 3).map(tag => <span className="tag" key={tag}>{tag}</span>)}</div><span className="collection-context">{rating === undefined ? context : `${formatRating(rating)} · ${context}`}</span></div></Link>;
}
