import Link from "next/link";
import { AlbumCover } from "@/components/AlbumCover";
import type { Album } from "@/lib/models";

export function FeaturedArtwork({ albums, href, title }: { albums: Album[]; href: string; title: string }) {
  return <Link className="featured-artwork" href={href} aria-label={`打开本期专栏：${title}`}>
    <div className="featured-artwork-layout">
      {albums.slice(0, 4).map(album => <div className="featured-artwork-cell" key={album.id}>
        <AlbumCover className="cover" cover={album.cover} title={album.title} />
      </div>)}
      {albums.length === 0 && <div className="featured-artwork-cell featured-artwork-empty"><span className="record" /><span>本期唱片</span></div>}
    </div>
  </Link>;
}
