import { SiteNav } from "@/components/SiteNav";
import { WantShelf } from "@/components/WantShelf";
import { getLibraryAlbums, requireUser } from "@/lib/queries";
export const dynamic = "force-dynamic";

export default async function WantPage() {
  await requireUser(); const items = await getLibraryAlbums();
  return <main className="page detail-shell"><SiteNav backHref="/" /><section className="issue-hero"><div className="eyebrow">To listen</div><h1 className="serif">想听</h1><p>暂时不急着播放的唱片，先留在这一页。它们来自你读过的专栏，也会在听完后自然离开。</p></section><section className="collection-section"><WantShelf items={items} /></section></main>;
}
