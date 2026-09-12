import { AnnualYearbook } from "@/components/AnnualYearbook";
import { SiteNav } from "@/components/SiteNav";
import { getLibraryAlbums, requireUser } from "@/lib/queries";
export const dynamic = "force-dynamic";

export default async function AnnualPage() {
  await requireUser(); const items = await getLibraryAlbums();
  return <main className="page detail-shell"><SiteNav backHref="/" /><section className="issue-hero annual-hero"><div className="eyebrow">Private album almanac</div><h1 className="serif">年度</h1><p>按专辑发行年份收录，而不是按你什么时候听见它。每一层都是相同的评价，不替同分作品虚构名次。</p></section><section className="collection-section"><AnnualYearbook items={items} /></section></main>;
}
