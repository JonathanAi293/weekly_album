import Link from "next/link";
import { AlbumCard } from "@/components/AlbumCard";
import { SiteNav } from "@/components/SiteNav";
import { getCurrentIssue, requireUser } from "@/lib/queries";
export const dynamic = "force-dynamic";

export default async function Home() {
  await requireUser(); const currentIssue = await getCurrentIssue();
  if (!currentIssue) return <main className="page"><SiteNav /><section className="hero"><div><div className="eyebrow">A private listening column</div><h1 className="serif">给耳朵的<br />每周来信</h1><p>还没有已发布的专栏。导入专辑和专栏数据后，下一个周五会从这里开始。</p></div></section></main>;
  return <main className="page"><SiteNav /><section className="hero"><div><div className="eyebrow">A private listening column</div><h1 className="serif">给耳朵的<br />每周来信</h1><p>不是榜单，也不是算法的喧闹推送。每个周五，为你筛选几张值得完整听完的专辑，并随着你的感受慢慢学会靠近。</p></div><div className="issue-stamp"><span>本周已送达</span><b className="serif">{currentIssue.number}</b><span>{currentIssue.date}<br />{currentIssue.albums.length} 张专辑</span></div></section><section><div className="section-head"><div><div className="eyebrow">This week&apos;s column</div><h2 className="serif">{currentIssue.title}</h2></div><Link className="quiet-link" href={`/issues/${currentIssue.slug}`}>阅读整期专栏 →</Link></div><div className="grid">{currentIssue.albums.slice(0, 4).map(album => <AlbumCard key={album.id} album={album} issueSlug={currentIssue.slug} />)}</div><p className="mobile-note" style={{ marginTop:16 }}>本期余下的唱片收在专栏全文中。评分、短评与状态只属于你，用来校准下一次推荐。</p></section></main>;
}
